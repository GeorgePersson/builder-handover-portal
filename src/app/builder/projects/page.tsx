import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { StatusBanner } from "@/components/status-banner";
import { getProjects } from "@/lib/server/queries";
import { formatDate } from "@/lib/utils";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; storage?: string; error?: string }>;
}) {
  const params = await searchParams;
  const projects = await getProjects();

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Builder workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Projects</h1>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white"
            href="/builder/projects/new"
          >
            <Plus className="size-4" />
            New project
          </Link>
        </header>
        <StatusBanner draft={params.draft} error={params.error} storage={params.storage} />

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="size-4 text-cyan-700" />
              Active handovers
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {projects.map((project) => (
              <article className="grid gap-4 p-5 md:grid-cols-[1fr_auto]" key={project.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{project.name}</h2>
                    <StatusPill variant={project.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{project.address}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {project.clientName} - {project.projectType} - Handover{" "}
                    {formatDate(project.handoverDate)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-right text-sm">
                  <Stat label="Docs" value={project.documentCount} />
                  <Stat label="Products" value={project.productCount} />
                  <Stat label="Tasks" value={project.openTasks} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-semibold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
