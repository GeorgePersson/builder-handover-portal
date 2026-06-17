import Link from "next/link";
import { CalendarCheck2, CalendarPlus, CheckCircle2 } from "lucide-react";
import { StatusBanner } from "@/components/status-banner";
import { getMaintenanceTasks, getProjects } from "@/lib/server/queries";
import { formatDate } from "@/lib/utils";

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; storage?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [maintenanceTasks, projects] = await Promise.all([getMaintenanceTasks(), getProjects()]);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Phase 8</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Maintenance schedule</h1>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white"
            href="/builder/maintenance/new"
          >
            <CalendarPlus className="size-4" />
            New task
          </Link>
        </header>
        <StatusBanner draft={params.draft} error={params.error} storage={params.storage} />

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {maintenanceTasks.map((task) => {
            const project = projects.find((item) => item.id === task.projectId);

            return (
              <article className="rounded-lg border border-slate-200 bg-white p-5" key={task.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <CalendarCheck2 className="size-5 text-cyan-700" />
                      <h2 className="font-semibold">{task.title}</h2>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{project?.name}</p>
                  </div>
                  {task.status === "complete" ? (
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  ) : null}
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <Field label="Related product" value={task.relatedProduct} />
                  <Field label="Cadence" value={task.cadence} />
                  <Field label="Due date" value={formatDate(task.dueDate)} />
                  <Field label="Warranty required" value={task.requiredForWarranty ? "Yes" : "No"} />
                </dl>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-700">{value}</dd>
    </div>
  );
}
