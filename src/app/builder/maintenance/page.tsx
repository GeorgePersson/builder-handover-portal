import Link from "next/link";
import { CalendarCheck2, CalendarPlus, CheckCircle2 } from "lucide-react";
import { StatusBanner } from "@/components/status-banner";
import { getMaintenanceTasks, getProjects } from "@/lib/server/queries";
import { formatDate } from "@/lib/utils";
import type { MaintenanceTask } from "@/lib/types";

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; storage?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [maintenanceTasks, projects] = await Promise.all([getMaintenanceTasks(), getProjects()]);
  const projectCards = projects
    .map((project) => ({
      project,
      tasks: maintenanceTasks
        .filter((task) => task.projectId === project.id)
        .sort((first, second) => new Date(first.dueDate).getTime() - new Date(second.dueDate).getTime()),
    }))
    .sort((first, second) => Number(second.tasks.length > 0) - Number(first.tasks.length > 0));

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Builder workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Maintenance</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Upcoming maintenance is grouped by project. Projects with no tasks stay visible at the bottom.
            </p>
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
          {projectCards.map(({ project, tasks }) => (
            <article className="rounded-lg border border-slate-200 bg-white p-5" key={project.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarCheck2 className="size-5 text-cyan-700" />
                    <h2 className="font-semibold">{project.name}</h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{project.address}</p>
                </div>
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {tasks.length ? `${tasks.length} tasks` : "No tasks"}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {tasks.length ? (
                  tasks.map((task) => <TaskRow key={task.id} task={task} />)
                ) : (
                  <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    No maintenance tasks have been generated for this project yet.
                  </p>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function TaskRow({ task }: { task: MaintenanceTask }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">{task.title}</p>
          <p className="mt-1 text-sm text-slate-600">{task.relatedProduct}</p>
        </div>
        {task.status === "complete" ? <CheckCircle2 className="size-5 text-emerald-600" /> : null}
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <Field label="Cadence" value={task.cadence} />
        <Field label="Due" value={formatDate(task.dueDate)} />
        <Field label="Warranty" value={task.requiredForWarranty ? "Required" : "Optional"} />
      </dl>
    </div>
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
