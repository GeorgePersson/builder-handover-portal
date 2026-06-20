import Link from "next/link";
import { headers } from "next/headers";
import { CalendarCheck2, FileText, FolderOpen, Home, PackageCheck, Send } from "lucide-react";
import { completeMaintenanceTaskAction } from "@/lib/server/actions";
import { getClientPortalData, recordHandoverOpen } from "@/lib/server/queries";
import { cn, formatDate } from "@/lib/utils";

export default async function ClientPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invite?: string; maintenance?: string; projectId?: string }>;
}) {
  const params = await searchParams;
  const { projectSummaries } = await getClientPortalData();

  if (projectSummaries.length === 0) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <header className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-11 items-center justify-center rounded-lg bg-cyan-700 text-white">
                <Home className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cyan-700">Home manuals</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal">No assigned handovers yet</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Once the builder adds you to a project, each handover package will appear here.
                </p>
              </div>
            </div>
          </header>
        </div>
      </main>
    );
  }

  const selectedSummary =
    projectSummaries.find((summary) => summary.project.id === params.projectId) || projectSummaries[0];
  const selectedProject = selectedSummary.project;
  const headerList = await headers();

  if (selectedSummary.publishedPackage.publishedAt) {
    await recordHandoverOpen(selectedProject.id, headerList.get("user-agent") || undefined);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-11 items-center justify-center rounded-lg bg-cyan-700 text-white">
                <Home className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cyan-700">Home manuals</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal">Your handover documents</h1>
                <p className="mt-2 text-sm text-slate-600">
                  Open a project handover to view documents, approved product information, and maintenance tasks.
                </p>
              </div>
            </div>
            <Link
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href={`/client/request-product?projectId=${selectedProject.id}`}
            >
              <Send className="size-4" />
              Request missing item
            </Link>
          </div>
        </header>
        {params.invite === "accepted" ? (
          <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">
            Invite accepted. This home manual is now connected to your signed-in account.
          </p>
        ) : null}
        {params.maintenance === "completed" ? (
          <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">
            Maintenance task marked complete.
          </p>
        ) : null}
        {params.error ? (
          <p className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800">
            Action failed: {params.error.replaceAll("-", " ")}.
          </p>
        ) : null}

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {projectSummaries.map((summary) => {
            const isSelected = summary.project.id === selectedProject.id;
            const packageCount =
              summary.publishedPackage.products.length +
              summary.publishedPackage.documents.length +
              summary.publishedPackage.maintenance.length;

            return (
              <Link
                className={cn(
                  "rounded-lg border bg-white p-5 hover:border-cyan-300 hover:bg-cyan-50/40",
                  isSelected ? "border-cyan-500 ring-4 ring-cyan-100" : "border-slate-200",
                )}
                href={`/client/portal?projectId=${summary.project.id}`}
                key={summary.project.id}
              >
                <FolderOpen className="size-5 text-cyan-700" />
                <h2 className="mt-3 font-semibold text-slate-950">{summary.project.name}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">{summary.project.address}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1">{summary.visibleDocuments.length} docs</span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1">{packageCount} package items</span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1">{summary.maintenanceTasks.length} tasks</span>
                </div>
              </Link>
            );
          })}
        </section>

        <section className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50 p-5">
          <p className="text-sm font-semibold text-cyan-800">Open handover</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{selectedProject.name}</h2>
          <p className="mt-2 text-sm leading-6 text-cyan-900">
            Handover information prepared by the builder for {selectedProject.clientName}.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <PortalSummary icon={FileText} label="Documents" value={`${selectedSummary.visibleDocuments.length} available`} />
            <PortalSummary icon={PackageCheck} label="Products" value={`${selectedSummary.publishedPackage.products.length} published`} />
            <PortalSummary icon={CalendarCheck2} label="Maintenance" value={`${selectedSummary.maintenanceTasks.length} scheduled`} />
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-lg border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Documents</h2>
            <div className="grid gap-3 p-5 md:grid-cols-2">
              {selectedSummary.visibleDocuments.map((document) => {
                const documentDownloads = selectedSummary.documentDownloadEvents.filter(
                  (event) => event.documentId === document.id,
                );
                const latestDownload = documentDownloads[0];

                return (
                  <article className="rounded-md border border-slate-200 p-4" key={document.id}>
                    <FileText className="size-5 text-cyan-700" />
                    <p className="mt-3 font-medium">{document.name}</p>
                    <p className="mt-1 text-xs capitalize text-slate-500">
                      {document.type.replaceAll("_", " ")} - {document.size}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">Uploaded {formatDate(document.uploadedAt)}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {documentDownloads.length
                        ? `Downloaded ${documentDownloads.length} time${documentDownloads.length === 1 ? "" : "s"} - last ${formatDate(latestDownload.downloadedAt)}`
                        : "Not downloaded yet"}
                    </p>
                    {document.storagePath ? (
                      <Link
                        className="mt-4 inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        href={`/api/documents/${document.id}/download`}
                      >
                        Download
                      </Link>
                    ) : null}
                  </article>
                );
              })}
              {selectedSummary.visibleDocuments.length === 0 ? (
                <p className="text-sm text-slate-500">No client-visible documents have been added yet.</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-5 py-4 font-semibold">Upcoming care</h2>
            <div className="divide-y divide-slate-100">
              {selectedSummary.maintenanceTasks.map((task) => (
                <div className="p-5" key={task.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-medium">{task.title}</p>
                    <span
                      className={cn(
                        "rounded-md px-2 py-1 text-xs font-semibold capitalize",
                        task.status === "complete"
                          ? "bg-emerald-100 text-emerald-800"
                          : task.status === "overdue"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-100 text-slate-700",
                      )}
                    >
                      {task.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{task.relatedProduct}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Due {formatDate(task.dueDate)} - {task.cadence}
                  </p>
                  {task.status !== "complete" ? (
                    <form action={completeMaintenanceTaskAction} className="mt-4 space-y-2">
                      <input name="taskId" type="hidden" value={task.id} />
                      <input
                        className="h-9 w-full rounded-md border border-slate-200 px-3 text-xs text-slate-950 outline-none focus:border-cyan-700"
                        name="notes"
                        placeholder="Completion note"
                        type="text"
                      />
                      <button
                        className="inline-flex h-9 items-center rounded-md bg-cyan-700 px-3 text-xs font-semibold text-white hover:bg-cyan-800"
                        type="submit"
                      >
                        Mark complete
                      </button>
                    </form>
                  ) : null}
                </div>
              ))}
              {selectedSummary.maintenanceTasks.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No upcoming care items have been published yet.</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <PublishedColumn title="Products" items={selectedSummary.publishedPackage.products} />
          <PublishedColumn title="Documents From Spec" items={selectedSummary.publishedPackage.documents} />
          <PublishedColumn title="Maintenance From Spec" items={selectedSummary.publishedPackage.maintenance} />
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
    <div className="rounded-lg border border-slate-200 bg-white">
      <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-950">{title}</h3>
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
    <div className="rounded-lg border border-cyan-200 bg-white p-5">
      <Icon className="size-5 text-cyan-700" />
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-sm text-slate-600">{value}</p>
    </div>
  );
}
