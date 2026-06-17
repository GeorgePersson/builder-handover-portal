import Link from "next/link";
import { Bot, Building2, FileText, PackageCheck, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  getAuditEvents,
  getClientRequests,
  getExtractedHandoverItems,
  getProductVersions,
  getProjects,
  getSpecificationUploads,
} from "@/lib/server/queries";
import { formatDate } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const [projects, products, specifications, extractedItems, auditEvents, clientRequests] = await Promise.all([
    getProjects(),
    getProductVersions(),
    getSpecificationUploads(),
    getExtractedHandoverItems(),
    getAuditEvents(),
    getClientRequests(),
  ]);
  const lowConfidenceProducts = products.filter((product) => product.confidenceLabel !== "high");
  const lowConfidenceExtracted = extractedItems.filter((item) =>
    ["admin_review", "builder_approved", "edited", "proposed"].includes(item.status),
  );
  const approvalCount = lowConfidenceProducts.length + lowConfidenceExtracted.length + clientRequests.length;

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          actions={
            <>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800"
                href="/admin/review"
              >
                <Bot className="size-4" />
                Review AI queue
              </Link>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                href="/admin/products"
              >
                <PackageCheck className="size-4" />
                Global products
              </Link>
            </>
          }
          description="The internal portal for running the product: tenant oversight, AI confidence triage, builder activity, and operational audit trails."
          eyebrow="Platform owner"
          icon={ShieldCheck}
          title="Admin portal"
        />

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Builder projects" value={projects.length} icon={Building2} />
          <Metric label="Spec uploads" value={specifications.length} icon={FileText} />
          <Metric label="AI approval items" value={approvalCount} icon={Bot} />
          <Metric label="Global products" value={products.filter((product) => product.status === "approved").length} icon={PackageCheck} />
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.9fr]" id="builders">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-950">Builder company activity</h2>
              <p className="mt-1 text-sm text-slate-500">Prototype data is project-level until tenant tables are connected.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {projects.map((project) => (
                <article className="p-5" key={project.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">{project.name}</h3>
                      <p className="mt-1 text-sm text-slate-600">{project.address}</p>
                    </div>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
                      {project.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {project.documentCount} docs - {project.productCount} products - last activity{" "}
                    {formatDate(project.lastActivity)}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white" id="audit">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-slate-950">Recent audit trail</h2>
              <p className="mt-1 text-sm text-slate-500">Source-backed activity for operator oversight.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {auditEvents.slice(0, 5).map((event) => (
                <article className="p-5" key={event.id}>
                  <p className="text-sm font-semibold text-slate-950">{event.action}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{event.detail}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {event.actor} - {formatDate(event.createdAt)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5" id="clients">
          <h2 className="font-semibold text-amber-950">Client request direction</h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Homeowners should request missing products or documents from their portal. Requests then
            enter AI lookup and only appear to the client once approved by the builder or platform
            admin, depending on confidence and source quality.
          </p>
        </section>
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <Icon className="size-5 text-cyan-700" />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}
