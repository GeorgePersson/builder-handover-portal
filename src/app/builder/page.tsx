import Link from "next/link";
import {
  Building2,
  CalendarCheck2,
  LayoutDashboard,
  PackageCheck,
  Send,
  UserRoundSearch,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  getClientRequests,
  getExtractedHandoverItems,
  getMaintenanceTasks,
  getProjects,
  getSpecificationUploads,
} from "@/lib/server/queries";
import { formatDate } from "@/lib/utils";

const packageReadyStatuses = new Set(["accepted", "auto_approved", "builder_approved", "global_approved"]);

export default async function BuilderPortalPage() {
  const [projects, specifications, extractedItems, maintenanceTasks, clientRequests] =
    await Promise.all([
      getProjects(),
      getSpecificationUploads(),
      getExtractedHandoverItems(),
      getMaintenanceTasks(),
      getClientRequests(),
    ]);

  const readyItems = extractedItems.filter((item) => packageReadyStatuses.has(item.status));
  const handedOverProjects = projects.filter((project) => project.status === "published");
  const openClientRequests = clientRequests.filter((request) =>
    ["submitted", "ai_checking", "admin_review"].includes(request.status),
  );

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          actions={
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800"
              href="/builder/projects"
            >
              <Building2 className="size-4" />
              Open projects
            </Link>
          }
          description="A single view of active projects, packages ready to send, client requests, and maintenance follow-up."
          eyebrow="Builder company"
          icon={LayoutDashboard}
          title="Dashboard"
        />

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Building2} label="Active projects" value={projects.length} />
          <Metric icon={Send} label="Ready to send" value={readyItems.length} />
          <Metric icon={PackageCheck} label="Handed over" value={handedOverProjects.length} />
          <Metric icon={UserRoundSearch} label="Client requests" value={openClientRequests.length} />
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <DashboardPanel
            actionHref="/builder/projects"
            actionLabel="Manage projects"
            icon={Building2}
            title="Active projects"
          >
            {projects.map((project) => (
              <Row
                detail={`${project.clientName} - handover ${formatDate(project.handoverDate)}`}
                href={`/builder/projects?projectId=${encodeURIComponent(project.id)}`}
                key={project.id}
                label={project.name}
                meta={project.status.replaceAll("_", " ")}
              />
            ))}
          </DashboardPanel>

          <DashboardPanel
            actionHref="/builder/projects"
            actionLabel="Open projects"
            icon={UserRoundSearch}
            title="Client requests"
          >
            {openClientRequests.length ? (
              openClientRequests.slice(0, 5).map((request) => (
                <Row
                  detail={
                    request.details ||
                    `${request.requestType.replaceAll("_", " ")} request${request.location ? ` - ${request.location}` : ""}`
                  }
                  href={`/builder/projects?projectId=${encodeURIComponent(request.projectId)}`}
                  key={request.id}
                  label={request.title}
                  meta={request.status.replaceAll("_", " ")}
                />
              ))
            ) : (
              <EmptyRow text="No client requests are waiting." />
            )}
          </DashboardPanel>

          <DashboardPanel
            actionHref="/builder/projects"
            actionLabel="Send package"
            icon={Send}
            title="Packages ready to send"
          >
            {projects.map((project) => {
              const projectSpecIds = new Set(
                specifications.filter((specification) => specification.projectId === project.id).map((specification) => specification.id),
              );
              const projectReadyCount = readyItems.filter((item) => projectSpecIds.has(item.specificationId)).length;
              return (
                <Row
                  detail={projectReadyCount ? `${projectReadyCount} items ready for builder confirmation` : "No package-ready items yet"}
                  href={`/builder/projects?projectId=${encodeURIComponent(project.id)}`}
                  key={project.id}
                  label={project.name}
                  meta={projectReadyCount ? "ready" : "draft"}
                />
              );
            })}
          </DashboardPanel>

          <DashboardPanel
            actionHref="/builder/maintenance"
            actionLabel="Open maintenance"
            icon={CalendarCheck2}
            title="Upcoming maintenance"
          >
            {maintenanceTasks.slice(0, 5).map((task) => (
              <Row
                detail={`${task.relatedProduct} - due ${formatDate(task.dueDate)}`}
                href={`/builder/maintenance#project-${encodeURIComponent(task.projectId)}`}
                key={task.id}
                label={task.title}
                meta={task.status}
              />
            ))}
          </DashboardPanel>
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
      <Icon className="size-5 text-cyan-700" />
      <p className="mt-3 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}

function DashboardPanel({
  actionHref,
  actionLabel,
  children,
  icon: Icon,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-cyan-700" />
          <h2 className="font-semibold text-slate-950">{title}</h2>
        </div>
        <Link
          className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          href={actionHref}
        >
          {actionLabel}
        </Link>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function Row({ detail, href, label, meta }: { detail: string; href?: string; label: string; meta: string }) {
  const content = (
    <>
      <div>
        <p className="text-sm font-semibold text-slate-950">{label}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
      </div>
      <span className="w-fit rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
        {meta}
      </span>
    </>
  );

  const className = "grid gap-2 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[1fr_auto] sm:items-start";

  if (href) {
    return (
      <Link aria-label={`Open ${label}`} className={className} href={href}>
        {content}
      </Link>
    );
  }

  return <article className={className}>{content}</article>;
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-5 py-4 text-sm text-slate-500">{text}</p>;
}
