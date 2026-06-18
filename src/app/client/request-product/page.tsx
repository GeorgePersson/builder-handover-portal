import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { StatusBanner } from "@/components/status-banner";
import { createClientRequestAction } from "@/lib/server/actions";
import { getProjects } from "@/lib/server/queries";

export default async function ClientRequestProductPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; storage?: string; error?: string; projectId?: string }>;
}) {
  const params = await searchParams;
  const projects = await getProjects();
  const selectedProject =
    projects.find((project) => project.id === params.projectId) ||
    projects[0] ||
    null;

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          href="/client/portal"
        >
          <ArrowLeft className="size-3.5" />
          Back to home manual
        </Link>

        <header className="mt-6">
          <p className="text-sm font-semibold text-cyan-700">Client request</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
            Request a missing product or document
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Clients can request something to be added without seeing AI internals. The request should
            feed into AI lookup, source checking, and builder/admin approval before it appears in the
            published handover package.
          </p>
        </header>
        <StatusBanner draft={params.draft} error={params.error} storage={params.storage} />

        <form action={createClientRequestAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <input name="projectId" type="hidden" value={selectedProject?.id || ""} />
          {selectedProject ? (
            <div className="mb-5 rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm leading-6 text-cyan-900">
              Requesting an addition for {selectedProject.address}.
            </div>
          ) : (
            <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
              No assigned project is available yet. The builder needs to connect this client to a
              project before requests can be submitted.
            </div>
          )}
          <div className="grid gap-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Request type</span>
              <select
                className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none ring-cyan-700/20 focus:border-cyan-700 focus:ring-4"
                defaultValue="product"
                name="requestType"
              >
                <option value="product">Product or appliance</option>
                <option value="document">Document or certificate</option>
                <option value="maintenance">Maintenance guidance</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">What should be added?</span>
              <input
                className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-950 outline-none ring-cyan-700/20 focus:border-cyan-700 focus:ring-4"
                name="title"
                placeholder="Kitchen oven, bathroom tapware, garage door remote..."
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Where is it in the home?</span>
              <input
                className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-950 outline-none ring-cyan-700/20 focus:border-cyan-700 focus:ring-4"
                name="location"
                placeholder="Kitchen, ensuite, exterior cladding..."
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Extra details</span>
              <textarea
                className="mt-2 min-h-32 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-950 outline-none ring-cyan-700/20 focus:border-cyan-700 focus:ring-4"
                name="details"
                placeholder="Add any model numbers, brand names, photos you have, or what information you are looking for."
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Optional photo or file</span>
              <input
                className="mt-2 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
                name="attachment"
                type="file"
              />
            </label>
          </div>

          <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
            This creates a request, not a live product record. AI/admin checks happen before anything
            appears in the published handover package.
          </div>

          <div className="mt-6 flex justify-end">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!selectedProject}
              type="submit"
            >
              <Send className="size-4" />
              Submit request
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
