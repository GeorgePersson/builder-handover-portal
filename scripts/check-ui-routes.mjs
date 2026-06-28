import { mkdir, writeFile } from "node:fs/promises";
import { uiRoutes } from "./ui-route-manifest.mjs";

const baseUrl = process.env.UI_AUDIT_BASE_URL || "http://localhost:3000";
const outDir = ".hermes/reports";
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

function getFixturePath(route) {
  if (route.path !== "/builder/specifications/review/[itemId]/edit") return null;
  const itemId = process.env.UI_AUDIT_SPEC_REVIEW_ITEM_ID;
  return itemId ? `/builder/specifications/review/${encodeURIComponent(itemId)}/edit` : null;
}

function isLoginRedirect(location) {
  if (!location) return false;
  return location.includes("/login") || location.includes("/auth") || location.includes("/builder/onboarding");
}

function evaluateRoute(route, response, location) {
  if (route.kind === "public") {
    return {
      ok: response.status === 200,
      expectation: "HTTP 200",
    };
  }

  if (route.kind === "protected") {
    const isRedirect = redirectStatuses.has(response.status);
    return {
      ok: response.status === 200 || isRedirect,
      expectation: "HTTP 200 or auth/onboarding redirect",
      authRedirect: isRedirect && isLoginRedirect(location),
    };
  }

  return {
    ok: response.status === 200 || redirectStatuses.has(response.status),
    expectation: "fixture route renders or redirects",
  };
}

const results = [];

for (const route of uiRoutes) {
  const fixturePath = route.kind === "dynamic" ? getFixturePath(route) : null;

  if (route.kind === "dynamic" && !fixturePath) {
    results.push({
      ...route,
      status: "skipped",
      ok: true,
      reason: route.fixtureRequired || "fixture required",
    });
    continue;
  }

  const actualPath = fixturePath || route.path;
  const url = new URL(actualPath, baseUrl);

  try {
    const response = await fetch(url, { redirect: "manual" });
    const location = response.headers.get("location");
    const evaluation = evaluateRoute(route, response, location);

    results.push({
      ...route,
      actualPath,
      url: url.toString(),
      statusCode: response.status,
      location,
      ...evaluation,
    });
  } catch (error) {
    results.push({
      ...route,
      actualPath,
      url: url.toString(),
      ok: false,
      status: "request_failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

await mkdir(outDir, { recursive: true });
await writeFile(`${outDir}/ui-route-health.json`, `${JSON.stringify(results, null, 2)}\n`);

const summaryRows = results.map((result) => ({
  path: result.path,
  kind: result.kind,
  status: result.statusCode || result.status,
  ok: result.ok,
  note: result.reason || result.location || result.expectation || "",
}));
console.table(summaryRows);

const failed = results.filter((result) => result.ok === false);
if (failed.length > 0) {
  console.error(`UI route health check failed for ${failed.length} route(s). Report: ${outDir}/ui-route-health.json`);
  process.exitCode = 1;
} else {
  console.log(`UI route health check passed for ${results.length} route entries. Report: ${outDir}/ui-route-health.json`);
}
