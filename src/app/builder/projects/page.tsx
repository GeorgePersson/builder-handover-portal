import Link from "next/link";
import { Building2, Link2, Plus } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { StatusBanner } from "@/components/status-banner";
import { SubmitButton } from "@/components/forms/submit-button";
import { createClientInviteAction } from "@/lib/server/actions";
import { getProjects } from "@/lib/server/queries";
import { formatDate } from "@/lib/utils";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    draft?: string;
    storage?: string;
    error?: string;
    projectId?: string;
    inviteToken?: string;
  }>;
}) {
  const params = await searchParams;
  const projects = await getProjects();
  const invitePath = params.inviteToken
    ? `/client/accept-invite?token=${encodeURIComponent(params.inviteToken)}`
    : null;

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
        <StatusBanner
          draft={params.draft === "invite-created" ? undefined : params.draft}
          error={params.error}
          errorMessages={{
            "client-already-accepted": "That client has already accepted their invite.",
            "client-not-found": "No client record was found for that project.",
            "create-client-invite-failed": "The client invite link could not be created.",
          }}
          storage={params.storage}
        />
        {invitePath ? (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Client invite link created</p>
            <p className="mt-2 leading-6">
              Send this link to the client after they have a Supabase magic-link login available.
            </p>
            <Link
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2 font-semibold text-emerald-900 hover:bg-emerald-100"
              href={invitePath}
            >
              <Link2 className="size-4" />
              {invitePath}
            </Link>
          </div>
        ) : null}

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
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Invite: {formatInviteStatus(project.clientInviteStatus, project.clientInvitedAt)}
                  </p>
                </div>
                <div className="flex flex-col gap-4 md:items-end">
                  <div className="grid grid-cols-3 gap-4 text-right text-sm">
                    <Stat label="Docs" value={project.documentCount} />
                    <Stat label="Products" value={project.productCount} />
                    <Stat label="Tasks" value={project.openTasks} />
                  </div>
                  {project.clientInviteStatus === "accepted" ? null : (
                    <form action={createClientInviteAction}>
                      <input name="projectId" type="hidden" value={project.id} />
                      <SubmitButton icon={Link2} label="Create invite link" />
                    </form>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function formatInviteStatus(status?: string, invitedAt?: string) {
  if (status === "accepted") {
    return "Accepted";
  }

  if (status === "invited") {
    return invitedAt ? `Invited ${formatDate(invitedAt)}` : "Invited";
  }

  return "Not invited";
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-semibold">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
