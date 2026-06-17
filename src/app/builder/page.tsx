import Link from "next/link";
import {
  Bot,
  Building2,
  FileUp,
  LayoutList,
  PackageCheck,
  ScrollText,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  getAcceptedHandoverPackagePreview,
  getExtractedHandoverItems,
  getProjects,
  getSpecificationUploads,
} from "@/lib/server/queries";
import { formatDate } from "@/lib/utils";

export default async function BuilderPortalPage() {
  const [projects, specifications, extractedItems, packagePreview] = await Promise.all([
    getProjects(),
    getSpecificationUploads(),
    getExtractedHandoverItems(),
    getAcceptedHandoverPackagePreview(),
  ]);
  const builderReviewCount = extractedItems.filter((item) =>
    ["admin_review", "edited", "proposed"].includes(item.status),
  ).length;
  const packageReadyCount = extractedItems.filter((item) =>
    ["accepted", "auto_approved", "builder_approved", "global_approved"].includes(item.status),
  ).length;
  const packageTotal =
    packagePreview.products.length + packagePreview.documents.length + packagePreview.maintenance.length;

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          actions={
            <>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                href="/builder/specifications/review"
              >
                <Bot className="size-4" />
                Review queue
              </Link>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800"
                href="/builder/specifications/new"
              >
                <FileUp className="size-4" />
                Upload specification
              </Link>
            </>
          }
          description="Builder-company workspace for creating and publishing homeowner handover packages from specification PDFs."
          eyebrow="Builder company"
          icon={Building2}
          title="Builder portal"
        />

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Projects" value={projects.length} icon={Building2} />
          <Metric label="Spec uploads" value={specifications.length} icon={ScrollText} />
          <Metric label="Optional builder review" value={builderReviewCount} icon={Bot} />
          <Metric label="Package items" value={packageTotal || packageReadyCount} icon={PackageCheck} />
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.85fr]">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-950">Active projects</h2>
                <p className="mt-1 text-sm text-slate-500">Builder teams manage handover packs per project.</p>
              </div>
              <Link
                className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                href="/builder/projects"
              >
                View all
              </Link>
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
                    Handover {formatDate(project.handoverDate)} - {project.documentCount} docs -{" "}
                    {project.productCount} products
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <section className="rounded-lg border border-cyan-200 bg-cyan-50 p-5">
              <FileUp className="size-5 text-cyan-700" />
              <h2 className="mt-3 font-semibold text-slate-950">Main builder workflow</h2>
              <p className="mt-2 text-sm leading-6 text-cyan-900">
                Upload a specification PDF. Known database matches are pre-approved, while new or
                uncertain items go to admin review and can be project-approved by the builder if needed.
              </p>
              <Link
                className="mt-4 inline-flex h-10 items-center rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800"
                href="/builder/specifications/new"
              >
                Start with a PDF
              </Link>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <LayoutList className="size-5 text-cyan-700" />
              <h2 className="mt-3 font-semibold text-slate-950">Package preview</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Accepted items become the draft package. Clients only see what builders publish.
              </p>
              <Link
                className="mt-4 inline-flex h-10 items-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                href="/builder/handover-package"
              >
                Preview package
              </Link>
            </section>
          </div>
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
