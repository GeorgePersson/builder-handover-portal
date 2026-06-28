"use client";

import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarCheck2,
  CheckCircle2,
  FileText,
  HelpCircle,
  Layers3,
  Link2,
  PackageCheck,
  Pencil,
  Plus,
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
  createClientInviteAction,
  createDocumentAction,
  createProjectAction,
  createProjectHandoverChecklistItemAction,
  updateProjectHandoverChecklistItemAction,
  publishHandoverPackageAction,
  revokeClientInviteAction,
  sendClientInviteEmailAction,
  updateProjectAction,
} from "@/lib/server/actions";
import { formatDate } from "@/lib/utils";
import {
  builderHandoverApprovalText,
} from "@/lib/handover-approval";
import { formatExposureZone, maintenanceSchedules } from "@/lib/maintenance-schedules";
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
import { getMissingChecklistSections } from "@/lib/project-handover-checklist";

type ProjectsWorkspaceProps = {
  draft?: string;
  error?: string;
  storage?: string;
  inviteToken?: string;
  initialProjectId?: string;
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

const projectWorkspaceTabs: Array<{ id: ProjectWorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "items", label: "Items" },
  { id: "documents", label: "Documents" },
  { id: "automation", label: "Spec automation" },
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

function tokenizeSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " ")
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function matchesSearchTokens(query: string, haystack: string) {
  const queryTokens = tokenizeSearch(query);
  if (!queryTokens.length) return true;

  const haystackTokens = tokenizeSearch(haystack);
  const haystackJoined = haystackTokens.join(" ");
  return queryTokens.every((token) => haystackTokens.includes(token) || haystackJoined.includes(token));
}

function getMaintenanceScheduleLabel(key?: string | null) {
  const schedule = maintenanceSchedules.find((candidate) => candidate.key === key);
  return schedule ? schedule.title : "No shared maintenance schedule";
}

const projectTypeOptions = [
  { label: "New residential build", value: "New residential build" },
  { label: "Full renovation", value: "Full renovation" },
  { label: "Bathroom renovation", value: "Bathroom renovation" },
  { label: "Kitchen renovation", value: "Kitchen renovation" },
  { label: "Reclad project", value: "Reclad project" },
  { label: "Roofing project", value: "Roofing project" },
];

const exposureZoneOptions = [
  { label: "Standard exposure", value: "standard" },
  { label: "Coastal / sea spray zone", value: "coastal_sea_spray" },
  { label: "Geothermal zone", value: "geothermal" },
  { label: "Coastal + geothermal exposure", value: "coastal_and_geothermal" },
];

const defaultHandoverGroups = [
  "Exterior",
  "Interior",
  "Kitchen",
  "Bathroom",
  "Bedrooms",
  "Electrical",
  "Plumbing",
  "Cladding",
  "Roofing",
  "General",
];

export function ProjectsWorkspace({
  draft,
  error,
  storage,
  inviteToken,
  initialProjectId,
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() =>
    initialProjectId && projects.some((project) => project.id === initialProjectId) ? initialProjectId : null,
  );
  const [isDirty, setIsDirty] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [initialAddCategory, setInitialAddCategory] = useState<string | undefined>(undefined);

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

    return matchesSearchTokens(query, `${product.productName} ${product.brand} ${product.category} ${product.reviewReason}`);
  });

  function open(nextMode: Exclude<ModalMode, null>, projectId?: string) {
    setMode(nextMode);
    setIsDirty(false);
    setProductQuery("");
    if (nextMode !== "addItem") {
      setInitialAddCategory(undefined);
    }
    if (projectId) {
      setSelectedProjectId(projectId);
    }
  }

  function openAddItem(projectId: string, category?: string) {
    setInitialAddCategory(category);
    open("addItem", projectId);
  }

  function close() {
    if (isDirty && !window.confirm("Close without saving these changes?")) {
      return;
    }

    setMode(null);
    setIsDirty(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-2 py-4 text-[13px] text-slate-950 sm:px-3 xl:px-4">
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
            onAddItem={(category) => openAddItem(selectedProject.id, category)}
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
                  creditStatus={creditStatus}
                  setDirty={setIsDirty}
                />
              ) : null}
              {mode === "send" && selectedProject && selectedSnapshot ? (
                <SendPackagePanel project={selectedProject} snapshot={selectedSnapshot} />
              ) : null}
              {mode === "clientAccess" && selectedProject && selectedSnapshot ? (
                <ClientAccessPanel project={selectedProject} snapshot={selectedSnapshot} />
              ) : null}
              {mode === "addItem" && selectedProject ? (
                <AddHandoverItemForm initialCategory={initialAddCategory} productVersions={filteredProducts} projectId={selectedProject.id} setDirty={setIsDirty} />
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
  setDirty,
}: {
  creditStatus: ProjectsWorkspaceProps["creditStatus"];
  setDirty: (dirty: boolean) => void;
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
          <TextField label="CCC granted date" name="cccGrantedDate" type="date" />
          <SelectField label="Exposure zone" name="exposureZone" defaultValue="standard" options={exposureZoneOptions} />
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
      <ProjectLegalAssurancePanel />
    </div>
  );
}

function ProjectLegalAssurancePanel() {
  const commitments = [
    "We keep the project handover record available for at least 10 years.",
    "Required legal and compliance documents stay organised with the project.",
    "When the service period ends, the homeowner receives the stored handover information by email for permanent safekeeping.",
  ];

  return (
    <section className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-cyan-700 shadow-sm">
          <CheckCircle2 className="size-5" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-950">Handover record promise</h3>
          <p className="mt-1 text-sm leading-6 text-cyan-900">
            Builder Handover keeps the homeowner’s final handover pack accessible, organised, and ready to pass on when they need it.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {commitments.map((commitment) => (
          <div className="flex gap-2 rounded-md border border-cyan-100 bg-white/80 p-3 text-sm leading-6 text-slate-700" key={commitment}>
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span>{commitment}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-md border border-slate-200 bg-white/80 p-3 text-xs leading-5 text-slate-600">
        This is service and record-retention information for the handover portal. Builders should still confirm any project-specific legal obligations with their normal professional advisers.
      </p>
    </section>
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
  onAddItem: (category?: string) => void;
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
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<ProjectWorkspaceTab>("overview");
  const showAllModules = activeWorkspaceTab === "overview";
  const showItemsModule = showAllModules || activeWorkspaceTab === "items";
  const showDocumentsModule = showAllModules || activeWorkspaceTab === "documents";
  const showAutomationModule = showAllModules || activeWorkspaceTab === "automation";

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
            <p className="mt-1 text-xs text-slate-500">
              CCC date {project.cccGrantedDate ? formatDate(project.cccGrantedDate) : "not set"} · {formatExposureZone(project.exposureZone)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
          {projectWorkspaceTabs.map((tab) => {
            const isActive = tab.id === activeWorkspaceTab;
            return (
              <button
                aria-pressed={isActive}
                className={`shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-cyan-300 bg-cyan-50 text-cyan-800 shadow-sm"
                    : "border-slate-200 bg-white text-cyan-950 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
                }`}
                key={tab.id}
                onClick={() => setActiveWorkspaceTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem] 2xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-4">
          {showAllModules ? (
            <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm" id="project-overview-details">
            <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.55fr)]">
              <form action={updateProjectAction} className="rounded-md border border-slate-200 bg-white p-3" onChange={() => setDirty(true)}>
                <input name="projectId" type="hidden" value={project.id} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-950">Project details</h3>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">Core project and client information.</p>
                  </div>
                  <SubmitButton icon={Pencil} label="Save" />
                </div>
                <div className="mt-3 grid gap-3">
                  <TextField label="Project name" name="name" defaultValue={project.name} required />
                  <SelectField label="Project type" name="projectType" defaultValue={project.projectType} options={projectTypeOptions} required />
                  <TextField label="Property address" name="address" defaultValue={project.address} required />
                  <TextField label="Target handover date" name="handoverDate" defaultValue={project.handoverDate?.slice(0, 10)} type="date" />
                  <TextField label="CCC granted date" name="cccGrantedDate" defaultValue={project.cccGrantedDate?.slice(0, 10)} type="date" />
                  <SelectField label="Exposure zone" name="exposureZone" defaultValue={project.exposureZone || "standard"} options={exposureZoneOptions} />
                  <TextField label="Client name" name="clientName" defaultValue={project.clientName} required />
                  <TextField label="Client email" name="clientEmail" defaultValue={project.clientEmail} required type="email" />
                </div>
              </form>

              <ProjectDocumentUploadForm
                description="Warranty, manual, consent, photo, or reference."
                projectId={project.id}
                setDirty={setDirty}
                title="Add client document"
              />
            </div>
          </section>
          ) : null}

          {showItemsModule ? (
      <div id="project-items">
        <ProjectHandoverChecklistSection
          checklist={snapshot.checklist}
          onAddItem={onAddItem}
          setDirty={setDirty}
        />
      </div>
          ) : null}

          {showAutomationModule ? <SpecAutomationComingSoon /> : null}

          {showDocumentsModule ? (
            <>
              {activeWorkspaceTab === "documents" ? (
                <ProjectDocumentUploadForm
                  className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 shadow-sm"
                  description="Upload Code Compliance Certificate/consent records, producer statements, warranties, manuals, inspection records, photos, or other required handover evidence. Files are client-visible by default."
                  projectId={project.id}
                  setDirty={setDirty}
                  title="Upload required handover document"
                />
              ) : null}
      <section className="rounded-lg border border-slate-200 p-4" id="project-documents">
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
            </>
          ) : null}
        </div>
        <ProjectWorkspaceSidebar onClientAccess={onClientAccess} project={project} snapshot={snapshot} />
      </div>
    </div>
  );
}

function ProjectDocumentUploadForm({
  className = "rounded-md border border-slate-200 bg-slate-50 p-3",
  description,
  projectId,
  setDirty,
  title,
}: {
  className?: string;
  description: string;
  projectId: string;
  setDirty: (dirty: boolean) => void;
  title: string;
}) {
  return (
    <form action={createDocumentAction} className={className} onChange={() => setDirty(true)}>
      <input name="projectId" type="hidden" value={projectId} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        <SubmitButton icon={Upload} label="Upload" />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <TextField label="Title" name="name" placeholder="Leave blank to use selected type" />
        </div>
        <div className="md:col-span-2">
          <SelectField
            label="Type"
            name="documentKind"
            options={[
              { label: "Code Compliance Certificate", value: "consent|Code Compliance Certificate" },
              { label: "Building consent documents", value: "consent|Building consent documents" },
              { label: "Approved plans and specifications", value: "consent|Approved plans and specifications" },
              { label: "Consent amendments / minor variations", value: "consent|Consent amendments / minor variations" },
              { label: "Council inspection records", value: "consent|Council inspection records" },
              { label: "Final inspection sign-off", value: "consent|Final inspection sign-off" },
              { label: "Record of Building Work", value: "consent|Record of Building Work" },
              { label: "Certificates of Design Work", value: "consent|Certificates of Design Work" },
              { label: "Producer statements", value: "producer_statement|Producer statements" },
              { label: "Electrical Certificate of Compliance", value: "other|Electrical Certificate of Compliance" },
              { label: "Electrical Safety Certificate", value: "other|Electrical Safety Certificate" },
              { label: "Gas certificate", value: "other|Gas certificate" },
              { label: "Plumbing / drainage compliance certificates", value: "other|Plumbing / drainage compliance certificates" },
              { label: "Compliance schedule, if applicable", value: "other|Compliance schedule, if applicable" },
              { label: "Manual", value: "manual|Manual" },
              { label: "Warranty", value: "warranty|Warranty" },
              { label: "Inspection record / photo", value: "photo|Inspection record / photo" },
              { label: "Other legal / compliance record", value: "other|Other legal / compliance record" },
            ]}
            required
          />
        </div>
        <input name="visibleToClient" type="hidden" value="on" />
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-slate-700">File</span>
          <input
            className="mt-1 block h-11 w-full cursor-pointer rounded-md border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-xs text-cyan-950 file:mr-3 file:h-8 file:rounded-md file:border-0 file:bg-cyan-700 file:px-3 file:text-xs file:font-semibold file:text-white hover:border-cyan-300"
            name="documentFile"
            required
            type="file"
          />
        </label>
      </div>
    </form>
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
  const visibleDocuments = snapshot.documents.filter((document) => document.visibleToClient);
  const hasDocumentType = (type: HandoverDocument["type"]) => visibleDocuments.some((document) => document.type === type);
  const hasDocumentRequirement = (keywords: string[]) => visibleDocuments.some((document) => {
    const haystack = `${document.name} ${document.type.replaceAll("_", " ")}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword));
  });
  const missingManualCount = snapshot.checklist.filter((item) => item.sectionStatuses.manual === "missing" || item.status === "missing_manual").length;
  const missingWarrantyCount = snapshot.checklist.filter((item) => item.sectionStatuses.warranty === "missing" || item.status === "missing_warranty_information").length;
  const missingComplianceCount = snapshot.checklist.filter((item) => item.sectionStatuses.codeCompliance === "missing" || item.status === "missing_code_compliance_information").length;
  const manualAddedCount = Math.max(snapshot.checklist.length - missingManualCount, hasDocumentType("manual") ? 1 : 0);
  const warrantyAddedCount = Math.max(snapshot.checklist.length - missingWarrantyCount, hasDocumentType("warranty") ? 1 : 0);
  const complianceAddedCount = Math.max(snapshot.checklist.length - missingComplianceCount, hasDocumentType("consent") || hasDocumentRequirement(["code compliance", "ccc"]) ? 1 : 0);
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
  const documentRequirements = [
    {
      label: "Code Compliance Certificate",
      present: hasDocumentRequirement(["code compliance", "ccc"]),
      required: true,
      note: "Final Code Compliance Certificate issued by council.",
    },
    {
      label: "Building consent documents",
      present: hasDocumentRequirement(["building consent", "consent document"]),
      required: true,
      note: "Consent approval and related issued consent documents.",
    },
    {
      label: "Approved plans and specifications",
      present: hasDocumentRequirement(["approved plan", "approved specification", "plans and specifications"]),
      required: true,
      note: "Approved drawings/specs that the final build was checked against.",
    },
    {
      label: "Consent amendments / minor variations",
      present: hasDocumentRequirement(["consent amendment", "minor variation", "variation"]),
      required: true,
      note: "Any approved amendments or minor variations to the consented work.",
    },
    {
      label: "Council inspection records",
      present: hasDocumentRequirement(["inspection record", "council inspection"]),
      required: true,
      note: "Council inspection history/records for the consented work.",
    },
    {
      label: "Final inspection sign-off",
      present: hasDocumentRequirement(["final inspection", "final sign-off", "final sign off"]),
      required: true,
      note: "Final inspection pass/sign-off before handover.",
    },
    {
      label: "Record of Building Work",
      present: hasDocumentRequirement(["record of building work", "rbw"]),
      required: true,
      note: "Licensed building practitioner Record of Building Work.",
    },
    {
      label: "Certificates of Design Work",
      present: hasDocumentRequirement(["certificate of design work", "certificates of design work", "cdw"]),
      required: true,
      note: "Design work certificates where restricted building work applies.",
    },
    {
      label: "Producer statements",
      present: hasDocumentType("producer_statement") || hasDocumentRequirement(["producer statement", "ps1", "ps2", "ps3", "ps4"]),
      required: true,
      note: "Producer statements supplied by engineers/specialists.",
    },
    {
      label: "Electrical Certificate of Compliance",
      present: hasDocumentRequirement(["electrical certificate of compliance", "electrical coc"]),
      required: true,
      note: "Electrical CoC for prescribed electrical work.",
    },
    {
      label: "Electrical Safety Certificate",
      present: hasDocumentRequirement(["electrical safety certificate", "esc"]),
      required: true,
      note: "Electrical Safety Certificate where required.",
    },
    {
      label: "Gas certificate",
      present: hasDocumentRequirement(["gas certificate", "gasfitting certificate", "gas compliance"]),
      required: true,
      note: "Gasfitting certificate/compliance evidence where gas work was done.",
    },
    {
      label: "Plumbing / drainage compliance certificates",
      present: hasDocumentRequirement(["plumbing certificate", "drainage certificate", "plumbing compliance", "drainage compliance"]),
      required: true,
      note: "Plumbing/drainage compliance documentation where applicable work was done.",
    },
    {
      label: "Compliance schedule, if applicable",
      present: hasDocumentRequirement(["compliance schedule"]),
      required: false,
      note: "Required only if the building has specified systems needing a compliance schedule.",
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
        <p className="mt-1 text-xs leading-5 text-slate-500">Builder-facing summary. Manuals and warranties show what has been added; only required legal/compliance blockers show as missing.</p>
        <div className="mt-3 space-y-1.5">
          <SidebarStatusRow label="Manuals added" value={manualAddedCount} tone="emerald" />
          <SidebarStatusRow label="Warranties added" value={warrantyAddedCount} tone="emerald" />
          <SidebarStatusRow label={missingComplianceCount ? "Code Compliance missing" : "Code Compliance added"} value={missingComplianceCount || complianceAddedCount} tone={missingComplianceCount ? "rose" : "emerald"} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-sm font-semibold text-slate-950">Required legal documents</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">NZ legal/compliance handover documents to upload or confirm. Not legal advice.</p>
        <div className="mt-3 space-y-2">
          {documentRequirements.map((requirement) => {
            const requirementBadgeClass = requirement.present
              ? "bg-emerald-100 text-emerald-900"
              : requirement.required
                ? "bg-rose-100 text-rose-900"
                : "bg-slate-100 text-slate-700";

            return (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5" key={requirement.label}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">{requirement.label}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${requirementBadgeClass}`}>
                  {requirement.present ? "Added" : requirement.required ? "Missing" : "Not added"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{requirement.note}</p>
            </div>
          );
          })}
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
  if (item.valueSources.includes("database_autofill")) return "DB autofill";
  if (item.valueSources.includes("extracted_document")) return "Previous import";
  if (item.valueSources.includes("manual_upload")) return "Manual upload";
  return "Manual";
}

type HandoverItemSectionSummary = {
  label: string;
  status: string;
  tone: "good" | "warn" | "danger" | "neutral";
};

function getSectionStatusTone(status: string): HandoverItemSectionSummary["tone"] {
  if (status === "missing") return "danger";
  if (status === "autofilled_needs_review") return "good";
  if (status === "provided" || status === "reviewed" || status === "uploaded_manually") return "good";
  return "neutral";
}

function formatSectionStatusValue(status: string) {
  const labels: Record<string, string> = {
    autofilled_needs_review: "Added",
    missing: "Missing",
    not_required: "Not required",
    provided: "Added",
    reviewed: "Checked",
    uploaded_manually: "Uploaded",
    accepted_incomplete: "Logged",
  };

  return labels[status] || status.replaceAll("_", " ");
}

function getChecklistSectionSummaries(item: ProjectHandoverChecklistItem): HandoverItemSectionSummary[] {
  const sections = [
    { label: "Care", status: item.sectionStatuses.careInstructions },
    { label: "Manual", status: item.sectionStatuses.manual },
    { label: "Warranty", status: item.sectionStatuses.warranty },
    { label: "Invoice", status: item.sectionStatuses.invoice },
    { label: "Compliance", status: item.sectionStatuses.codeCompliance },
    { label: "Supporting docs", status: item.sectionStatuses.supportingDocuments },
  ];

  return sections.map((section) => ({
    ...section,
    status: formatSectionStatusValue(section.status),
    tone: getSectionStatusTone(section.status),
  }));
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
    maintenanceScheduleKey: product.maintenanceScheduleKey || "",
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
    needs_review: "Added",
    missing_manual: "Missing manual",
    missing_care_instructions: "Missing care instructions",
    missing_warranty_information: "Missing warranty information",
    missing_invoice_information: "Missing invoice information",
    missing_code_compliance_information: "Missing Code of Compliance",
    not_enough_information_to_search: "Needs review",
    documents_uploaded_manually: "Documents uploaded manually",
    user_accepted_incomplete: "User accepted incomplete",
  };

  return labels[status] || status.replaceAll("_", " ");
}

function checklistStatusStyles(status: ProjectHandoverChecklistItem["status"]) {
  if (status === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "user_accepted_incomplete") return "border-purple-200 bg-purple-50 text-purple-800";
  if (status === "not_enough_information_to_search") return "border-slate-200 bg-slate-50 text-slate-700";
  if (status.startsWith("missing_")) return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "documents_uploaded_manually") return "border-cyan-200 bg-cyan-50 text-cyan-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function AddHandoverItemForm({
  initialCategory,
  productVersions,
  projectId,
  setDirty,
}: {
  initialCategory?: string;
  productVersions: ProductVersion[];
  projectId: string;
  setDirty: (dirty: boolean) => void;
}) {
  const emptyDraft = {
    title: "",
    category: initialCategory || "",
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
    maintenanceScheduleKey: "",
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
      return matchesSearchTokens(query, `${product.productName} ${product.brand} ${product.category} ${product.location} ${product.reviewReason}`);
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
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Database autofill + manual entry</p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">Add handover item</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Type the item details below. Matching database suggestions appear automatically and can autofill known fields, or you can keep typing and add the item manually.
          </p>
        </div>
        <SubmitButton icon={Plus} label={submitLabel} />
      </div>
      <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-cyan-800">Database suggestions</p>
        <div className="mt-3">
          <ChecklistTextInput label="Search item name" name="title" onChange={(value) => updateDraft("title", value)} placeholder="e.g. Fisher & Paykel oven" required value={draft.title} />
        </div>
        {draft.title.trim() ? (
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
        ) : (
          <p className="mt-2 text-xs leading-5 text-slate-600">Start typing an item name here first; approved product database matches will appear before the manual fields below.</p>
        )}
        {selectedProduct ? (
          <button className="mt-3 text-xs font-semibold text-slate-600 underline" onClick={clearSuggestion} type="button">
            Clear selected suggestion and continue manually
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ChecklistSelectInput label="Category" name="category" onChange={(value) => updateDraft("category", value)} options={handoverCategoryOptions} value={draft.category} />
        <ChecklistTextInput label="Location" name="location" onChange={(value) => updateDraft("location", value)} placeholder="Kitchen, ensuite, exterior" value={draft.location} />
        <ChecklistTextInput label="Brand / manufacturer" name="brand" onChange={(value) => updateDraft("brand", value)} placeholder="Fisher & Paykel" value={draft.brand} />
        <ChecklistTextInput label="Model" name="model" onChange={(value) => updateDraft("model", value)} placeholder="OB60..." value={draft.model} />
        <ChecklistTextInput label="SKU / product code" name="productCode" onChange={(value) => updateDraft("productCode", value)} value={draft.productCode} />
        <ChecklistTextInput label="Supplier" name="supplier" onChange={(value) => updateDraft("supplier", value)} value={draft.supplier} />
        <ChecklistTextInput label="Supplier SKU" name="supplierSku" onChange={(value) => updateDraft("supplierSku", value)} value={draft.supplierSku} />
        <ChecklistTextInput label="Quantity" name="quantity" onChange={(value) => updateDraft("quantity", value)} value={draft.quantity} />
        <ChecklistTextInput label="Finish / colour" name="finish" onChange={(value) => updateDraft("finish", value)} value={draft.finish} />
        <ChecklistSelectInput
          label="Shared maintenance schedule"
          name="maintenanceScheduleKey"
          onChange={(value) => updateDraft("maintenanceScheduleKey", value)}
          options={[{ label: "No shared schedule", value: "" }, ...maintenanceSchedules.map((schedule) => ({ label: schedule.title, value: schedule.key }))]}
          value={draft.maintenanceScheduleKey}
        />
        <input name="colour" type="hidden" value={draft.colour} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <DocumentEvidenceInput
          description="Write care instructions, paste a care-guide link, or upload a care guide."
          fileName="careDocumentFile"
          label="Care instructions / guide"
          name="careInstructions"
          onChange={(value) => updateDraft("careInstructions", value)}
          value={draft.careInstructions}
        />
        <DocumentEvidenceInput
          description="Paste a manual link/reference or upload the manual file."
          fileName="manualDocumentFile"
          label="Manual"
          name="manualUrl"
          onChange={(value) => updateDraft("manualUrl", value)}
          value={draft.manualUrl}
        />
        <DocumentEvidenceInput
          description="Write warranty terms, paste a warranty link, or upload the warranty file."
          fileName="warrantyDocumentFile"
          label="Warranty"
          name="warrantyInformation"
          onChange={(value) => updateDraft("warrantyInformation", value)}
          value={draft.warrantyInformation}
        />
        <DocumentEvidenceInput
          description="Write purchase details, paste an invoice link, or upload invoice evidence."
          fileName="invoiceDocumentFile"
          label="Invoice / purchase evidence"
          name="invoiceData"
          onChange={(value) => updateDraft("invoiceData", value)}
          value={draft.invoiceData}
        />
        <DocumentEvidenceInput
          description="Write compliance notes, paste a consent/CCC link, or upload compliance evidence."
          fileName="codeComplianceDocumentFile"
          label="Code Compliance / consent"
          name="codeComplianceInformation"
          onChange={(value) => updateDraft("codeComplianceInformation", value)}
          value={draft.codeComplianceInformation}
        />
        <DocumentEvidenceInput
          description="Write supporting notes, paste a photo/document link, or upload supporting evidence."
          fileName="supportingDocumentFile"
          label="Supporting documents / photos"
          name="supportingDocumentsNote"
          onChange={(value) => updateDraft("supportingDocumentsNote", value)}
          value={draft.supportingDocumentsNote}
        />
        <div className="lg:col-span-2">
          <ChecklistTextarea label="Builder notes" name="extraNotes" onChange={(value) => updateDraft("extraNotes", value)} value={draft.extraNotes} />
        </div>
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
  onAddItem: (category?: string) => void;
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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const completeCount = checklist.filter((item) => item.status === "complete").length;
  const missingCount = checklist.filter((item) => item.status.startsWith("missing_")).length;
  const needsReviewCount = checklist.filter((item) => item.status === "needs_review" || item.status === "documents_uploaded_manually" || item.status === "not_enough_information_to_search").length;
  const categoryOptions = Array.from(new Set([
    ...defaultHandoverGroups,
    ...(checklist.map((item) => item.category).filter(Boolean) as string[]),
  ])).sort((left, right) => {
    const leftIndex = defaultHandoverGroups.indexOf(left);
    const rightIndex = defaultHandoverGroups.indexOf(right);
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex) || left.localeCompare(right);
  });
  const categoryGroups = categoryOptions.map((category) => {
    const items = checklist.filter((item) => item.category === category);
    return {
      category,
      count: items.length,
      ready: items.filter((item) => item.status === "complete" || item.status === "user_accepted_incomplete").length,
    };
  });
  const selectedItem = checklist.find((item) => item.id === selectedItemId) || null;
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
      (!filters.search || matchesSearchTokens(filters.search, searchHaystack)) &&
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
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-cyan-700">Manual project checklist</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">Handover Items &amp; Products</h3>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-600">
            Use the group buttons below to filter the checklist by project area/category. Add items manually or with database autofill, then review each section before the homeowner sees it.
          </p>
        </div>
        <button
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-cyan-700 px-3 text-xs font-semibold text-white hover:bg-cyan-800 sm:w-auto"
          onClick={() => onAddItem()}
          type="button"
        >
          <Plus className="size-4" />
          Add handover item
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-950">Groups</p>
          <p className="text-xs text-slate-500">{filteredChecklist.length} shown / {checklist.length} total</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className={`rounded-md border px-3 py-2 text-left text-xs font-semibold transition ${filters.category === "all" ? "border-cyan-500 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-white text-cyan-950 hover:border-cyan-300 hover:bg-cyan-50"}`}
            onClick={() => setFilters((current) => ({ ...current, category: "all" }))}
            type="button"
          >
            <span className="block">All items</span>
            <span className="mt-0.5 block font-normal text-slate-500">{checklist.length} items</span>
          </button>
          {categoryGroups.map((group) => (
            <button
              className={`rounded-md border px-3 py-2 text-left text-xs font-semibold transition ${filters.category === group.category ? "border-cyan-500 bg-cyan-50 text-cyan-900" : "border-slate-200 bg-white text-cyan-950 hover:border-cyan-300 hover:bg-cyan-50"}`}
              key={group.category}
              onClick={() => {
                setFilters((current) => ({ ...current, category: group.category }));
                if (group.count === 0) {
                  onAddItem(group.category);
                }
              }}
              type="button"
            >
              <span className="block">{group.category}</span>
              <span className="mt-0.5 block font-normal text-slate-500">
                {group.count ? `${group.ready}/${group.count} ready` : "Add item"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-3 lg:grid-cols-6">
        <ChecklistMetric label="Items" value={checklist.length} />
        <ChecklistMetric label="Complete" value={completeCount} />
        <ChecklistMetric label="Added" value={needsReviewCount} />
        <ChecklistMetric label="Missing" value={missingCount} />

      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-950">Search and status filters</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <ChecklistTextInput label="Search" name="filterSearch" onChange={(value) => setFilters((current) => ({ ...current, search: value }))} placeholder="Name, brand, room, supplier" value={filters.search} />
            <ChecklistFilterSelect label="Status" onChange={(value) => setFilters((current) => ({ ...current, status: value }))} value={filters.status} options={[{ label: "All statuses", value: "all" }, { label: "Complete", value: "complete" }, { label: "Added", value: "needs_review" }, { label: "Missing info", value: "missing" }]} />
            <ChecklistFilterSelect label="Missing section" onChange={(value) => setFilters((current) => ({ ...current, missing: value }))} value={filters.missing} options={[{ label: "Any section", value: "all" }, { label: "Care", value: "care" }, { label: "Manual", value: "manual" }, { label: "Warranty", value: "warranty" }, { label: "Invoice", value: "invoice" }, { label: "Compliance", value: "Compliance" }, { label: "Supporting docs", value: "supporting" }]} />
            <ChecklistFilterSelect label="Source" onChange={(value) => setFilters((current) => ({ ...current, source: value }))} value={filters.source} options={[{ label: "All sources", value: "all" }, { label: "Manual", value: "manual" }, { label: "Database autofill", value: "database_autofill" }, { label: "Previous import", value: "imported" }]} />
            <ChecklistFilterSelect label="Completion state" onChange={(value) => setFilters((current) => ({ ...current, review: value }))} value={filters.review} options={[{ label: "Any completion state", value: "all" }, { label: "Added", value: "needs_review" }, { label: "Complete", value: "complete" }, { label: "Incomplete", value: "incomplete" }]} />
          </div>
        </div>
        {filteredChecklist.length ? (
          <div className="handover-item-list">
            {filteredChecklist.map((item) => <ProjectHandoverChecklistCard item={item} key={item.id} onOpen={() => setSelectedItemId(item.id)} />)}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-xs leading-6 text-slate-600">
            No checklist items match these filters. Add a manual item or clear filters.
            {filters.category !== "all" ? (
              <button className="ml-2 font-semibold text-cyan-700 underline" onClick={() => onAddItem(filters.category)} type="button">
                Add {filters.category} item
              </button>
            ) : null}
          </div>
        )}
      </div>
      {selectedItem ? (
        <HandoverChecklistItemModal
          item={selectedItem}
          onClose={() => setSelectedItemId(null)}
          setDirty={setDirty}
        />
      ) : null}
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

function DocumentEvidenceInput({
  description,
  fileName,
  label,
  name,
  onChange,
  value,
}: {
  description: string;
  fileName: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <label className="block">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>
        <textarea
          className="mt-2 min-h-20 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
          name={name}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Write text or paste a link/reference here."
          value={value}
        />
      </label>
      <label className="mt-2 block">
        <span className="text-xs font-semibold text-slate-600">Or upload file</span>
        <input
          className="mt-1 block h-8 w-full cursor-pointer rounded-md border border-dashed border-slate-300 bg-white px-2 py-1 text-[11px] text-cyan-950 file:mr-2 file:h-5 file:rounded file:border-0 file:bg-cyan-700 file:px-2 file:text-[11px] file:font-semibold file:text-white hover:border-cyan-300"
          name={fileName}
          type="file"
        />
      </label>
    </div>
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


function ChecklistMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function CompactItemTextField({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="handover-item-field">
      <span className="handover-item-field-label">{label}</span>
      <input
        className="handover-item-input"
        defaultValue={defaultValue}
        name={name}
        required={required}
      />
    </label>
  );
}

function CompactItemSelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="handover-item-field">
      <span className="handover-item-field-label">{label}</span>
      <select
        className="handover-item-input"
        defaultValue={defaultValue}
        name={name}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function CompactItemTextarea({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="handover-item-field">
      <span className="handover-item-field-label">{label}</span>
      <textarea
        className="handover-item-textarea"
        defaultValue={defaultValue}
        name={name}
      />
    </label>
  );
}

function CompactDocumentEvidenceField({
  defaultValue,
  description,
  fileName,
  label,
  name,
}: {
  defaultValue?: string;
  description: string;
  fileName: string;
  label: string;
  name: string;
}) {
  return (
    <div className="handover-item-document-field">
      <label className="handover-item-field">
        <span className="handover-item-field-label">{label}</span>
        <span className="handover-item-field-help">{description}</span>
        <textarea
          className="handover-item-textarea"
          defaultValue={defaultValue}
          name={name}
          placeholder="Write text or paste a link/reference here."
        />
      </label>
      <label className="handover-item-field">
        <span className="handover-item-field-label">Upload file instead</span>
        <input className="handover-item-file-input" name={fileName} type="file" />
      </label>
    </div>
  );
}

function ProjectHandoverChecklistCard({ item, onOpen }: { item: ProjectHandoverChecklistItem; onOpen: () => void }) {
  const sectionSummaries = getChecklistSectionSummaries(item);
  const attentionSummaries = sectionSummaries.filter((section) => section.tone === "danger" || section.tone === "warn");
  const location = getChecklistMetadataValue(item, "location");
  const quantity = getChecklistMetadataValue(item, "quantity");
  const finish = getChecklistMetadataValue(item, "finish");
  const colour = getChecklistMetadataValue(item, "colour");
  const maintenanceScheduleLabel = getMaintenanceScheduleLabel(getChecklistMetadataValue(item, "maintenance_schedule_key"));
  const primaryIdentity = [item.brand || item.manufacturer, item.model || item.productCode || item.sku].filter(Boolean).join(" · ");
  const secondaryIdentity = [item.supplier, item.category, location].filter(Boolean).join(" · ");

  return (
    <article className="handover-item-card">
      <button className="handover-item-open-button" onClick={onOpen} type="button">
        <span className="sr-only">Open {item.title} details</span>
      </button>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-slate-950">{item.title}</h4>
            <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${checklistStatusStyles(item.status)}`}>
              {formatChecklistStatus(item.status)}
            </span>
            <span className="handover-item-source-badge">
              {getChecklistSourceLabel(item)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {primaryIdentity || "No brand/model detail yet"}
          </p>
          {secondaryIdentity ? <p className="mt-0.5 text-xs font-medium text-slate-500">{secondaryIdentity}</p> : null}
          {maintenanceScheduleLabel !== "No shared maintenance schedule" ? (
            <p className="mt-0.5 text-xs font-medium text-cyan-700">Maintenance: {maintenanceScheduleLabel}</p>
          ) : null}
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

      {attentionSummaries.length ? (
        <div className="handover-item-attention">
          <span className="handover-item-attention-label">Needs attention</span>
          <span>{attentionSummaries.map((section) => `${section.label}: ${section.status}`).join(" · ")}</span>
        </div>
      ) : (
        <div className="handover-item-ready-note">Key handover info is added or marked not required.</div>
      )}

      <div className="handover-item-status-grid">
        {sectionSummaries.map((section) => (
          <ChecklistSectionStatus key={section.label} label={section.label} status={section.status} tone={section.tone} />
        ))}
      </div>
      <p className="mt-2 text-xs font-semibold text-cyan-800">Click to view or edit details</p>
    </article>
  );
}

function HandoverChecklistItemModal({
  item,
  onClose,
  setDirty,
}: {
  item: ProjectHandoverChecklistItem;
  onClose: () => void;
  setDirty: (dirty: boolean) => void;
}) {
  const location = getChecklistMetadataValue(item, "location");
  const quantity = getChecklistMetadataValue(item, "quantity");
  const finish = getChecklistMetadataValue(item, "finish");
  const colour = getChecklistMetadataValue(item, "colour");
  const supportingDocumentsNote = getChecklistMetadataValue(item, "supporting_documents_note");
  const careDocumentId = getChecklistMetadataValue(item, "care_document_id");
  const sectionSummaries = getChecklistSectionSummaries(item);
  const formId = `handover-item-form-${item.id}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-cyan-700">Handover item</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold tracking-normal text-slate-950">{item.title}</h3>
              <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${checklistStatusStyles(item.status)}`}>
                {formatChecklistStatus(item.status)}
              </span>
              <span className="handover-item-source-badge">{getChecklistSourceLabel(item)}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Review the homeowner-facing details, then save changes without leaving this project.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button className="handover-item-save-button" form={formId} type="submit">
              Save
            </button>
            <button
              aria-label="Close item details"
              className="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
              onClick={onClose}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-5">
          <div className="handover-item-modal-status-grid">
            {sectionSummaries.map((section) => (
              <ChecklistSectionStatus key={section.label} label={section.label} status={section.status} tone={section.tone} />
            ))}
          </div>
          <form action={updateProjectHandoverChecklistItemAction} className="handover-item-modal-form" id={formId} onChange={() => setDirty(true)}>
            <input name="itemId" type="hidden" value={item.id} />
            <input name="projectId" type="hidden" value={item.projectId} />
            <input name="selectedProductId" type="hidden" value={getChecklistMetadataValue(item, "matched_product_id")} />
            <input name="selectedProductLabel" type="hidden" value={getChecklistMetadataValue(item, "source_label")} />
            <input name="careDocumentId" type="hidden" value={careDocumentId} />
            <input name="manualDocumentId" type="hidden" value={item.manualDocumentId || ""} />
            <input name="warrantyDocumentId" type="hidden" value={item.warrantyDocumentId || ""} />
            <input name="invoiceDocumentId" type="hidden" value={item.invoiceDocumentId || ""} />
            <input name="codeComplianceDocumentId" type="hidden" value={item.codeComplianceDocumentId || ""} />
            <input name="supportingDocumentIds" type="hidden" value={item.supportingDocumentIds.join(",")} />

            <section className="handover-item-modal-panel">
              <h4 className="handover-item-modal-heading">Item identity</h4>
              <div className="handover-item-modal-grid">
                <CompactItemTextField label="Item name" name="title" defaultValue={item.title} required />
                <CompactItemSelectField label="Category" name="category" defaultValue={item.category} options={getCategoryOptions(item.category)} />
                <CompactItemTextField label="Location" name="location" defaultValue={location} />
                <CompactItemTextField label="Brand" name="brand" defaultValue={item.brand || item.manufacturer} />
                <CompactItemTextField label="Model" name="model" defaultValue={item.model} />
                <CompactItemTextField label="SKU" name="sku" defaultValue={item.sku} />
                <CompactItemTextField label="Product code" name="productCode" defaultValue={item.productCode} />
                <CompactItemTextField label="Supplier" name="supplier" defaultValue={item.supplier} />
                <CompactItemTextField label="Supplier SKU" name="supplierSku" defaultValue={item.supplierSku} />
                <CompactItemTextField label="Quantity" name="quantity" defaultValue={quantity} />
                <CompactItemTextField label="Finish" name="finish" defaultValue={finish} />
                <CompactItemTextField label="Colour" name="colour" defaultValue={colour} />
                <CompactItemSelectField
                  label="Shared maintenance schedule"
                  name="maintenanceScheduleKey"
                  defaultValue={getChecklistMetadataValue(item, "maintenance_schedule_key")}
                  options={[{ label: "No shared schedule", value: "" }, ...maintenanceSchedules.map((schedule) => ({ label: schedule.title, value: schedule.key }))]}
                />
              </div>
            </section>

            <section className="handover-item-modal-panel">
              <h4 className="handover-item-modal-heading">Documents, links, and evidence</h4>
              <div className="handover-item-modal-grid">
                <CompactDocumentEvidenceField defaultValue={item.careInstructions} description="Write care notes, paste a care-guide link, or upload a care guide." fileName="careDocumentFile" label="Care instructions / guide" name="careInstructions" />
                <CompactDocumentEvidenceField defaultValue={item.manualUrl} description="Paste a manual link/reference or upload the manual file." fileName="manualDocumentFile" label="Manual" name="manualUrl" />
                <CompactDocumentEvidenceField defaultValue={item.warrantyInformation} description="Write warranty terms, paste a warranty link, or upload warranty evidence." fileName="warrantyDocumentFile" label="Warranty" name="warrantyInformation" />
                <CompactDocumentEvidenceField defaultValue={item.invoiceData} description="Write purchase details, paste an invoice link, or upload invoice evidence." fileName="invoiceDocumentFile" label="Invoice / purchase" name="invoiceData" />
                <CompactDocumentEvidenceField defaultValue={item.codeComplianceInformation} description="Write compliance notes, paste a CCC/consent link, or upload compliance evidence." fileName="codeComplianceDocumentFile" label="Code compliance / consent" name="codeComplianceInformation" />
                <CompactDocumentEvidenceField defaultValue={supportingDocumentsNote} description="Write notes, paste a photo/document link, or upload supporting evidence." fileName="supportingDocumentFile" label="Supporting documents / photos" name="supportingDocumentsNote" />
              </div>
            </section>

            <section className="handover-item-modal-panel handover-item-modal-panel--full">
              <CompactItemTextarea label="Builder notes" name="extraNotes" defaultValue={item.extraNotes} />
            </section>

            <div className="handover-item-save-row">
              <button className="handover-item-save-button" type="submit">
                Save item details
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function ChecklistSectionStatus({ label, status, tone }: { label: string; status: string; tone: HandoverItemSectionSummary["tone"] }) {
  return (
    <div className={`handover-item-section-chip handover-item-section-chip--${tone}`}>
      <span className="handover-item-section-label">{label}</span>
      <span className="handover-item-section-value">{status}</span>
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
