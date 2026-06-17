import Link from "next/link";
import { CalendarCheck2, FileText, Home, PackageCheck, Send } from "lucide-react";
import {
  getDocuments,
  getMaintenanceTasks,
  getPublishedClientPackagePreview,
  getProductVersions,
  getProjects,
} from "@/lib/server/queries";
import { formatDate } from "@/lib/utils";

export default async function ClientPortalPage() {
  const [projects, documents, productVersions, maintenanceTasks, publishedPackage] = await Promise.all([
    getProjects(),
    getDocuments(),
    getProductVersions(),
    getMaintenanceTasks(),
    getPublishedClientPackagePreview(),
  ]);
  const project =
    projects[0] ||
    ({
      id: "empty",
      address: "Create a project to begin",
      clientName: "Homeowner",
    } as const);
  const visibleDocuments = documents.filter((document) => document.visibleToClient);
  const approvedProducts = productVersions.filter((product) => product.status === "approved");
  const projectTasks = maintenanceTasks.filter((task) => task.projectId === project.id);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
            <div className="flex size-11 items-center justify-center rounded-lg bg-cyan-700 text-white">
              <Home className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-cyan-700">Home manual</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal">{project.address}</h1>
              <p className="mt-2 text-sm text-slate-600">
                Handover information prepared by the builder for {project.clientName}.
              </p>
            </div>
            </div>
            <Link
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/client/request-product"
            >
              <Send className="size-4" />
              Request missing item
            </Link>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <PortalSummary icon={FileText} label="Documents" value={`${visibleDocuments.length} available`} />
          <PortalSummary icon={PackageCheck} label="Products" value={`${approvedProducts.length} approved`} />
          <PortalSummary icon={CalendarCheck2} label="Maintenance" value={`${projectTasks.length} scheduled`} />
        </section>

        {publishedPackage.publishedAt ? (
          <section className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50 p-5">
            <p className="text-sm font-semibold text-cyan-800">Published handover package</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Builder-approved handover items</h2>
            <p className="mt-2 text-sm leading-6 text-cyan-900">
              These items were pre-approved from known database matches or approved by the builder
              for this handover package before publishing.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <PortalSummary
                icon={PackageCheck}
                label="Published products"
                value={`${publishedPackage.products.length} items`}
              />
              <PortalSummary
                icon={FileText}
                label="Published documents"
                value={`${publishedPackage.documents.length} items`}
              />
              <PortalSummary
                icon={CalendarCheck2}
                label="Published maintenance"
                value={`${publishedPackage.maintenance.length} items`}
              />
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <PublishedColumn title="Products" items={publishedPackage.products} />
              <PublishedColumn title="Documents" items={publishedPackage.documents} />
              <PublishedColumn title="Maintenance" items={publishedPackage.maintenance} />
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Important documents</h2>
            <div className="divide-y divide-slate-100">
              {visibleDocuments.map((document) => (
                <div className="p-5" key={document.id}>
                  <p className="font-medium">{document.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {document.size} - Uploaded {formatDate(document.uploadedAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Upcoming care</h2>
            <div className="divide-y divide-slate-100">
              {projectTasks.map((task) => (
                <div className="p-5" key={task.id}>
                  <p className="font-medium">{task.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{task.relatedProduct}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Due {formatDate(task.dueDate)} - {task.cadence}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function PublishedColumn({
  items,
  title,
}: {
  items: Array<{
    id: string;
    title: string;
    location: string;
    extractedText: string;
  }>;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-cyan-200 bg-white">
      <h3 className="border-b border-cyan-100 px-4 py-3 text-sm font-semibold text-slate-950">{title}</h3>
      <div className="divide-y divide-slate-100">
        {items.length === 0 ? <p className="p-4 text-sm text-slate-500">No published items yet.</p> : null}
        {items.map((item) => (
          <article className="p-4" key={item.id}>
            <p className="text-sm font-semibold text-slate-950">{item.title}</p>
            <p className="mt-1 text-xs text-slate-500">{item.location || "No location captured"}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.extractedText}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function PortalSummary({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <Icon className="size-5 text-cyan-700" />
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-sm text-slate-600">{value}</p>
    </div>
  );
}
