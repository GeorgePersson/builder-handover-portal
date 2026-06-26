"use client";

import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarCheck2,
  FileText,
  HelpCircle,
  Layers3,
  Link2,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Send,
  Upload,
  X,
} from "lucide-react";
import { StatusBanner } from "@/components/status-banner";
import { StatusPill } from "@/components/status-pill";
import { SelectField, TextField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import type {
  DocumentExtractionJob,
  ExtractedWorkflowItem,
  ProductMatch,
  UploadedProjectDocument,
} from "@/lib/document-workflow";
import {
  createBuilderProjectRequestAction,
  createClientInviteAction,
  createDocumentAction,
  createProjectAction,
  createProjectHandoverChecklistItemAction,
  updateProjectHandoverChecklistItemAction,
  acceptProjectHandoverChecklistItemIncompleteAction,
  publishHandoverPackageAction,
  revokeClientInviteAction,
  sendClientInviteEmailAction,
  updateProjectAction,
} from "@/lib/server/actions";
import { formatDate } from "@/lib/utils";
import {
  builderHandoverApprovalText,
} from "@/lib/handover-approval";
import type {
  DocumentDownloadEvent,
  ExtractedHandoverItem,
  HandoverOpenEvent,
  HandoverDocument,
  MaintenanceTask,
  ProductVersion,
  Project,
  SpecificationUpload,
} from "@/lib/types";

import type { ProjectHandoverChecklistItem } from "@/lib/project-handover-checklist";
import { getMissingChecklistSections, hasEnoughIdentityToSearch } from "@/lib/project-handover-checklist";

type ProjectsWorkspaceProps = {
  draft?: string;
  error?: string;
  storage?: string;
  inviteToken?: string;
  creditStatus: {
    email: string;
    unlimited: boolean;
    availableCredits: number | "infinite";
    projectCost: number;
  };
  downloadEvents: DocumentDownloadEvent[];
  handoverOpenEvents: HandoverOpenEvent[];
  checklistItems: ProjectHandoverChecklistItem[];
  documents: HandoverDocument[];
  projects: Project[];
  specifications: SpecificationUpload[];
  extractedItems: ExtractedHandoverItem[];
  extractedWorkflowItems: ExtractedWorkflowItem[];
  extractionJobs: DocumentExtractionJob[];
  maintenanceTasks: MaintenanceTask[];
  productVersions: ProductVersion[];
  productMatches: ProductMatch[];
  uploadedDocuments: UploadedProjectDocument[];
};

type ModalMode = "create" | "send" | "help" | "clientAccess" | "addItem" | null;
type ProjectWorkspaceTab = "overview" | "items" | "documents" | "automation";

const projectWorkspaceTabs: Array<{ id: ProjectWorkspaceTab; label: string; href: string }> = [
  { id: "overview", label: "Overview", href: "#project-overview" },
  { id: "items", label: "Items", href: "#project-items" },
  { id: "documents", label: "Documents", href: "#project-documents" },
  { id: "automation", label: "Spec automation", href: "#project-spec-automation" },
];


const handoverCategoryOptions = [
  { label: "Kitchen", value: "Kitchen" },
  { label: "Joinery", value: "Joinery" },
  { label: "Flooring", value: "Flooring" },
  { label: "Roofing", value: "Roofing" },
  { label: "Cladding", value: "Cladding" },
  { label: "Electrical", value: "Electrical" },
  { label: "Plumbing", value: "Plumbing" },
  { label: "Appliances", value: "Appliances" },
  { label: "Fixtures", value: "Fixtures" },
  { label: "Landscaping", value: "Landscaping" },
  { label: "General", value: "General" },
];

function getCategoryOptions(category?: string | null) {
  if (!category || handoverCategoryOptions.some((option) => option.value === category)) {
    return handoverCategoryOptions;
  }

  return [{ label: category, value: category }, ...handoverCategoryOptions];
}

const projectTypeOptions = [
  { label: "New residential build", value: "New residential build" },
  { label: "Full renovation", value: "Full renovation" },
  { label: "Bathroom renovation", value: "Bathroom renovation" },
  { label: "Kitchen renovation", value: "Kitchen renovation" },
  { label: "Reclad project", value: "Reclad project" },
  { label: "Roofing project", value: "Roofing project" },
];

export function ProjectsWorkspace({
  draft,
  error,
  storage,
  inviteToken,
  creditStatus,
  downloadEvents,
  handoverOpenEvents,
  checklistItems,
  documents,
  projects,
  maintenanceTasks,
  productVersions,
}: ProjectsWorkspaceProps) {
  const [mode, setMode] = useState<ModalMode>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [productQuery, setProductQuery] = useState("");

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const invitePath = inviteToken ? `/client/accept-invite?token=${encodeURIComponent(inviteToken)}` : null;

  const projectSnapshots = useMemo(
    () =>
      projects.map((project) => {
        const tasks = maintenanceTasks.filter((task) => task.projectId === project.id);
        const projectDocuments = documents.filter((document) => document.projectId === project.id);
        const projectDownloadEvents = downloadEvents.filter((event) => event.projectId === project.id);
        const projectHandoverOpenEvents = handoverOpenEvents.filter((event) => event.projectId === project.id);
        const firstHandoverOpenEvent = [...projectHandoverOpenEvents].sort((left, right) =>
          left.firstOpenedAt.localeCompare(right.firstOpenedAt),
        )[0];
        const checklist = checklistItems.filter((item) => item.projectId === project.id);

        return {
          project,
          downloadEvents: projectDownloadEvents,
          firstHandoverOpenEvent,
          handoverOpenEvents: projectHandoverOpenEvents,
          documents: projectDocuments,
          checklist,
          tasks,
        };
      }),
    [
      documents,
      checklistItems,
      downloadEvents,
      handoverOpenEvents,
      maintenanceTasks,
      projects,
    ],
  );

  const selectedSnapshot = projectSnapshots.find((snapshot) => snapshot.project.id === selectedProject?.id) ?? null;
  const filteredProducts = productVersions.filter((product) => {
    const query = productQuery.trim().toLowerCase();
    if (!query) {
      return product.status === "approved";
    }

    return `${product.productName} ${product.brand} ${product.category}`.toLowerCase().includes(query);
  });

  function open(nextMode: Exclude<ModalMode, null>, projectId?: string) {
    setMode(nextMode);
    setIsDirty(false);
    setProductQuery("");
    if (projectId) {
      setSelectedProjectId(projectId);
    }
  }

  function close() {
    if (isDirty && !window.confirm("Close without saving these changes?")) {
      return;
    }

    setMode(null);
    setIsDirty(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 text-[13px] text-slate-950 sm:px-6">
      <div className="w-full max-w-none">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Builder workspace</p>
            <h1 className="mt-1 text-xl font-semibold tracking-normal">Projects</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Create, manage, package, and send handover projects from one workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => open("help")}
              type="button"
            >
              <HelpCircle className="size-4" />
              Help
            </button>
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-cyan-700 px-3 text-xs font-semibold text-white hover:bg-cyan-800"
              onClick={() => open("create")}
              type="button"
            >
              <Plus className="size-4" />
              Add new project
            </button>
          </div>
        </header>

        <StatusBanner
          draft={draft === "invite-created" || draft === "invite-revoked" || draft === "invite-email-sent" ? undefined : draft}
          error={error}
          errorMessages={{
            "client-already-accepted": "That client has already accepted their invite.",
            "client-not-found": "No client record was found for that project.",
            "credit-check-failed": "Project credits could not be checked.",
            "credit-deduct-failed": "The project credit could not be deducted.",
            "credit-event-failed": "The project credit event could not be recorded.",
            "create-client-invite-failed": "The client invite link could not be created.",
            "create-request-failed": "The missing item request could not be created.",
            "create-checklist-item-failed": "The handover checklist item could not be created.",
            "update-checklist-item-failed": "The handover checklist item could not be updated.",
            "accept-checklist-incomplete-failed": "The incomplete acceptance could not be recorded.",
            "handover-approval-record-failed": "The final approval record could not be saved. Run the Phase 9 Supabase migration if needed.",
            "handover-approval-required": "Confirm the final builder approval before release.",
            "invalid-document-upload": "That file type is not supported. Upload a PDF, image, Word, Excel, or CSV file.",
            "insufficient-project-credits": "This organisation does not have a project credit available yet.",
            "invite-email-not-configured": "Invite link created, but email is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL.",
            "invite-email-send-failed": "Invite link created, but the email could not be sent. Use the manual link below.",
            "no-organisation": "No builder workspace exists for this account yet. Open Builder setup to finish account setup.",
            "project-not-found": "That project could not be found.",
            "publish-package-failed": "The handover package could not be published for this project.",
            "revoke-client-invite-failed": "The client invite link could not be revoked.",
            "project-credit-not-confirmed": "Confirm project credit use before creating the project.",
            "update-project-failed": "The project could not be updated.",
            "upload-document-failed": "The document file could not be uploaded.",
            "uploaded-document-download-failed": "The uploaded document could not be loaded.",
            "uploaded-document-not-found": "The uploaded document could not be found.",
            "publish-readiness-check-failed": "The project readiness check could not be completed.",
          }}
          storage={storage}
        />

        {draft === "invite-email-sent" ? (
          <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">
            Client invite email sent. The client still needs to sign in with the invited email address.
          </p>
        ) : null}

        {invitePath ? (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Client invite link created</p>
            <p className="mt-2 leading-6">Send this link to the invited client email address.</p>
            <a
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2 font-semibold text-emerald-900 hover:bg-emerald-100"
              href={invitePath}
            >
              <Link2 className="size-4" />
              {invitePath}
            </a>
          </div>
        ) : null}

        {selectedProject && selectedSnapshot ? (
          <ProjectEditPanel
            onAddItem={() => open("addItem", selectedProject.id)}
            onBack={() => {
              setSelectedProjectId(null);
              setIsDirty(false);
              setProductQuery("");
            }}
            onClientAccess={() => open("clientAccess", selectedProject.id)}
            onSend={() => open("send", selectedProject.id)}
            project={selectedProject}
            setDirty={setIsDirty}
            snapshot={selectedSnapshot}
          />
        ) : (
          <>
            <section className="mt-4 grid gap-3 md:grid-cols-4">
              <Metric icon={PackageCheck} label="Projects" value={projects.length} />
              <Metric icon={FileText} label="Client docs" value={documents.filter((document) => document.visibleToClient).length} />
              <Metric icon={Send} label="Package-ready items" value={projectSnapshots.reduce((sum, snapshot) => sum + snapshot.checklist.filter((item) => item.status === "complete" || item.status === "user_accepted_incomplete").length, 0)} />
              <Metric icon={CalendarCheck2} label="Maintenance tasks" value={maintenanceTasks.length} />
            </section>

            <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="grid gap-2 border-b border-slate-100 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <h2 className="font-semibold text-slate-950">Project browser</h2>
                  <p className="mt-1 text-sm text-slate-500">Choose a project to open its dedicated handover workspace. Manual items and database autofill are the main demo path.</p>
                </div>
                <button
                  className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => open("create")}
                  type="button"
                >
                  Add project
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {projectSnapshots.map(({ project, checklist, firstHandoverOpenEvent, tasks }) => {
                  const checklistReady = checklist.filter((item) => item.status === "complete" || item.status === "user_accepted_incomplete").length;
                  const incompleteCount = checklist.filter((item) => item.status !== "complete" && item.status !== "user_accepted_incomplete").length;

                  return (
                    <article className="grid gap-3 p-4 transition hover:bg-slate-50 xl:grid-cols-[1fr_auto]" key={project.id}>
                      <button className="text-left" onClick={() => setSelectedProjectId(project.id)} type="button">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-950">{project.name}</h3>
                          <StatusPill variant={project.status} />
                          {incompleteCount ? <InlineFlag icon={Bell} label={`${incompleteCount} to complete`} /> : <InlineFlag icon={PackageCheck} label="Ready-looking" />}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{project.address}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {project.clientName} - {project.projectType} - Handover {formatDate(project.handoverDate)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                          <span className="rounded-md bg-slate-100 px-2.5 py-1">{checklist.length} checklist items</span>
                          <span className="rounded-md bg-slate-100 px-2.5 py-1">{checklistReady} manual ready</span>
                          <span className="rounded-md bg-slate-100 px-2.5 py-1">
                            {documents.filter((document) => document.projectId === project.id).length} documents
                          </span>
                          <span className="rounded-md bg-slate-100 px-2.5 py-1">{tasks.length ? `${tasks.length} maintenance tasks` : "No maintenance tasks"}</span>
                          <span className="rounded-md bg-slate-100 px-2.5 py-1">Invite: {formatInviteStatus(project.clientInviteStatus, project.clientInvitedAt)}</span>
                          <span className="rounded-md bg-slate-100 px-2.5 py-1">
                            {project.publishedAt ? firstOpenLabel(firstHandoverOpenEvent) : "Not published yet"}
                          </span>
                        </div>
                      </button>
                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        <button
                          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-cyan-700 px-3 text-xs font-semibold text-white hover:bg-cyan-800"
                          onClick={() => setSelectedProjectId(project.id)}
                          type="button"
                        >
                          <Pencil className="size-4" />
                          Open workspace
                        </button>
                        <button
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => open("send", project.id)}
                          type="button"
                        >
                          <Send className="size-4" />
                          Send package
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>

      {mode ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              close();
            }
          }}
        >
          <section className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-cyan-700">{getModalEyebrow(mode)}</p>
                <h2 className="mt-1 text-xl font-semibold tracking-normal text-slate-950">{getModalTitle(mode, selectedProject)}</h2>
              </div>
              <button
                aria-label="Close"
                className="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                onClick={close}
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-5">
              {mode === "help" ? <HelpPanel /> : null}
              {mode === "create" ? (
                <ProjectCreateForm
                  filteredProducts={filteredProducts}
                  creditStatus={creditStatus}
                  productQuery={productQuery}
                  setDirty={setIsDirty}
                  setProductQuery={setProductQuery}
                />
              ) : null}
              {mode === "send" && selectedProject && selectedSnapshot ? (
                <SendPackagePanel project={selectedProject} snapshot={selectedSnapshot} />
              ) : null}
              {mode === "clientAccess" && selectedProject && selectedSnapshot ? (
                <ClientAccessPanel project={selectedProject} snapshot={selectedSnapshot} />
              ) : null}
              {mode === "addItem" && selectedProject ? (
                <AddHandoverItemForm productVersions={filteredProducts} projectId={selectedProject.id} setDirty={setIsDirty} />
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function ProjectCreateForm({
  creditStatus,
  filteredProducts,
  productQuery,
  setDirty,
  setProductQuery,
}: {
  creditStatus: ProjectsWorkspaceProps["creditStatus"];
  filteredProducts: ProductVersion[];
  productQuery: string;
  setDirty: (dirty: boolean) => void;
  setProductQuery: (value: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <form action={createProjectAction} className="rounded-lg border border-slate-200 p-4" onChange={() => setDirty(true)}>
        <h3 className="font-semibold text-slate-950">Project and client</h3>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <TextField label="Project name" name="name" placeholder="Bayview Road New Build" required />
          <SelectField label="Project type" name="projectType" options={projectTypeOptions} required />
          <TextField label="Property address" name="address" placeholder="18 Bayview Road, Tauranga" required />
          <TextField label="Target handover date" name="handoverDate" type="date" />
          <TextField label="Client name" name="clientName" placeholder="Amelia and Noah Smith" required />
          <TextField label="Client email" name="clientEmail" placeholder="client@example.co.nz" required type="email" />
        </div>
        <div className="mt-5 rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm leading-6 text-cyan-900">
          Save the project first, then add handover items from the project workspace. Spec sheet automation is coming later.
        </div>
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">Project credit confirmation</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Creating a project uses {creditStatus.projectCost} project credit.{" "}
                {creditStatus.unlimited
                  ? `${creditStatus.email} has unlimited test credits.`
                  : "Stripe credit purchasing will be connected before paid launch."}
              </p>
            </div>
            <span className="w-fit rounded-md border border-cyan-200 bg-white px-2.5 py-1 text-xs font-semibold text-cyan-800">
              {creditStatus.unlimited ? "Infinite" : `${creditStatus.availableCredits} credits`}
            </span>
          </div>
          <label className="mt-4 flex gap-3 text-sm text-slate-700">
            <input className="mt-1 size-4 accent-cyan-700" name="creditConfirmed" required type="checkbox" />
            <span>I confirm this project can use one project credit.</span>
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <SubmitButton icon={Plus} label="Save project" />
        </div>
      </form>
      <ProjectSideTools
        filteredProducts={filteredProducts}
        productQuery={productQuery}
        setProductQuery={setProductQuery}
      />
    </div>
  );
}

function ProjectEditPanel({
  onAddItem,
  onBack,
  onClientAccess,
  onSend,
  project,
  setDirty,
  snapshot,
}: {
  onAddItem: () => void;
  onBack: () => void;
  onClientAccess: () => void;
  onSend: () => void;
  project: Project;
  setDirty: (dirty: boolean) => void;
  snapshot: {
    downloadEvents: DocumentDownloadEvent[];
    firstHandoverOpenEvent?: HandoverOpenEvent;
    handoverOpenEvents: HandoverOpenEvent[];
    documents: HandoverDocument[];
    checklist: ProjectHandoverChecklistItem[];
    tasks: MaintenanceTask[];
  };
}) {
  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" id="project-overview">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button className="text-sm font-semibold text-cyan-700 hover:text-cyan-900" onClick={onBack} type="button">
              ← Back to projects
            </button>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-normal text-slate-950">{project.name}</h2>
              <StatusPill variant={project.status} />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{project.address}</p>
            <p className="mt-1 text-sm text-slate-500">
              {project.clientName} · {project.projectType} · Target handover {formatDate(project.handoverDate)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onClientAccess}
              type="button"
            >
              <Link2 className="size-4" />
              Client access
            </button>
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800"
              onClick={onSend}
              type="button"
            >
              <Send className="size-4" />
              Send package
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <ChecklistMetric label="Checklist items" value={snapshot.checklist.length} />
          <ChecklistMetric label="Ready / accepted" value={snapshot.checklist.filter((item) => item.status === "complete" || item.status === "user_accepted_incomplete").length} />
          <ChecklistMetric label="Client docs" value={snapshot.documents.length} />
        </div>
        <nav className="mt-4 flex gap-1.5 overflow-x-auto border-t border-slate-100 pt-3" aria-label="Project workspace sections">
          {projectWorkspaceTabs.map((tab) => (
            <a
              className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
              href={tab.href}
              key={tab.id}
            >
              {tab.label}
            </a>
          ))}
        </nav>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" id="project-documents">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
              <form action={updateProjectAction} onChange={() => setDirty(true)}>
                <input name="projectId" type="hidden" value={project.id} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-950">Project details</h3>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">Core project and client information.</p>
                  </div>
                  <SubmitButton icon={Pencil} label="Save" />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <TextField label="Project name" name="name" defaultValue={project.name} required />
                  <SelectField label="Project type" name="projectType" defaultValue={project.projectType} options={projectTypeOptions} required />
                  <TextField label="Property address" name="address" defaultValue={project.address} required />
                  <TextField label="Target handover date" name="handoverDate" defaultValue={project.handoverDate?.slice(0, 10)} type="date" />
                  <TextField label="Client name" name="clientName" defaultValue={project.clientName} required />
                  <TextField label="Client email" name="clientEmail" defaultValue={project.clientEmail} required type="email" />
                </div>
              </form>

              <form action={createDocumentAction} className="rounded-md border border-slate-200 bg-slate-50 p-3" encType="multipart/form-data" onChange={() => setDirty(true)}>
                <input name="projectId" type="hidden" value={project.id} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-950">Add client document</h3>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">Warranty, manual, consent, photo, or reference.</p>
                  </div>
                  <SubmitButton icon={Upload} label="Save" />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <TextField label="Title" name="name" placeholder="Window warranty" />
                  <SelectField
                    label="Type"
                    name="documentType"
                    options={[
                      { label: "Consent", value: "consent" },
                      { label: "Manual", value: "manual" },
                      { label: "Warranty", value: "warranty" },
                      { label: "Producer statement", value: "producer_statement" },
                      { label: "Photo", value: "photo" },
                      { label: "Other", value: "other" },
                    ]}
                    required
                  />
                  <input name="visibleToClient" type="hidden" value="on" />
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-medium text-slate-700">File</span>
                    <input
                      className="mt-1 block h-9 w-full cursor-pointer rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 file:mr-3 file:h-6 file:rounded-md file:border-0 file:bg-cyan-700 file:px-3 file:text-xs file:font-semibold file:text-white hover:border-cyan-300"
                      name="documentFile"
                      required
                      type="file"
                    />
                  </label>
                </div>
              </form>
            </div>
          </section>

      <div id="project-items">
        <ProjectHandoverChecklistSection
          checklist={snapshot.checklist}
          onAddItem={onAddItem}
          setDirty={setDirty}
        />
      </div>

      <SpecAutomationComingSoon />

      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">Documents in this project</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {snapshot.documents.length ? snapshot.documents.map((document) => {
            const documentDownloads = snapshot.downloadEvents.filter((event) => event.documentId === document.id);
            const latestDownload = documentDownloads[0];

            return (
              <div className="rounded-md border border-slate-200 p-3" key={document.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-950">{document.name}</p>
                    <p className="mt-1 text-sm capitalize text-slate-600">{document.type.replaceAll("_", " ")}</p>
                  </div>
                  <StatusPill variant={document.visibleToClient ? "client_visible" : "private"} />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {document.size} - Uploaded {formatDate(document.uploadedAt)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {documentDownloads.length
                    ? `${documentDownloads.length} download${documentDownloads.length === 1 ? "" : "s"} - last ${formatDate(latestDownload.downloadedAt)}`
                    : "No downloads recorded yet"}
                </p>
                {document.storagePath ? (
                  <a
                    className="mt-4 inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    href={`/api/documents/${document.id}/download`}
                  >
                    Download
                  </a>
                ) : null}
              </div>
            );
          }) : <p className="text-sm text-slate-500">No client documents have been added yet.</p>}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">Maintenance in this project</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {snapshot.tasks.length ? snapshot.tasks.map((task) => (
            <div className="rounded-md border border-slate-200 p-3" key={task.id}>
              <p className="font-medium text-slate-950">{task.title}</p>
              <p className="mt-1 text-sm text-slate-600">{task.relatedProduct}</p>
              <p className="mt-2 text-xs text-slate-500">Due {formatDate(task.dueDate)} - {task.cadence}</p>
            </div>
          )) : <p className="text-sm text-slate-500">No maintenance tasks have been created for this project yet.</p>}
        </div>
      </section>
        </div>
        <ProjectWorkspaceSidebar onClientAccess={onClientAccess} project={project} snapshot={snapshot} />
      </div>
    </div>
  );
}

function SpecAutomationComingSoon() {
  return (
    <section className="rounded-xl border border-dashed border-cyan-300 bg-cyan-50/70 p-4" id="project-spec-automation">
      <p className="text-sm font-semibold text-cyan-800">Spec sheet automation</p>
      <h3 className="mt-1 text-base font-semibold text-slate-950">Coming soon</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
        Automated spec sheet reading, checking, and pre-filled handover suggestions will return later as a separate module. For this demo branch, the reliable path is manual item entry plus product-database autofill.
      </p>
    </section>
  );
}

function ClientAccessPanel({
  project,
  snapshot,
}: {
  project: Project;
  snapshot: {
    firstHandoverOpenEvent?: HandoverOpenEvent;
  };
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-cyan-700">Client portal access</p>
        <h3 className="mt-1 text-base font-semibold text-slate-950">Invite and access controls</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Keep client access separate from the main project page. Use this only when you are ready to invite, resend, revoke, or check package access.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Invite status</p>
          <p className="mt-2 text-sm font-semibold text-slate-950">{formatInviteStatus(project.clientInviteStatus, project.clientInvitedAt)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Handover first opened</p>
          <p className="mt-2 text-sm font-semibold text-slate-950">{project.publishedAt ? firstOpenDate(snapshot.firstHandoverOpenEvent) : "Not published yet"}</p>
        </div>
      </div>
      {snapshot.firstHandoverOpenEvent ? (
        <p className="rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600">
          Privacy-light package record only: opened {snapshot.firstHandoverOpenEvent.openCount} time{snapshot.firstHandoverOpenEvent.openCount === 1 ? "" : "s"} total. No page or item-level tracking is shown here.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {project.clientInviteStatus === "accepted" ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            The client has accepted this invite.
          </p>
        ) : (
          <>
            <form action={sendClientInviteEmailAction}>
              <input name="projectId" type="hidden" value={project.id} />
              <SubmitButton
                icon={Send}
                label={project.clientInviteStatus === "invited" ? "Resend invite email" : "Email invite"}
              />
            </form>
            <form action={createClientInviteAction}>
              <input name="projectId" type="hidden" value={project.id} />
              <SubmitButton
                icon={Link2}
                label={project.clientInviteStatus === "invited" ? "Regenerate link" : "Create link"}
              />
            </form>
          </>
        )}
        {project.clientInviteStatus === "invited" ? (
          <form action={revokeClientInviteAction}>
            <input name="projectId" type="hidden" value={project.id} />
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50"
              type="submit"
            >
              Revoke
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}

function ProjectWorkspaceSidebar({
  onClientAccess,
  project,
  snapshot,
}: {
  onClientAccess: () => void;
  project: Project;
  snapshot: {
    checklist: ProjectHandoverChecklistItem[];
    documents: HandoverDocument[];
    firstHandoverOpenEvent?: HandoverOpenEvent;
  };
}) {
  const incompleteItems = snapshot.checklist.filter((item) => item.status !== "complete" && item.status !== "user_accepted_incomplete");
  const needsReviewItems = snapshot.checklist.filter((item) => item.status === "needs_review" || item.sectionStatuses.careInstructions === "autofilled_needs_review" || item.sectionStatuses.manual === "autofilled_needs_review" || item.sectionStatuses.warranty === "autofilled_needs_review");
  const missingManualCount = snapshot.checklist.filter((item) => item.sectionStatuses.manual === "missing" || item.status === "missing_manual").length;
  const missingWarrantyCount = snapshot.checklist.filter((item) => item.sectionStatuses.warranty === "missing" || item.status === "missing_warranty_information").length;
  const missingComplianceCount = snapshot.checklist.filter((item) => item.sectionStatuses.codeCompliance === "missing" || item.status === "missing_code_compliance_information").length;
  const categoryCounts = Array.from(
    snapshot.checklist.reduce((counts, item) => {
      const category = item.category || "Uncategorised";
      const current = counts.get(category) || { total: 0, ready: 0 };
      current.total += 1;
      if (item.status === "complete" || item.status === "user_accepted_incomplete") {
        current.ready += 1;
      }
      counts.set(category, current);
      return counts;
    }, new Map<string, { total: number; ready: number }>()),
  ).sort((left, right) => right[1].total - left[1].total || left[0].localeCompare(right[0]));
  const hasDocumentType = (type: HandoverDocument["type"]) => snapshot.documents.some((document) => document.type === type && document.visibleToClient);
  const documentRequirements = [
    {
      label: "Code Compliance Certificate / consent",
      present: hasDocumentType("consent") || missingComplianceCount === 0 && snapshot.checklist.length > 0,
      note: "Confirm CCC, consents, producer statements, or compliance evidence before handover.",
    },
    {
      label: "Product warranties",
      present: hasDocumentType("warranty") || missingWarrantyCount === 0 && snapshot.checklist.length > 0,
      note: "Attach warranty files or review warranty text for items where required.",
    },
    {
      label: "Manuals and care guides",
      present: hasDocumentType("manual") || missingManualCount === 0 && snapshot.checklist.length > 0,
      note: "Upload manufacturer manuals or confirm reviewed care guidance.",
    },
    {
      label: "Producer statements / inspection records",
      present: hasDocumentType("producer_statement"),
      note: "Add PS documents, inspection records, or mark as not required where applicable.",
    },
    {
      label: "Photos / supporting evidence",
      present: hasDocumentType("photo") || snapshot.checklist.some((item) => item.sectionStatuses.supportingDocuments !== "missing"),
      note: "Photos are useful for finishes, locations, installed products, and client context.",
    },
  ];

  return (
    <aside className="space-y-3 xl:sticky xl:top-6 xl:self-start">
      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Client access</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{formatInviteStatus(project.clientInviteStatus, project.clientInvitedAt)}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              First opened: {project.publishedAt ? firstOpenDate(snapshot.firstHandoverOpenEvent) : "Not published yet"}
            </p>
          </div>
          <button
            className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClientAccess}
            type="button"
          >
            Manage
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-950">To be completed</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Builder-facing checklist only. These do not need editing here; use the item cards on the left.</p>
        <div className="mt-3 space-y-1.5">
          <SidebarStatusRow label="Items still incomplete" value={incompleteItems.length} tone={incompleteItems.length ? "amber" : "emerald"} />
          <SidebarStatusRow label="Autofill checks" value={needsReviewItems.length} tone={needsReviewItems.length ? "amber" : "emerald"} />
          <SidebarStatusRow label="Manuals missing" value={missingManualCount} tone={missingManualCount ? "rose" : "emerald"} />
          <SidebarStatusRow label="Warranties missing" value={missingWarrantyCount} tone={missingWarrantyCount ? "rose" : "emerald"} />
          <SidebarStatusRow label="Compliance docs missing" value={missingComplianceCount} tone={missingComplianceCount ? "rose" : "emerald"} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-950">Documents to upload / confirm</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Common NZ handover/legal pack items to confirm with the builder. Not legal advice.</p>
        <div className="mt-3 space-y-2">
          {documentRequirements.map((requirement) => (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5" key={requirement.label}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">{requirement.label}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${requirement.present ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                  {requirement.present ? "Covered" : "Check"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{requirement.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-950">Item categories</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Category spread for this project checklist.</p>
        <div className="mt-3 space-y-1.5">
          {categoryCounts.length ? categoryCounts.map(([category, counts]) => (
            <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs" key={category}>
              <span className="font-medium text-slate-700">{category}</span>
              <span className="text-xs text-slate-500">{counts.ready}/{counts.total} ready</span>
            </div>
          )) : <p className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">No item categories yet.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
        <p className="text-sm font-semibold text-cyan-950">Spec sheet automation</p>
        <p className="mt-2 text-xs leading-5 text-cyan-900">
          Coming soon. This branch is focused on manual item entry and database autofill only.
        </p>
      </section>
    </aside>
  );
}

function SidebarStatusRow({ label, tone, value }: { label: string; tone: "amber" | "emerald" | "rose"; value: number }) {
  const toneClasses = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <div className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs ${toneClasses[tone]}`}>
      <span className="font-medium">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function getChecklistMetadataValue(item: ProjectHandoverChecklistItem, key: string) {
  const value = item.sourceMetadata?.[key];
  return typeof value === "string" ? value : "";
}

function getChecklistSourceLabel(item: ProjectHandoverChecklistItem) {
  if (item.valueSources.includes("database_autofill")) return "Database autofill";
  if (item.valueSources.includes("extracted_document")) return "Previous import";
  if (item.valueSources.includes("manual_upload")) return "Manual upload";
  return "Manual";
}

function getChecklistSourceFilter(item: ProjectHandoverChecklistItem) {
  if (item.valueSources.includes("database_autofill")) return "database_autofill";
  if (item.valueSources.includes("extracted_document")) return "imported";
  return "manual";
}

function productToChecklistDraft(product: ProductVersion) {
  const manualSource = product.sources.find((source) => source.sourceType.includes("manual")) || product.sources[0];
  const warrantyText = [
    product.warrantyPeriod ? `Warranty: ${product.warrantyPeriod}` : null,
    product.voidConditions && product.voidConditions !== "Not captured yet" ? `Notes/void conditions: ${product.voidConditions}` : null,
  ].filter(Boolean).join("\n");

  return {
    title: product.productName,
    category: product.category,
    brand: product.brand,
    manufacturer: product.brand,
    model: "",
    productCode: "",
    supplier: "",
    supplierSku: "",
    location: product.location,
    quantity: "",
    finish: "",
    colour: "",
    careInstructions: product.maintenanceSummary,
    manualUrl: manualSource?.url || "",
    warrantyInformation: warrantyText,
    invoiceData: "",
    codeComplianceInformation: "",
    supportingDocumentsNote: product.sources.length ? `Database sources available: ${product.sources.map((source) => source.title).join(", ")}` : "",
    extraNotes: product.reviewReason,
  };
}

function formatProductSuggestion(product: ProductVersion) {
  return [product.productName, product.brand, product.category].filter(Boolean).join(" · ");
}

function formatChecklistStatus(status: ProjectHandoverChecklistItem["status"]) {
  const labels: Record<ProjectHandoverChecklistItem["status"], string> = {
    complete: "Complete",
    needs_review: "Needs checking",
    missing_manual: "Missing manual",
    missing_care_instructions: "Missing care instructions",
    missing_warranty_information: "Missing warranty information",
    missing_invoice_information: "Missing invoice information",
    missing_code_compliance_information: "Missing Code of Compliance",
    not_enough_information_to_search: "Not enough information to search",
    documents_uploaded_manually: "Documents uploaded manually",
    user_accepted_incomplete: "User accepted incomplete",
  };

  return labels[status] || status.replaceAll("_", " ");
}

function checklistStatusStyles(status: ProjectHandoverChecklistItem["status"]) {
  if (status === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "user_accepted_incomplete") return "border-purple-200 bg-purple-50 text-purple-800";
  if (status === "not_enough_information_to_search") return "border-amber-200 bg-amber-50 text-amber-900";
  if (status.startsWith("missing_")) return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "documents_uploaded_manually") return "border-cyan-200 bg-cyan-50 text-cyan-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function AddHandoverItemForm({
  productVersions,
  projectId,
  setDirty,
}: {
  productVersions: ProductVersion[];
  projectId: string;
  setDirty: (dirty: boolean) => void;
}) {
  const emptyDraft = {
    title: "",
    category: "",
    brand: "",
    manufacturer: "",
    model: "",
    productCode: "",
    supplier: "",
    supplierSku: "",
    location: "",
    quantity: "",
    finish: "",
    colour: "",
    careInstructions: "",
    manualUrl: "",
    warrantyInformation: "",
    invoiceData: "",
    codeComplianceInformation: "",
    supportingDocumentsNote: "",
    extraNotes: "",
  };
  const [draft, setDraft] = useState(emptyDraft);
  const [selectedProduct, setSelectedProduct] = useState<ProductVersion | null>(null);
  const approvedProducts = productVersions.filter((product) => product.status === "approved");
  const productMatches = approvedProducts
    .filter((product) => {
      const query = draft.title.trim().toLowerCase();
      if (!query) return false;
      return `${product.productName} ${product.brand} ${product.category} ${product.reviewReason}`.toLowerCase().includes(query);
    })
    .slice(0, 6);

  function updateDraft(key: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function applySuggestion(product: ProductVersion) {
    setSelectedProduct(product);
    setDraft(productToChecklistDraft(product));
    setDirty(true);
  }

  function clearSuggestion() {
    setSelectedProduct(null);
    setDraft(emptyDraft);
    setDirty(false);
  }

  const submitLabel = selectedProduct ? "Add with database autofill" : "Add item";

  return (
    <form action={createProjectHandoverChecklistItemAction} className="space-y-4" onChange={() => setDirty(true)}>
      <input name="projectId" type="hidden" value={projectId} />
      <input name="selectedProductId" type="hidden" value={selectedProduct?.id || ""} />
      <input name="selectedProductLabel" type="hidden" value={selectedProduct ? formatProductSuggestion(selectedProduct) : ""} />
      <div>
        <p className="text-sm font-semibold text-cyan-700">Database autofill + manual entry</p>
        <h3 className="mt-1 text-base font-semibold text-slate-950">Add handover item</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Type the item details below. Matching database suggestions appear automatically and can autofill known fields, or you can keep typing and add the item manually.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ChecklistTextInput label="Item name" name="title" onChange={(value) => updateDraft("title", value)} placeholder="e.g. Fisher & Paykel oven" required value={draft.title} />
        <ChecklistSelectInput label="Category" name="category" onChange={(value) => updateDraft("category", value)} options={handoverCategoryOptions} value={draft.category} />
        <ChecklistTextInput label="Location" name="location" onChange={(value) => updateDraft("location", value)} placeholder="Kitchen, ensuite, exterior" value={draft.location} />
        <ChecklistTextInput label="Brand / manufacturer" name="brand" onChange={(value) => updateDraft("brand", value)} placeholder="Fisher & Paykel" value={draft.brand} />
        <ChecklistTextInput label="Model" name="model" onChange={(value) => updateDraft("model", value)} placeholder="OB60..." value={draft.model} />
        <ChecklistTextInput label="SKU / product code" name="productCode" onChange={(value) => updateDraft("productCode", value)} value={draft.productCode} />
        <ChecklistTextInput label="Supplier" name="supplier" onChange={(value) => updateDraft("supplier", value)} value={draft.supplier} />
        <ChecklistTextInput label="Supplier SKU" name="supplierSku" onChange={(value) => updateDraft("supplierSku", value)} value={draft.supplierSku} />
        <ChecklistTextInput label="Quantity" name="quantity" onChange={(value) => updateDraft("quantity", value)} value={draft.quantity} />
        <ChecklistTextInput label="Finish / colour" name="finish" onChange={(value) => updateDraft("finish", value)} value={draft.finish} />
        <input name="colour" type="hidden" value={draft.colour} />
      </div>

      {draft.title.trim() ? (
        <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-cyan-800">Database suggestions</p>
          <div className="mt-3 space-y-2">
            {productMatches.length ? productMatches.map((product) => (
              <button
                className={`w-full rounded-md border p-3 text-left text-sm hover:border-cyan-400 hover:bg-white ${selectedProduct?.id === product.id ? "border-cyan-500 bg-white" : "border-slate-200 bg-white/80"}`}
                key={product.id}
                onClick={() => applySuggestion(product)}
                type="button"
              >
                <span className="font-semibold text-slate-950">{product.productName}</span>
                <span className="mt-1 block text-xs text-slate-600">{product.brand} · {product.category} · {product.confidenceScore}% approved database record</span>
                <span className="mt-1 block text-xs text-cyan-800">Autofills care/manual/warranty where known; builder must check.</span>
              </button>
            )) : <p className="text-sm text-slate-500">No approved product suggestion yet. You can still create the item manually.</p>}
          </div>
          {selectedProduct ? (
            <button className="mt-3 text-xs font-semibold text-slate-600 underline" onClick={clearSuggestion} type="button">
              Clear selected suggestion and continue manually
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3">
        <ChecklistTextarea label="Care instructions" name="careInstructions" onChange={(value) => updateDraft("careInstructions", value)} value={draft.careInstructions} />
        <ChecklistTextInput label="Manual link/reference" name="manualUrl" onChange={(value) => updateDraft("manualUrl", value)} value={draft.manualUrl} />
        <ChecklistTextarea label="Warranty information" name="warrantyInformation" onChange={(value) => updateDraft("warrantyInformation", value)} value={draft.warrantyInformation} />
        <ChecklistTextarea label="Invoice / purchase info" name="invoiceData" onChange={(value) => updateDraft("invoiceData", value)} value={draft.invoiceData} />
        <ChecklistTextarea label="Code of Compliance / compliance docs" name="codeComplianceInformation" onChange={(value) => updateDraft("codeComplianceInformation", value)} value={draft.codeComplianceInformation} />
        <ChecklistTextarea label="Supporting documents/photos note" name="supportingDocumentsNote" onChange={(value) => updateDraft("supportingDocumentsNote", value)} value={draft.supportingDocumentsNote} />
        <ChecklistTextarea label="Builder notes" name="extraNotes" onChange={(value) => updateDraft("extraNotes", value)} value={draft.extraNotes} />
      </div>
      <div className="flex justify-end border-t border-slate-100 pt-4">
        <SubmitButton icon={Plus} label={submitLabel} />
      </div>
    </form>
  );
}

function ProjectHandoverChecklistSection({
  checklist,
  onAddItem,
  setDirty,
}: {
  checklist: ProjectHandoverChecklistItem[];
  onAddItem: () => void;
  setDirty: (dirty: boolean) => void;
}) {
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    category: "all",
    missing: "all",
    source: "all",
    review: "all",
  });
  const completeCount = checklist.filter((item) => item.status === "complete").length;
  const acceptedIncompleteCount = checklist.filter((item) => item.status === "user_accepted_incomplete").length;
  const missingCount = checklist.filter((item) => item.status.startsWith("missing_")).length;
  const notEnoughCount = checklist.filter((item) => item.status === "not_enough_information_to_search").length;
  const needsReviewCount = checklist.filter((item) => item.status === "needs_review" || item.status === "documents_uploaded_manually").length;
  const categoryOptions = Array.from(new Set(checklist.map((item) => item.category).filter(Boolean) as string[])).sort();
  const filteredChecklist = checklist.filter((item) => {
    const searchHaystack = [
      item.title,
      item.category,
      item.brand,
      item.manufacturer,
      item.model,
      item.productCode,
      item.sku,
      item.supplier,
      getChecklistMetadataValue(item, "location"),
      getChecklistMetadataValue(item, "finish"),
      getChecklistMetadataValue(item, "colour"),
    ].filter(Boolean).join(" ").toLowerCase();
    const missingSections = getMissingChecklistSections(item);
    const source = getChecklistSourceFilter(item);
    const reviewState = item.status === "complete"
      ? "complete"
      : item.status === "user_accepted_incomplete"
        ? "accepted_incomplete"
        : item.status === "needs_review" || item.sectionStatuses.careInstructions === "autofilled_needs_review" || item.sectionStatuses.manual === "autofilled_needs_review" || item.sectionStatuses.warranty === "autofilled_needs_review"
          ? "needs_review"
          : "incomplete";

    return (
      (!filters.search || searchHaystack.includes(filters.search.toLowerCase())) &&
      (filters.status === "all" || item.status === filters.status || (filters.status === "missing" && item.status.startsWith("missing_"))) &&
      (filters.category === "all" || item.category === filters.category) &&
      (filters.missing === "all" || missingSections.some((section) => section.toLowerCase().includes(filters.missing.toLowerCase()))) &&
      (filters.source === "all" || source === filters.source) &&
      (filters.review === "all" || reviewState === filters.review)
    );
  });


  return (
    <section className="rounded-lg border border-cyan-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Manual project checklist</p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">Add, autofill, check, and complete handover items</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">
            This branch makes manual entry the happy path. Product database suggestions can autofill care/manual/warranty fields, but every autofilled value remains editable before it reaches the homeowner portal. Spec sheet automation is parked in the coming-soon section.
          </p>
        </div>
        <div className="space-y-3">
          <button
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-cyan-700 px-3 text-xs font-semibold text-white hover:bg-cyan-800"
            onClick={onAddItem}
            type="button"
          >
            <Plus className="size-4" />
            Add handover item
          </button>
          <div className="grid min-w-64 grid-cols-3 gap-1.5 text-[11px] sm:grid-cols-5 xl:grid-cols-2">
          <ChecklistMetric label="Items" value={checklist.length} />
          <ChecklistMetric label="Complete" value={completeCount} />
          <ChecklistMetric label="Needs checking" value={needsReviewCount} />
          <ChecklistMetric label="Missing" value={missingCount} />
          <ChecklistMetric label="Too vague" value={notEnoughCount} />
          <ChecklistMetric label="Accepted incomplete" value={acceptedIncompleteCount} />
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-sm font-semibold text-slate-950">Checklist filters</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              <ChecklistTextInput label="Search" name="filterSearch" onChange={(value) => setFilters((current) => ({ ...current, search: value }))} placeholder="Name, brand, room, supplier" value={filters.search} />
              <ChecklistFilterSelect label="Status" onChange={(value) => setFilters((current) => ({ ...current, status: value }))} value={filters.status} options={[{ label: "All statuses", value: "all" }, { label: "Complete", value: "complete" }, { label: "Needs checking", value: "needs_review" }, { label: "Missing info", value: "missing" }, { label: "Accepted incomplete", value: "user_accepted_incomplete" }, { label: "Not enough identity", value: "not_enough_information_to_search" }]} />
              <ChecklistFilterSelect label="Category" onChange={(value) => setFilters((current) => ({ ...current, category: value }))} value={filters.category} options={[{ label: "All categories", value: "all" }, ...categoryOptions.map((category) => ({ label: category, value: category }))]} />
              <ChecklistFilterSelect label="Missing section" onChange={(value) => setFilters((current) => ({ ...current, missing: value }))} value={filters.missing} options={[{ label: "Any section", value: "all" }, { label: "Care", value: "care" }, { label: "Manual", value: "manual" }, { label: "Warranty", value: "warranty" }, { label: "Invoice", value: "invoice" }, { label: "Compliance", value: "Compliance" }, { label: "Supporting docs", value: "supporting" }]} />
              <ChecklistFilterSelect label="Source" onChange={(value) => setFilters((current) => ({ ...current, source: value }))} value={filters.source} options={[{ label: "All sources", value: "all" }, { label: "Manual", value: "manual" }, { label: "Database autofill", value: "database_autofill" }, { label: "Previous import", value: "imported" }]} />
              <ChecklistFilterSelect label="Completion state" onChange={(value) => setFilters((current) => ({ ...current, review: value }))} value={filters.review} options={[{ label: "Any completion state", value: "all" }, { label: "Needs checking", value: "needs_review" }, { label: "Complete", value: "complete" }, { label: "Accepted incomplete", value: "accepted_incomplete" }, { label: "Incomplete", value: "incomplete" }]} />
            </div>
          </div>
          {filteredChecklist.length ? filteredChecklist.map((item) => <ProjectHandoverChecklistCard item={item} key={item.id} setDirty={setDirty} />) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-xs leading-6 text-slate-600">
              No checklist items match these filters. Add a manual item or clear filters.
            </div>
          )}
        </div>
    </section>
  );
}

function ChecklistTextInput({
  label,
  name,
  onChange,
  placeholder,
  required,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-950 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        value={value}
      />
    </label>
  );
}

function ChecklistTextarea({
  label,
  name,
  onChange,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className="mt-1 min-h-16 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function ChecklistSelectInput({
  label,
  name,
  onChange,
  options,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-950 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ChecklistFilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-950 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

const checklistSectionOptions = [
  { label: "Missing", value: "missing" },
  { label: "Provided", value: "provided" },
  { label: "Autofilled - needs checking", value: "autofilled_needs_review" },
  { label: "Checked / complete", value: "reviewed" },
  { label: "Uploaded manually", value: "uploaded_manually" },
  { label: "Accepted incomplete", value: "accepted_incomplete" },
  { label: "Not required", value: "not_required" },
];

function ChecklistMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ProjectHandoverChecklistCard({ item, setDirty }: { item: ProjectHandoverChecklistItem; setDirty: (dirty: boolean) => void }) {
  const missingSections = getMissingChecklistSections(item);
  const searchable = hasEnoughIdentityToSearch(item);
  const location = getChecklistMetadataValue(item, "location");
  const quantity = getChecklistMetadataValue(item, "quantity");
  const finish = getChecklistMetadataValue(item, "finish");
  const colour = getChecklistMetadataValue(item, "colour");
  const supportingDocumentsNote = getChecklistMetadataValue(item, "supporting_documents_note");
  const identity = [item.brand || item.manufacturer, item.model || item.productCode || item.sku, item.supplier].filter(Boolean).join(" · ");

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-slate-950">{item.title}</h4>
            <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${checklistStatusStyles(item.status)}`}>
              {formatChecklistStatus(item.status)}
            </span>
            <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800">
              {getChecklistSourceLabel(item)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {identity || "No brand/model/supplier detail yet"}{item.category ? ` · ${item.category}` : ""}{location ? ` · ${location}` : ""}
          </p>
          {[quantity, finish, colour].filter(Boolean).length ? (
            <p className="mt-1 text-xs text-slate-500">
              {[quantity ? `Qty: ${quantity}` : null, finish ? `Finish: ${finish}` : null, colour ? `Colour: ${colour}` : null].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
        <span className="w-fit rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
          Updated {formatDate(item.updatedAt)}
        </span>
      </div>

      {item.status === "not_enough_information_to_search" ? (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs leading-5 text-amber-900">
          <p className="font-semibold">Not enough information to search reliably.</p>
          <p>Add a brand/manufacturer, model, SKU/product code, supplier, invoice details, photo, or document before source search. You can still manually upload/enter the required handover information or accept this item incomplete.</p>
        </div>
      ) : null}

      {item.valueSources.includes("database_autofill") ? (
        <p className="mt-2 rounded-md border border-cyan-200 bg-cyan-50 p-2.5 text-xs leading-5 text-cyan-900">
          Autofilled from the database. Check and edit every section before treating it as homeowner-ready.
        </p>
      ) : null}

      {missingSections.length ? (
        <p className="mt-2 text-xs leading-5 text-slate-600">
          Missing or unchecked: {missingSections.join(", ")}.
        </p>
      ) : null}

      <div className="mt-2 grid gap-1.5 text-[11px] text-slate-600 sm:grid-cols-3">
        <ChecklistSectionStatus label="Care" status={item.sectionStatuses.careInstructions} />
        <ChecklistSectionStatus label="Manual" status={item.sectionStatuses.manual} />
        <ChecklistSectionStatus label="Warranty" status={item.sectionStatuses.warranty} />
        <ChecklistSectionStatus label="Invoice" status={item.sectionStatuses.invoice} />
        <ChecklistSectionStatus label="Code Compliance" status={item.sectionStatuses.codeCompliance} />
        <ChecklistSectionStatus label="Supporting docs" status={item.sectionStatuses.supportingDocuments} />
      </div>

      <details className="mt-3 rounded-md border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-slate-800">
          Check / edit item details
        </summary>
        <form action={updateProjectHandoverChecklistItemAction} className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-3" onChange={() => setDirty(true)}>
          <input name="itemId" type="hidden" value={item.id} />
          <input name="projectId" type="hidden" value={item.projectId} />
          <input name="selectedProductId" type="hidden" value={getChecklistMetadataValue(item, "matched_product_id")} />
          <input name="selectedProductLabel" type="hidden" value={getChecklistMetadataValue(item, "source_label")} />
          <TextField label="Identity / item name" name="title" defaultValue={item.title} required />
          <SelectField label="Category" name="category" defaultValue={item.category} options={getCategoryOptions(item.category)} />
          <TextField label="Location" name="location" defaultValue={location} />
          <TextField label="Manufacturer / brand" name="brand" defaultValue={item.brand || item.manufacturer} />
          <TextField label="Model" name="model" defaultValue={item.model} />
          <TextField label="SKU" name="sku" defaultValue={item.sku} />
          <TextField label="Product code" name="productCode" defaultValue={item.productCode} />
          <TextField label="Supplier" name="supplier" defaultValue={item.supplier} />
          <TextField label="Supplier SKU" name="supplierSku" defaultValue={item.supplierSku} />
          <TextField label="Quantity" name="quantity" defaultValue={quantity} />
          <TextField label="Finish" name="finish" defaultValue={finish} />
          <TextField label="Colour" name="colour" defaultValue={colour} />
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Care instructions</span>
            <textarea className="mt-1 min-h-16 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" defaultValue={item.careInstructions} name="careInstructions" />
          </label>
          <TextField label="Manual link/reference" name="manualUrl" defaultValue={item.manualUrl} />
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Warranty information</span>
            <textarea className="mt-1 min-h-16 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" defaultValue={item.warrantyInformation} name="warrantyInformation" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Invoice / purchase info</span>
            <textarea className="mt-1 min-h-16 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" defaultValue={item.invoiceData} name="invoiceData" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Code of Compliance / compliance docs</span>
            <textarea className="mt-1 min-h-16 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" defaultValue={item.codeComplianceInformation} name="codeComplianceInformation" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Supporting documents/photos</span>
            <textarea className="mt-1 min-h-16 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" defaultValue={supportingDocumentsNote} name="supportingDocumentsNote" />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Builder notes</span>
            <textarea className="mt-1 min-h-16 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100" defaultValue={item.extraNotes} name="extraNotes" />
          </label>
          <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 md:col-span-2 md:grid-cols-3">
            <ChecklistStatusSelect label="Care status" name="careInstructionsStatus" value={item.sectionStatuses.careInstructions} />
            <ChecklistStatusSelect label="Manual status" name="manualStatus" value={item.sectionStatuses.manual} />
            <ChecklistStatusSelect label="Warranty status" name="warrantyStatus" value={item.sectionStatuses.warranty} />
            <ChecklistStatusSelect label="Invoice status" name="invoiceStatus" value={item.sectionStatuses.invoice} />
            <ChecklistStatusSelect label="Compliance status" name="codeComplianceStatus" value={item.sectionStatuses.codeCompliance} />
            <ChecklistStatusSelect label="Supporting docs status" name="supportingDocumentsStatus" value={item.sectionStatuses.supportingDocuments} />
          </div>
          <TextField label="Accepted-incomplete reason / audit note" name="acceptedIncompleteReason" defaultValue={item.acceptedIncompleteReason} />
          <div className="flex justify-end md:col-span-2">
            <button className="inline-flex h-9 items-center rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800" type="submit">
              Save item details
            </button>
          </div>
        </form>
      </details>

      {item.acceptedIncompleteAt ? (
        <p className="mt-3 rounded-md border border-purple-200 bg-purple-50 p-3 text-sm leading-6 text-purple-900">
          User accepted incomplete on {formatDate(item.acceptedIncompleteAt)}{item.acceptedIncompleteReason ? `: ${item.acceptedIncompleteReason}` : "."}
        </p>
      ) : (
        <form action={acceptProjectHandoverChecklistItemIncompleteAction} className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2.5">
          <input name="itemId" type="hidden" value={item.id} />
          <input name="projectId" type="hidden" value={item.projectId} />
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-normal text-slate-500">Accept incomplete paper trail</span>
            <input
              className="mt-2 h-9 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              name="acceptedIncompleteReason"
              placeholder="e.g. User accepted item without manual; builder will supply if found later."
              required
            />
          </label>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs leading-5 text-slate-500">
              {searchable ? "Search may be possible later, but this branch does not use spec automation to finish the demo flow." : "Search is blocked until identity improves; accepting incomplete records that choice."}
            </p>
            <button className="shrink-0 rounded-md border border-purple-200 bg-white px-3 py-2 text-xs font-semibold text-purple-800 hover:bg-purple-50" type="submit">
              Accept incomplete
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

function ChecklistStatusSelect({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</span>
      <select className="mt-2 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-cyan-600" defaultValue={value} name={name}>
        {checklistSectionOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ChecklistSectionStatus({ label, status }: { label: string; status: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
      <span className="font-semibold text-slate-700">{label}: </span>
      <span>{status.replaceAll("_", " ")}</span>
    </div>
  );
}

function SendPackagePanel({
  project,
  snapshot,
}: {
  project: Project;
  snapshot: {
    checklist: ProjectHandoverChecklistItem[];
    tasks: MaintenanceTask[];
  };
}) {
  const readyChecklistItems = snapshot.checklist.filter((item) => item.status === "complete" || item.status === "user_accepted_incomplete");
  const packageReadyCount = readyChecklistItems.length;
  const canPublish = packageReadyCount > 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
      <section className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-950">Package checks</h3>
        <div className="mt-3 space-y-2">
          <CheckRow label={`${packageReadyCount} handover items ready or accepted incomplete`} ok={packageReadyCount > 0} />
          <CheckRow label={`${snapshot.tasks.length} maintenance tasks attached`} ok={snapshot.tasks.length > 0} />
        </div>
        <div className="mt-5 rounded-md border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-900">
          Spec sheet automation is coming soon. This package is built from manual checklist items and product-database autofill only.
        </div>
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">Final approval summary</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <span>{packageReadyCount} items included</span>
            <span>{readyChecklistItems.length} checklist items</span>
            <span>{snapshot.tasks.length} maintenance reminders scheduled</span>
          </div>
        </div>
        <form action={publishHandoverPackageAction} className="mt-3 space-y-2">
          <input name="projectId" type="hidden" value={project.id} />
          <label className="flex gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
            <input className="mt-1 size-4 accent-cyan-700" name="builderApprovalConfirmed" required type="checkbox" />
            <span>{builderHandoverApprovalText}</span>
          </label>
          <div className="flex justify-end">
            <SubmitButton disabled={!canPublish} icon={Send} label="Confirm and send package" />
          </div>
        </form>
      </section>
      <section className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm font-semibold text-cyan-700">Sending package</p>
        <h3 className="mt-1 font-semibold text-slate-950">{project.name}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The homeowner portal will show only published builder-confirmed package information for {project.clientName}.
        </p>
        {readyChecklistItems.length ? (
          <div className="mt-3 space-y-1.5">
            {readyChecklistItems.slice(0, 5).map((item) => (
              <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3" key={item.id}>
                <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1 text-xs text-cyan-900">
                  {item.category || "Project handover item"} - {formatChecklistStatus(item.status)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
            No checklist items are ready to send yet.
          </p>
        )}
      </section>
    </div>
  );
}

function ProjectSideTools({
  filteredProducts,
  productQuery,
  projectId,
  setProductQuery,
}: {
  filteredProducts: ProductVersion[];
  productQuery: string;
  projectId?: string;
  setProductQuery: (value: string) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <Search className="size-4 text-cyan-700" />
        <h3 className="font-semibold text-slate-950">Product search</h3>
      </div>
      <input
        className="mt-4 h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none ring-cyan-700/20 focus:border-cyan-700 focus:ring-4"
        onChange={(event) => setProductQuery(event.target.value)}
        placeholder="Search global or requested products"
        value={productQuery}
      />
      <div className="mt-4 max-h-52 space-y-2 overflow-y-auto">
        {filteredProducts.slice(0, 6).map((product) => (
          <div className="rounded-md border border-slate-200 p-3" key={product.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-950">{product.productName}</p>
                <p className="mt-1 text-xs text-slate-500">{product.brand} - {product.category}</p>
              </div>
              <StatusPill variant={product.status} />
            </div>
          </div>
        ))}
      </div>
      {projectId ? (
        <form action={createBuilderProjectRequestAction} className="mt-3 space-y-2">
          <input name="projectId" type="hidden" value={projectId} />
          <input name="requestType" type="hidden" value="product" />
          <TextField label="Request product" name="title" defaultValue={productQuery} placeholder="Brand, model, or product name" required />
          <TextField label="Location" name="location" placeholder="Kitchen, ensuite, exterior..." />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Details</span>
            <textarea
              className="mt-1 min-h-16 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-950 outline-none ring-cyan-700/20 placeholder:text-slate-400 focus:border-cyan-700 focus:ring-4"
              name="details"
              placeholder="What should be looked up or approved?"
            />
          </label>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            type="submit"
          >
            <Plus className="size-4" />
            Request missing item
          </button>
        </form>
      ) : (
        <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2.5 text-sm leading-6 text-slate-600">
          Save the project first, then request missing products from inside the project workspace.
        </p>
      )}
    </section>
  );
}

function HelpPanel() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <InfoCard
        icon={Plus}
        title="Create once"
        text="Start a project with client details first, then add handover items from the workspace."
      />
      <InfoCard
        icon={PackageCheck}
        title="Add checklist items"
        text="Use manual entry and product-database autofill as the main workflow on this branch."
      />
      <InfoCard
        icon={Layers3}
        title="Spec automation coming soon"
        text="Automated spec sheet reading and checking is parked as a future subsection, not part of this branch workflow."
      />
      <InfoCard
        icon={Send}
        title="Send after checks"
        text="Package sending asks the builder to confirm the handover has been checked before publishing."
      />
    </div>
  );
}

function InfoCard({
  icon: Icon,
  text,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  text: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <Icon className="size-5 text-cyan-700" />
      <h3 className="mt-3 font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <Icon className="size-5 text-cyan-700" />
      <p className="mt-3 text-sm font-semibold text-slate-950">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}

function InlineFlag({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 text-xs font-medium text-amber-800">
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 p-3 text-sm">
      {ok ? <PackageCheck className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-amber-600" />}
      <span className="text-slate-700">{label}</span>
    </div>
  );
}

function getModalEyebrow(mode: ModalMode) {
  if (mode === "create") {
    return "New project";
  }
  if (mode === "send") {
    return "Package confirmation";
  }
  if (mode === "clientAccess") {
    return "Client portal";
  }
  if (mode === "addItem") {
    return "Project checklist";
  }
  return "Projects help";
}

function getModalTitle(mode: ModalMode, project: Project | null) {
  if (mode === "create") {
    return "Add project";
  }
  if (mode === "send") {
    return `Send ${project?.name || "package"}`;
  }
  if (mode === "clientAccess") {
    return `Client access${project?.name ? ` - ${project.name}` : ""}`;
  }
  if (mode === "addItem") {
    return `Add item${project?.name ? ` - ${project.name}` : ""}`;
  }
  return "How projects work";
}

function formatInviteStatus(status?: string, invitedAt?: string) {
  if (status === "accepted") {
    return "Accepted";
  }

  if (status === "invited") {
    if (!invitedAt) {
      return "Invited";
    }

    const expiresAt = new Date(invitedAt);
    expiresAt.setDate(expiresAt.getDate() + 14);
    const isExpired = expiresAt < new Date();

    return `${isExpired ? "Expired" : "Invited"} ${formatDate(invitedAt)} - expires ${formatDate(expiresAt.toISOString())}`;
  }

  return "Not invited";
}

function firstOpenDate(event?: HandoverOpenEvent) {
  return event ? formatDate(event.firstOpenedAt) : "Not opened yet";
}

function firstOpenLabel(event?: HandoverOpenEvent) {
  return `First opened: ${firstOpenDate(event)}`;
}
