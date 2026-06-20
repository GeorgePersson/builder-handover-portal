"use client";

import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  Bell,
  Bot,
  CalendarCheck2,
  FileText,
  FileSearch,
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
  createSpecificationUploadAction,
  approveWorkflowItemAction,
  editWorkflowItemAction,
  excludeWorkflowItemAction,
  markWorkflowItemBuilderSuppliedAction,
  publishHandoverPackageAction,
  retryDocumentExtractionJobAction,
  revokeClientInviteAction,
  sendClientInviteEmailAction,
  syncCloudflarePipelineStatusAction,
  updateProjectAction,
  uploadWorkflowItemSupportingDocumentAction,
} from "@/lib/server/actions";
import { formatDate } from "@/lib/utils";
import {
  aiHandoverApprovalText,
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
import { getWorkflowPublishReadiness } from "@/lib/workflow-readiness";

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

type ModalMode = "create" | "edit" | "send" | "help" | null;

const packageReadyStatuses = new Set(["accepted", "auto_approved", "builder_approved", "global_approved"]);
const adminReviewStatuses = new Set(["admin_review", "edited", "proposed"]);
const unresolvedWorkflowReviewStatuses = new Set(["needs_review", "low_confidence", "unmatched"]);
const approvedWorkflowReviewStatuses = new Set(["verified_match", "approved", "edited_by_builder", "builder_supplied"]);

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

const careGuidanceSourceOptions = [
  { label: "Manufacturer", value: "manufacturer" },
  { label: "Supplier", value: "supplier" },
  { label: "Builder supplied", value: "builder_supplied" },
  { label: "General AI care guidance", value: "general_ai" },
  { label: "Unknown source", value: "unknown" },
];

type ContextSchemaMetadata = {
  itemType?: string;
  sourceEvidenceText?: string;
  missingFields: string[];
  builderInfoNeeded: string[];
  contextClassification?: string;
  classificationReason?: string;
};

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
  documents,
  projects,
  specifications,
  extractedItems,
  extractedWorkflowItems,
  extractionJobs,
  maintenanceTasks,
  productVersions,
  productMatches,
  uploadedDocuments,
}: ProjectsWorkspaceProps) {
  const [mode, setMode] = useState<ModalMode>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects[0]?.id ?? null);
  const [isDirty, setIsDirty] = useState(false);
  const [productQuery, setProductQuery] = useState("");

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const invitePath = inviteToken ? `/client/accept-invite?token=${encodeURIComponent(inviteToken)}` : null;

  const projectSnapshots = useMemo(
    () =>
      projects.map((project) => {
        const projectSpecificationIds = new Set(
          specifications.filter((specification) => specification.projectId === project.id).map((specification) => specification.id),
        );
        const projectItems = extractedItems.filter((item) => projectSpecificationIds.has(item.specificationId));
        const readyItems = projectItems.filter((item) => packageReadyStatuses.has(item.status));
        const awaitingAdmin = projectItems.filter((item) => adminReviewStatuses.has(item.status));
        const tasks = maintenanceTasks.filter((task) => task.projectId === project.id);
        const projectDocuments = documents.filter((document) => document.projectId === project.id);
        const projectDownloadEvents = downloadEvents.filter((event) => event.projectId === project.id);
        const projectHandoverOpenEvents = handoverOpenEvents.filter((event) => event.projectId === project.id);
        const firstHandoverOpenEvent = [...projectHandoverOpenEvents].sort((left, right) =>
          left.firstOpenedAt.localeCompare(right.firstOpenedAt),
        )[0];
        const workflowDocuments = uploadedDocuments.filter((document) => document.projectId === project.id);
        const workflowJobs = extractionJobs.filter((job) => job.projectId === project.id);
        const workflowItems = extractedWorkflowItems.filter((item) => item.projectId === project.id);
        const workflowItemIds = new Set(workflowItems.map((item) => item.id));
        const workflowMatches = productMatches.filter((match) => workflowItemIds.has(match.extractedItemId));

        return {
          project,
          awaitingAdmin,
          downloadEvents: projectDownloadEvents,
          firstHandoverOpenEvent,
          handoverOpenEvents: projectHandoverOpenEvents,
          documents: projectDocuments,
          readyItems,
          specifications: specifications.filter((specification) => specification.projectId === project.id),
          tasks,
          workflowDocuments,
          workflowItems,
          workflowJobs,
          workflowMatches,
        };
      }),
    [
      documents,
      downloadEvents,
      handoverOpenEvents,
      extractedItems,
      extractedWorkflowItems,
      extractionJobs,
      maintenanceTasks,
      productMatches,
      projects,
      specifications,
      uploadedDocuments,
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
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-700">Builder workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Projects</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Create, review, package, and send handover projects from one workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => open("help")}
              type="button"
            >
              <HelpCircle className="size-4" />
              Help
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800"
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
            "create-extraction-job-failed": "The document uploaded, but the extraction job could not be created.",
            "create-uploaded-document-audit-failed": "The document was uploaded, but the workflow audit log could not be recorded.",
            "create-uploaded-document-failed": "The document was uploaded, but the workflow status record could not be created. Check the Phase 1 migration.",
            "create-request-failed": "The missing item request could not be created.",
            "extraction-job-not-found": "That extraction job could not be found.",
            "extraction-job-not-retryable": "Only failed extraction jobs can be retried.",
            "handover-ai-approval-required": "Confirm the AI-assisted information has been reviewed before release.",
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
            "uploaded-document-download-failed": "The uploaded document could not be loaded for extraction retry.",
            "uploaded-document-not-found": "The uploaded document for that extraction job could not be found.",
            "workflow-item-not-found": "That extracted item could not be found.",
            "workflow-publish-blocked": "This project is not ready to publish yet. Resolve workflow processing and review blockers first.",
            "workflow-review-action-failed": "The review action could not be saved.",
            "workflow-review-update-failed": "The extracted item could not be updated.",
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

        <section className="mt-6 grid gap-4 md:grid-cols-5">
          <Metric icon={PackageCheck} label="Projects" value={projects.length} />
          <Metric icon={FileText} label="Client docs" value={documents.filter((document) => document.visibleToClient).length} />
          <Metric icon={Bot} label="Awaiting admin" value={projectSnapshots.reduce((sum, snapshot) => sum + snapshot.awaitingAdmin.length, 0)} />
          <Metric icon={Send} label="Package-ready items" value={projectSnapshots.reduce((sum, snapshot) => sum + snapshot.readyItems.length, 0)} />
          <Metric icon={CalendarCheck2} label="Maintenance tasks" value={maintenanceTasks.length} />
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid gap-3 border-b border-slate-100 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="font-semibold text-slate-950">Project list</h2>
              <p className="mt-1 text-sm text-slate-500">Open a project to edit details, upload specs, review package items, or send the handover pack.</p>
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
            {projectSnapshots.map(({ project, awaitingAdmin, firstHandoverOpenEvent, readyItems, specifications: projectSpecs, tasks }) => (
              <article className="grid gap-4 p-5 xl:grid-cols-[1fr_auto]" key={project.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-950">{project.name}</h3>
                    <StatusPill variant={project.status} />
                    {awaitingAdmin.length ? <InlineFlag icon={Bell} label={`${awaitingAdmin.length} awaiting admin`} /> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{project.address}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {project.clientName} - {project.projectType} - Handover {formatDate(project.handoverDate)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-md bg-slate-100 px-2.5 py-1">{projectSpecs.length} spec uploads</span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1">
                      {documents.filter((document) => document.projectId === project.id).length} documents
                    </span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1">{readyItems.length} package-ready</span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1">{tasks.length ? `${tasks.length} maintenance tasks` : "No maintenance tasks"}</span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1">Invite: {formatInviteStatus(project.clientInviteStatus, project.clientInvitedAt)}</span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1">
                      {project.publishedAt ? firstOpenLabel(firstHandoverOpenEvent) : "Not published yet"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => open("edit", project.id)}
                    type="button"
                  >
                    <Pencil className="size-4" />
                    Edit
                  </button>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800"
                    onClick={() => open("send", project.id)}
                    type="button"
                  >
                    <Send className="size-4" />
                    Send package
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
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
              {mode === "edit" && selectedProject && selectedSnapshot ? (
                <ProjectEditPanel
                  filteredProducts={filteredProducts}
                  productQuery={productQuery}
                  project={selectedProject}
                  setDirty={setIsDirty}
                  setProductQuery={setProductQuery}
                  snapshot={selectedSnapshot}
                />
              ) : null}
              {mode === "send" && selectedProject && selectedSnapshot ? (
                <SendPackagePanel project={selectedProject} snapshot={selectedSnapshot} />
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
      <form action={createProjectAction} className="rounded-lg border border-slate-200 p-5" onChange={() => setDirty(true)}>
        <h3 className="font-semibold text-slate-950">Project and client</h3>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <TextField label="Project name" name="name" placeholder="Bayview Road New Build" required />
          <SelectField label="Project type" name="projectType" options={projectTypeOptions} required />
          <TextField label="Property address" name="address" placeholder="18 Bayview Road, Tauranga" required />
          <TextField label="Target handover date" name="handoverDate" type="date" />
          <TextField label="Client name" name="clientName" placeholder="Amelia and Noah Smith" required />
          <TextField label="Client email" name="clientEmail" placeholder="client@example.co.nz" required type="email" />
        </div>
        <label className="mt-5 block">
          <span className="text-sm font-medium text-slate-700">Optional specification PDF</span>
          <input
            className="mt-2 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
            name="specificationPdf"
            type="file"
            accept="application/pdf"
          />
        </label>
        <div className="mt-4 rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm leading-6 text-cyan-900">
          If a PDF is attached, it is registered against the project after save. Extraction and review
          details will populate in this project workspace as they are processed.
        </div>
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
        <div className="mt-6 flex justify-end">
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
  filteredProducts,
  productQuery,
  project,
  setDirty,
  setProductQuery,
  snapshot,
}: {
  filteredProducts: ProductVersion[];
  productQuery: string;
  project: Project;
  setDirty: (dirty: boolean) => void;
  setProductQuery: (value: string) => void;
  snapshot: {
    awaitingAdmin: ExtractedHandoverItem[];
    downloadEvents: DocumentDownloadEvent[];
    firstHandoverOpenEvent?: HandoverOpenEvent;
    handoverOpenEvents: HandoverOpenEvent[];
    documents: HandoverDocument[];
    readyItems: ExtractedHandoverItem[];
    specifications: SpecificationUpload[];
    tasks: MaintenanceTask[];
    workflowDocuments: UploadedProjectDocument[];
    workflowItems: ExtractedWorkflowItem[];
    workflowJobs: DocumentExtractionJob[];
    workflowMatches: ProductMatch[];
  };
}) {
  const manualItems = snapshot.awaitingAdmin.filter((item) => item.status !== "admin_review");
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <form action={updateProjectAction} className="rounded-lg border border-slate-200 p-5" onChange={() => setDirty(true)}>
          <input name="projectId" type="hidden" value={project.id} />
          <h3 className="font-semibold text-slate-950">Project details</h3>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <TextField label="Project name" name="name" defaultValue={project.name} required />
            <SelectField label="Project type" name="projectType" defaultValue={project.projectType} options={projectTypeOptions} required />
            <TextField label="Property address" name="address" defaultValue={project.address} required />
            <TextField label="Target handover date" name="handoverDate" defaultValue={project.handoverDate?.slice(0, 10)} type="date" />
            <TextField label="Client name" name="clientName" defaultValue={project.clientName} required />
            <TextField label="Client email" name="clientEmail" defaultValue={project.clientEmail} required type="email" />
          </div>
          <div className="mt-6 flex justify-end">
            <SubmitButton icon={Pencil} label="Save changes" />
          </div>
        </form>
        <div className="space-y-5">
          <form action={createSpecificationUploadAction} className="rounded-lg border border-slate-200 p-5" onChange={() => setDirty(true)}>
            <input name="projectId" type="hidden" value={project.id} />
            <h3 className="font-semibold text-slate-950">Specification upload</h3>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">Add spec PDF</span>
              <input
                className="mt-2 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
                name="specificationPdf"
                type="file"
                accept="application/pdf"
              />
            </label>
            <div className="mt-4 flex justify-end">
              <SubmitButton icon={Upload} label="Register PDF" />
            </div>
          </form>
          <section className="rounded-lg border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-950">Client access</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Invite status: {formatInviteStatus(project.clientInviteStatus, project.clientInvitedAt)}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Handover first opened: {project.publishedAt ? firstOpenDate(snapshot.firstHandoverOpenEvent) : "Not published yet"}
            </p>
            {snapshot.firstHandoverOpenEvent ? (
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Privacy-light package record only: opened {snapshot.firstHandoverOpenEvent.openCount} time{snapshot.firstHandoverOpenEvent.openCount === 1 ? "" : "s"} total. No page or item-level tracking is shown here.
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {project.clientInviteStatus === "accepted" ? null : (
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
          <section className="rounded-lg border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-950">Client documents</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Upload warranties, manuals, certificates, photos, or other files that the client should receive with this handover.
            </p>
            <form action={createDocumentAction} className="mt-4 space-y-4" onChange={() => setDirty(true)}>
              <input name="projectId" type="hidden" value={project.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <TextField label="Document name" name="name" placeholder="Window warranty schedule.pdf" />
                <SelectField
                  label="Document type"
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
              </div>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Upload file</span>
                <input
                  className="mt-2 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
                  name="documentFile"
                  type="file"
                  accept=".csv,.doc,.docx,.gif,.jpeg,.jpg,.pdf,.png,.webp,.xls,.xlsx,application/pdf,image/gif,image/jpeg,image/png,image/webp,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                />
              </label>
              <label className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <input className="mt-1 size-4 accent-cyan-700" defaultChecked name="visibleToClient" type="checkbox" />
                <span>Show this document to the client in their handover portal.</span>
              </label>
              <div className="flex justify-end">
                <SubmitButton icon={Upload} label="Save document" />
              </div>
            </form>
          </section>
          <ProjectSideTools
            filteredProducts={filteredProducts}
            productQuery={productQuery}
            projectId={project.id}
            setProductQuery={setProductQuery}
          />
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-3">
        <ItemColumn icon={PackageCheck} items={snapshot.readyItems} title="Package-ready" empty="No pre-approved items yet." />
        <ItemColumn icon={Bot} items={snapshot.awaitingAdmin} title="Awaiting admin" empty="No admin review items." showNudge />
        <ItemColumn icon={FileText} items={manualItems} title="Manual or draft" empty="Manual entries will appear here." />
      </section>

      <WorkflowReviewQueue
        items={snapshot.workflowItems}
        matches={snapshot.workflowMatches}
      />

      <section className="rounded-lg border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-950">Documents in this project</h3>
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-700">Upload processing</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {snapshot.workflowDocuments.length ? snapshot.workflowDocuments.map((document) => {
              const jobs = snapshot.workflowJobs.filter((job) => job.uploadedDocumentId === document.id);
              const latestJob = jobs[0];
              const items = snapshot.workflowItems.filter((item) => item.sourceDocumentId === document.id);

              return (
                <div className="rounded-md border border-slate-200 p-4" key={document.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-950">{document.originalFilename}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {document.fileType?.toUpperCase() || document.mimeType}
                      </p>
                    </div>
                    <WorkflowStatusPill status={document.processingStatus} />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Uploaded {formatDate(document.createdAt)}
                  </p>
                  {latestJob ? (
                    <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Extraction job</p>
                          <p className="mt-1 text-sm text-slate-700">
                            {formatWorkflowJobStatus(latestJob.status)}
                            {latestJob.retryCount ? ` - retry ${latestJob.retryCount}` : ""}
                          </p>
                        </div>
                        <WorkflowJobStatusPill status={latestJob.status} />
                      </div>
                      {latestJob.errorMessage ? (
                        <p className="mt-2 text-xs leading-5 text-rose-700">{latestJob.errorMessage}</p>
                      ) : null}
                      {(() => {
                        const usage = getWorkflowUsageMetrics(latestJob, items);

                        return usage ? (
                          <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 text-xs text-slate-600 sm:grid-cols-2">
                            <span>{formatUsageNumber(usage.extractedRowCount)} rows extracted</span>
                            <span>{formatUsageNumber(usage.uniqueIdentityCount)} unique identities</span>
                            <span>{formatUsageNumber(usage.duplicateIdentityCount)} duplicates</span>
                            <span>
                              {formatUsageNumber(usage.cacheHitCount)} cache hits / {formatUsageNumber(usage.cacheMissCount)} misses
                            </span>
                            {usage.openAiTotalTokens !== undefined ? (
                              <span>{formatUsageNumber(usage.openAiTotalTokens)} AI tokens</span>
                            ) : null}
                            {usage.openAiRequestCount !== undefined ? (
                              <span>{formatUsageNumber(usage.openAiRequestCount)} AI calls</span>
                            ) : null}
                            {usage.redactionReplacementCount !== undefined ? (
                              <span>{formatUsageNumber(usage.redactionReplacementCount)} redactions</span>
                            ) : null}
                            {usage.estimatedOpenAiCostUsd !== undefined ? (
                              <span>${usage.estimatedOpenAiCostUsd.toFixed(4)} estimated AI cost</span>
                            ) : null}
                            {usage.estimatedCostPerUniqueIdentityUsd !== undefined ? (
                              <span>${usage.estimatedCostPerUniqueIdentityUsd.toFixed(4)} / unique item</span>
                            ) : null}
                            {usage.sourceEnrichableUniqueIdentityCount !== undefined ? (
                              <span>{formatUsageNumber(usage.sourceEnrichableUniqueIdentityCount)} source-ready identities</span>
                            ) : null}
                            {usage.cloudflarePipeline ? (
                              <span className="sm:col-span-2">
                                Cloudflare dry-run: {formatCloudflarePipelineStatus(usage.cloudflarePipeline)}
                              </span>
                            ) : null}
                            {usage.cloudflarePipeline?.lastSyncedAt ? (
                              <span className="sm:col-span-2">
                                Pipeline status checked {formatDate(usage.cloudflarePipeline.lastSyncedAt)}
                              </span>
                            ) : null}
                          </div>
                        ) : null;
                      })()}
                      {(() => {
                        const usage = getWorkflowUsageMetrics(latestJob, items);

                        return usage?.cloudflarePipeline?.jobId && usage.cloudflarePipeline.status !== "skipped" ? (
                          <form action={syncCloudflarePipelineStatusAction} className="mt-3">
                            <input name="jobId" type="hidden" value={latestJob.id} />
                            <button
                              className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              type="submit"
                            >
                              Refresh pipeline status
                            </button>
                          </form>
                        ) : null;
                      })()}
                      {latestJob.status === "failed" ? (
                        <form action={retryDocumentExtractionJobAction} className="mt-3">
                          <input name="jobId" type="hidden" value={latestJob.id} />
                          <button
                            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            type="submit"
                          >
                            Retry extraction
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                  {items.length ? (
                    <div className="mt-3 space-y-2">
                      {items.map((item) => (
                        <div className="rounded-md border border-amber-100 bg-amber-50 p-3" key={item.id}>
                          {(() => {
                            const match = snapshot.workflowMatches.find((candidate) => candidate.extractedItemId === item.id);

                            return match ? (
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <WorkflowMatchStatusPill status={match.matchStatus} />
                                <span className="text-xs text-amber-800">{match.matchConfidenceScore}% match</span>
                              </div>
                            ) : null;
                          })()}
                          <p className="text-sm font-semibold text-amber-950">{item.productName || "Extracted item"}</p>
                          <p className="mt-1 text-xs text-amber-800">
                            {item.category || "Uncategorised"} - {item.reviewStatus.replaceAll("_", " ")}
                          </p>
                          {(() => {
                            const match = snapshot.workflowMatches.find((candidate) => candidate.extractedItemId === item.id);

                            return match?.matchReason ? (
                              <p className="mt-2 text-xs leading-5 text-amber-900">{match.matchReason}</p>
                            ) : null;
                          })()}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }) : <p className="text-sm text-slate-500">No workflow uploads have been registered yet.</p>}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {snapshot.documents.length ? snapshot.documents.map((document) => {
            const documentDownloads = snapshot.downloadEvents.filter((event) => event.documentId === document.id);
            const latestDownload = documentDownloads[0];

            return (
              <div className="rounded-md border border-slate-200 p-4" key={document.id}>
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

      <section className="rounded-lg border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-950">Maintenance in this project</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {snapshot.tasks.length ? snapshot.tasks.map((task) => (
            <div className="rounded-md border border-slate-200 p-4" key={task.id}>
              <p className="font-medium text-slate-950">{task.title}</p>
              <p className="mt-1 text-sm text-slate-600">{task.relatedProduct}</p>
              <p className="mt-2 text-xs text-slate-500">Due {formatDate(task.dueDate)} - {task.cadence}</p>
            </div>
          )) : <p className="text-sm text-slate-500">No maintenance tasks have been created for this project yet.</p>}
        </div>
      </section>
    </div>
  );
}

function WorkflowReviewQueue({
  items,
  matches,
}: {
  items: ExtractedWorkflowItem[];
  matches: ProductMatch[];
}) {
  const lanes = getWorkflowReviewLanes(items, matches);
  const unresolvedCount = lanes.readyToAccept.length + lanes.needsDetail.length + lanes.projectDocuments.length + lanes.searchResultsReady.length;

  return (
    <section className="rounded-lg border border-slate-200 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-950">Builder review lanes</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Accept known matches, add missing detail, attach project documents, and keep non-handover rows out of the client pack.
          </p>
        </div>
        <span className="w-fit rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
          {unresolvedCount} waiting for builder
        </span>
      </div>

      {items.length ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <WorkflowReviewLane
            empty="No high-confidence matches are waiting."
            icon={PackageCheck}
            items={lanes.readyToAccept}
            matches={matches}
            tone="emerald"
            title="Ready to accept"
          />
          <WorkflowReviewLane
            empty="No rows currently need more detail."
            icon={HelpCircle}
            items={lanes.needsDetail}
            matches={matches}
            tone="amber"
            title="Needs detail"
          />
          <WorkflowReviewLane
            empty="No quote, invoice, manual, or certificate placeholders."
            icon={FileText}
            items={lanes.projectDocuments}
            matches={matches}
            tone="cyan"
            title="Project documents/quotes"
          />
          <WorkflowReviewLane
            empty="Search remains paused until source results are wired in."
            icon={FileSearch}
            items={lanes.searchResultsReady}
            matches={matches}
            tone="slate"
            title="Search results ready"
          />
          <WorkflowReviewLane
            empty="No rows have been marked outside handover scope."
            icon={Layers3}
            items={lanes.notHandover}
            matches={matches}
            tone="rose"
            title="Not handover"
          />
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          No workflow items have been extracted for this project yet.
        </p>
      )}
    </section>
  );
}

function WorkflowReviewLane({
  empty,
  icon: Icon,
  items,
  matches,
  title,
  tone,
}: {
  empty: string;
  icon: ComponentType<{ className?: string }>;
  items: ExtractedWorkflowItem[];
  matches: ProductMatch[];
  title: string;
  tone: "emerald" | "amber" | "cyan" | "slate" | "rose";
}) {
  const toneStyles = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-900",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
  };

  return (
    <section className={`rounded-lg border p-4 ${toneStyles[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4" />
          <h4 className="font-semibold">{title}</h4>
        </div>
        <span className="rounded-md bg-white/80 px-2.5 py-1 text-xs font-semibold">{items.length}</span>
      </div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? <p className="text-sm opacity-80">{empty}</p> : null}
        {items.map((item) => (
          <WorkflowReviewCard item={item} key={item.id} match={matches.find((candidate) => candidate.extractedItemId === item.id)} />
        ))}
      </div>
    </section>
  );
}

function WorkflowReviewCard({
  item,
  match,
}: {
  item: ExtractedWorkflowItem;
  match?: ProductMatch;
}) {
  const contextSchema = getContextSchemaMetadata(item);
  const variation = getWorkflowVariationMetadata(item);
  const aiCategory = getAiSuggestedCategory(item);
  const quoteLike = isQuoteLikeWorkflowItem(item, contextSchema);
  const careGuidanceSource = getCareGuidanceSource(item);
  const comparisonRows = getWorkflowComparisonRows(item, variation, careGuidanceSource);

  return (
    <article className="rounded-md border border-white/70 bg-white p-3 text-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {match ? <WorkflowMatchStatusPill status={match.matchStatus} /> : null}
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {item.reviewStatus.replaceAll("_", " ")}
            </span>
            <span className="text-xs text-slate-500">{item.confidenceScore}% extraction confidence</span>
          </div>
          <h5 className="mt-3 font-semibold text-slate-950">{item.productName || "Unnamed extracted item"}</h5>
          <p className="mt-1 text-sm text-slate-600">
            {[item.manufacturer || item.brand, item.model, item.supplierName || item.supplier, item.location].filter(Boolean).join(" - ") || "Details need review"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-md bg-slate-100 px-2 py-1">AI category: {aiCategory || item.category || "Uncategorised"}</span>
            <span className="rounded-md bg-slate-100 px-2 py-1">Approved category: {item.builderApprovedCategory || item.category || "Not set"}</span>
            <span className="rounded-md bg-slate-100 px-2 py-1">{formatCareGuidanceSource(careGuidanceSource)}</span>
          </div>
          {match?.matchReason ? (
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-600">{match.matchReason}</p>
          ) : null}
          {contextSchema.classificationReason ? (
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-600">
              {formatContextClassification(contextSchema.contextClassification)}: {contextSchema.classificationReason}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={approveWorkflowItemAction}>
            <input name="itemId" type="hidden" value={item.id} />
            <button
              className="inline-flex h-9 items-center rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800"
              type="submit"
            >
              Approve
            </button>
          </form>
          <form action={markWorkflowItemBuilderSuppliedAction}>
            <input name="itemId" type="hidden" value={item.id} />
            <button
              className="inline-flex h-9 items-center rounded-md border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
              type="submit"
            >
              Builder supplied
            </button>
          </form>
        </div>
      </div>

      {contextSchema.missingFields.length || contextSchema.builderInfoNeeded.length || contextSchema.sourceEvidenceText ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {contextSchema.missingFields.length ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-amber-900">Missing fields</p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-900">
                {contextSchema.missingFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {contextSchema.builderInfoNeeded.length ? (
            <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-cyan-900">Ask builder for</p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-cyan-900">
                {contextSchema.builderInfoNeeded.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {contextSchema.sourceEvidenceText ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 md:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-normal text-slate-600">Document evidence</p>
              <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-700">{contextSchema.sourceEvidenceText}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <details className="mt-4 rounded-md border border-slate-200 bg-white">
        <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-800">
          Edit item, category, and variation
        </summary>
        <div className="border-t border-slate-100 p-3">
          <div className="rounded-md border border-slate-200 bg-slate-50">
            <div className="grid border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-normal text-slate-500 sm:grid-cols-[0.8fr_1fr_1fr]">
              <span>Field</span>
              <span>Original extracted</span>
              <span>Current edited</span>
            </div>
            <div className="divide-y divide-slate-200">
              {comparisonRows.map((row) => (
                <div className="grid gap-2 px-3 py-2 text-xs sm:grid-cols-[0.8fr_1fr_1fr]" key={row.label}>
                  <span className="font-semibold text-slate-700">{row.label}</span>
                  <span className="text-slate-500">{row.original}</span>
                  <span className={row.changed ? "font-semibold text-slate-950" : "text-slate-600"}>{row.current}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Original values come from the uploaded document where available. Older records may show fields as not captured until they are reprocessed or edited.
          </p>
        </div>
        <form action={editWorkflowItemAction} className="grid gap-4 border-t border-slate-100 p-3 md:grid-cols-2">
          <input name="itemId" type="hidden" value={item.id} />
          <TextField label="Product or item name" name="productName" defaultValue={item.productName} required />
          <TextField label="Manufacturer" name="manufacturer" defaultValue={item.manufacturer || item.brand} />
          <TextField label="Model" name="model" defaultValue={item.model || variation.model} />
          <SelectField
            label="Approved homeowner category"
            name="category"
            defaultValue={item.builderApprovedCategory || item.category || "General"}
            options={getCategoryOptions(item.builderApprovedCategory || item.category)}
          />
          <TextField label="Supplier" name="supplier" defaultValue={item.supplierName || item.supplier} />
          <TextField label="Supplier SKU" name="supplierSku" defaultValue={item.supplierSku} />
          <TextField label="Quantity" name="quantity" defaultValue={item.quantity || variation.quantity} />
          <TextField label="Finish" name="variantOrFinish" defaultValue={item.variantOrFinish || variation.finish} />
          <TextField label="Colour" name="colour" defaultValue={variation.colour} />
          <TextField label="Location" name="location" defaultValue={item.location} />
          <SelectField label="Care guidance label" name="careGuidanceSourceType" defaultValue={careGuidanceSource} options={careGuidanceSourceOptions} />
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Warranty information</span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              defaultValue={item.warrantyText}
              name="warrantyText"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Care or maintenance information</span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              defaultValue={item.maintenanceText}
              name="maintenanceText"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Review note</span>
            <input
              className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              name="notes"
              placeholder="What changed or why this is now ready?"
            />
          </label>
          <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600 md:col-span-2">
            Colour and quote details are saved with the review note so they remain visible during builder approval.
          </p>
          <div className="flex justify-end md:col-span-2">
            <button
              className="inline-flex h-9 items-center rounded-md bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800"
              type="submit"
            >
              Save edited item
            </button>
          </div>
        </form>
      </details>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <form action={uploadWorkflowItemSupportingDocumentAction} className="rounded-md border border-slate-200 bg-white p-3">
          <input name="itemId" type="hidden" value={item.id} />
          <input name="documentKind" type="hidden" value={quoteLike ? "quote" : "supporting_document"} />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              {quoteLike ? "Upload quote for this item" : "Supporting document"}
            </span>
            <input
              className="mt-2 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
              name="documentFile"
              type="file"
              accept=".csv,.doc,.docx,.gif,.jpeg,.jpg,.pdf,.png,.webp,.xls,.xlsx,application/pdf,image/gif,image/jpeg,image/png,image/webp,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            />
          </label>
          <input
            className="mt-3 h-10 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
            name="notes"
            placeholder={quoteLike ? "Quote supplier, quote number, or what it should resolve" : "Evidence note"}
          />
          <div className="mt-3 flex justify-end">
            <button
              className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              type="submit"
            >
              {quoteLike ? "Attach quote" : "Attach evidence"}
            </button>
          </div>
        </form>

        <form action={excludeWorkflowItemAction} className="rounded-md border border-rose-200 bg-white p-3">
          <input name="itemId" type="hidden" value={item.id} />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Exclude from handover</span>
            <input
              className="mt-2 h-10 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              name="exclusionReason"
              placeholder="Reason this should not go to the homeowner"
              required
            />
          </label>
          <div className="mt-3 flex justify-end">
            <button
              className="inline-flex h-9 items-center rounded-md border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              type="submit"
            >
              Exclude item
            </button>
          </div>
        </form>
      </div>
    </article>
  );
}

function SendPackagePanel({
  project,
  snapshot,
}: {
  project: Project;
  snapshot: {
    awaitingAdmin: ExtractedHandoverItem[];
    readyItems: ExtractedHandoverItem[];
    tasks: MaintenanceTask[];
    workflowDocuments: UploadedProjectDocument[];
    workflowJobs: DocumentExtractionJob[];
    workflowItems: ExtractedWorkflowItem[];
  };
}) {
  const approvedWorkflowItems = snapshot.workflowItems.filter((item) =>
    approvedWorkflowReviewStatuses.has(item.reviewStatus),
  );
  const excludedWorkflowItems = snapshot.workflowItems.filter((item) => item.reviewStatus === "excluded");
  const editedWorkflowItems = snapshot.workflowItems.filter((item) => item.reviewStatus === "edited_by_builder");
  const builderSuppliedWorkflowItems = snapshot.workflowItems.filter((item) => item.reviewStatus === "builder_supplied");
  const hasAiAssistedItems = snapshot.workflowItems.length > 0 || snapshot.readyItems.length > 0;
  const packageReadyCount = snapshot.readyItems.length + approvedWorkflowItems.length;
  const readiness = getWorkflowPublishReadiness({
    documents: snapshot.workflowDocuments,
    jobs: snapshot.workflowJobs,
    items: snapshot.workflowItems,
  });
  const canPublish = readiness.ready && packageReadyCount > 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
      <section className="rounded-lg border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-950">Package checks</h3>
        <div className="mt-4 space-y-3">
          <CheckRow label={`${packageReadyCount} approved package items`} ok={packageReadyCount > 0} />
          <CheckRow label={`${approvedWorkflowItems.length} approved workflow items`} ok={approvedWorkflowItems.length > 0} />
          <CheckRow label="Workflow processing complete" ok={readiness.ready} />
          <CheckRow label={`${snapshot.awaitingAdmin.length} items still awaiting admin`} ok={snapshot.awaitingAdmin.length === 0} />
          <CheckRow label={`${snapshot.tasks.length} maintenance tasks attached`} ok={snapshot.tasks.length > 0} />
        </div>
        {readiness.blockers.length ? (
          <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-semibold text-rose-900">Publish blocked</p>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-rose-800">
              {readiness.blockers.map((blocker) => (
                <li key={blocker.code}>
                  {blocker.label}: {blocker.count}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Builder confirmation: AI-assisted package details must be reviewed against the actual
          specification, warranties, and supplied documents before sending to the homeowner.
        </div>
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">Final approval summary</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <span>{packageReadyCount} items included</span>
            <span>{approvedWorkflowItems.length} workflow items reviewed</span>
            <span>{editedWorkflowItems.length} manually edited</span>
            <span>{builderSuppliedWorkflowItems.length} builder-supplied</span>
            <span>{excludedWorkflowItems.length} excluded</span>
            <span>{readiness.blockers.length} unresolved blockers</span>
            <span>{snapshot.tasks.length} maintenance reminders scheduled</span>
            <span>{snapshot.workflowDocuments.length} uploaded source documents</span>
          </div>
        </div>
        <form action={publishHandoverPackageAction} className="mt-5 space-y-4">
          <input name="projectId" type="hidden" value={project.id} />
          <label className="flex gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
            <input className="mt-1 size-4 accent-cyan-700" name="builderApprovalConfirmed" required type="checkbox" />
            <span>{builderHandoverApprovalText}</span>
          </label>
          {hasAiAssistedItems ? (
            <label className="flex gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
              <input className="mt-1 size-4 accent-cyan-700" name="aiApprovalConfirmed" required type="checkbox" />
              <span>{aiHandoverApprovalText}</span>
            </label>
          ) : null}
          <div className="flex justify-end">
            <SubmitButton disabled={!canPublish} icon={Send} label="Confirm and send package" />
          </div>
        </form>
      </section>
      <section className="rounded-lg border border-slate-200 p-5">
        <p className="text-sm font-semibold text-cyan-700">Sending package</p>
        <h3 className="mt-1 font-semibold text-slate-950">{project.name}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The homeowner portal will show only published, builder-reviewed package information for {project.clientName}.
        </p>
        {approvedWorkflowItems.length ? (
          <div className="mt-4 rounded-md border border-cyan-100 bg-cyan-50 p-3 text-sm leading-6 text-cyan-900">
            This draft includes approved workflow items. Raw AI extraction and unresolved review items stay builder-only.
          </div>
        ) : null}
        <ItemColumn icon={PackageCheck} items={snapshot.readyItems.slice(0, 5)} title="Preview items" empty="No items ready to send." />
        {approvedWorkflowItems.length ? (
          <div className="mt-4 space-y-2">
            {approvedWorkflowItems.slice(0, 5).map((item) => (
              <div className="rounded-md border border-slate-200 p-3" key={item.id}>
                <p className="text-sm font-semibold text-slate-950">{item.productName || "Approved workflow item"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.category || "Uncategorised"} - {item.reviewStatus.replaceAll("_", " ")}
                </p>
              </div>
            ))}
          </div>
        ) : null}
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
    <section className="rounded-lg border border-slate-200 p-5">
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
        <form action={createBuilderProjectRequestAction} className="mt-4 space-y-3">
          <input name="projectId" type="hidden" value={projectId} />
          <input name="requestType" type="hidden" value="product" />
          <TextField label="Request product" name="title" defaultValue={productQuery} placeholder="Brand, model, or product name" required />
          <TextField label="Location" name="location" placeholder="Kitchen, ensuite, exterior..." />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Details</span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none ring-cyan-700/20 placeholder:text-slate-400 focus:border-cyan-700 focus:ring-4"
              name="details"
              placeholder="What should admin look up or approve?"
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
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          Save the project first, then request missing products from inside the project workspace.
        </p>
      )}
    </section>
  );
}

function ItemColumn({
  empty,
  icon: Icon,
  items,
  showNudge,
  title,
}: {
  empty: string;
  icon: ComponentType<{ className?: string }>;
  items: ExtractedHandoverItem[];
  showNudge?: boolean;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 p-5">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-cyan-700" />
        <h3 className="font-semibold text-slate-950">{title}</h3>
      </div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? <p className="text-sm text-slate-500">{empty}</p> : null}
        {items.map((item) => (
          <article className="rounded-md border border-slate-200 p-3" key={item.id}>
            <p className="text-sm font-semibold text-slate-950">{item.title}</p>
            <p className="mt-1 text-xs text-slate-500">{item.location || "No location captured"}</p>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{item.extractedText}</p>
            {showNudge ? (
              <button
                className="mt-3 inline-flex h-8 items-center rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                type="button"
              >
                Nudge admin
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function HelpPanel() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <InfoCard
        icon={Plus}
        title="Create once"
        text="Start a project with client details first. Specification PDFs can be added now or later."
      />
      <InfoCard
        icon={Upload}
        title="Upload specs"
        text="PDF extraction proposes products, documents, and maintenance items inside the project workspace."
      />
      <InfoCard
        icon={Bot}
        title="Review uncertainty"
        text="Known records can become package-ready. New or uncertain items wait for admin approval."
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
    <div className="rounded-lg border border-slate-200 p-5">
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
      <p className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">{value}</p>
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

function WorkflowStatusPill({ status }: { status: UploadedProjectDocument["processingStatus"] }) {
  const styles = {
    uploaded: "border-cyan-200 bg-cyan-50 text-cyan-800",
    processing: "border-amber-200 bg-amber-50 text-amber-800",
    needs_review: "border-amber-200 bg-amber-50 text-amber-800",
    package_ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
    completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
    failed: "border-rose-200 bg-rose-50 text-rose-800",
  };
  const labels = {
    uploaded: "Uploaded",
    processing: "Processing",
    needs_review: "Needs review",
    package_ready: "Package ready",
    completed: "Completed",
    failed: "Failed",
  };

  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function WorkflowJobStatusPill({ status }: { status: DocumentExtractionJob["status"] }) {
  const styles = {
    uploaded: "border-cyan-200 bg-cyan-50 text-cyan-800",
    queued: "border-slate-200 bg-white text-slate-700",
    processing: "border-amber-200 bg-amber-50 text-amber-800",
    needs_review: "border-amber-200 bg-amber-50 text-amber-800",
    partially_reviewed: "border-indigo-200 bg-indigo-50 text-indigo-800",
    package_ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
    completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
    failed: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium ${styles[status]}`}>
      {formatWorkflowJobStatus(status)}
    </span>
  );
}

type WorkflowUsageMetrics = {
  extractedRowCount?: number;
  uniqueIdentityCount?: number;
  duplicateIdentityCount?: number;
  cacheHitCount?: number;
  cacheMissCount?: number;
  openAiTotalTokens?: number;
  openAiRequestCount?: number;
  redactionReplacementCount?: number;
  estimatedOpenAiCostUsd?: number;
  estimatedCostPerUniqueIdentityUsd?: number;
  sourceEnrichableUniqueIdentityCount?: number;
  cloudflarePipeline?: {
    status?: string;
    syncStatus?: string;
    reason?: string;
    jobId?: string;
    candidateCount?: number;
    batchCount?: number;
    completedBatchCount?: number;
    failedBatchCount?: number;
    resultsCount?: number;
    lastSyncedAt?: string;
    error?: string;
  };
};

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getWorkflowUsageMetrics(
  job: DocumentExtractionJob,
  items: ExtractedWorkflowItem[],
): WorkflowUsageMetrics | null {
  const rawUsage = job.usageMetrics || items.find((item) => {
    const usage = item.rawExtractedData?.usage;
    return Boolean(usage && typeof usage === "object");
  })?.rawExtractedData.usage;

  if (!rawUsage || typeof rawUsage !== "object") {
    return null;
  }

  const usage = rawUsage as Record<string, unknown>;
  const sourceCandidateBreakdown = usage.sourceCandidateBreakdown && typeof usage.sourceCandidateBreakdown === "object"
    ? usage.sourceCandidateBreakdown as Record<string, unknown>
    : {};
  const cloudflarePipeline = usage.cloudflarePipeline && typeof usage.cloudflarePipeline === "object"
    ? usage.cloudflarePipeline as WorkflowUsageMetrics["cloudflarePipeline"]
    : undefined;

  return {
    extractedRowCount: getNumber(usage.extractedRowCount),
    uniqueIdentityCount: getNumber(usage.uniqueIdentityCount),
    duplicateIdentityCount: getNumber(usage.duplicateIdentityCount),
    cacheHitCount: getNumber(usage.cacheHitCount),
    cacheMissCount: getNumber(usage.cacheMissCount),
    openAiTotalTokens: getNumber(usage.openAiTotalTokens),
    openAiRequestCount: getNumber(usage.openAiRequestCount),
    redactionReplacementCount: getNumber((usage.redaction as Record<string, unknown> | undefined)?.totalReplacementCount),
    estimatedOpenAiCostUsd: getNumber(usage.estimatedOpenAiCostUsd),
    estimatedCostPerUniqueIdentityUsd: getNumber(usage.estimatedCostPerUniqueIdentityUsd),
    sourceEnrichableUniqueIdentityCount: getNumber(sourceCandidateBreakdown.sourceEnrichableUniqueIdentityCount),
    cloudflarePipeline: cloudflarePipeline
      ? {
          status: typeof cloudflarePipeline.status === "string" ? cloudflarePipeline.status : undefined,
          syncStatus: typeof cloudflarePipeline.syncStatus === "string" ? cloudflarePipeline.syncStatus : undefined,
          reason: typeof cloudflarePipeline.reason === "string" ? cloudflarePipeline.reason : undefined,
          jobId: typeof cloudflarePipeline.jobId === "string" ? cloudflarePipeline.jobId : undefined,
          candidateCount: getNumber(cloudflarePipeline.candidateCount),
          batchCount: getNumber(cloudflarePipeline.batchCount),
          completedBatchCount: getNumber(cloudflarePipeline.completedBatchCount),
          failedBatchCount: getNumber(cloudflarePipeline.failedBatchCount),
          resultsCount: getNumber(cloudflarePipeline.resultsCount),
          lastSyncedAt: typeof cloudflarePipeline.lastSyncedAt === "string" ? cloudflarePipeline.lastSyncedAt : undefined,
          error: typeof cloudflarePipeline.error === "string" ? cloudflarePipeline.error : undefined,
        }
      : undefined,
  };
}

function formatUsageNumber(value: number | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "0";
}

function formatCloudflarePipelineStatus(pipeline: NonNullable<WorkflowUsageMetrics["cloudflarePipeline"]>) {
  if (pipeline.syncStatus === "failed") {
    return `status check failed${pipeline.error ? ` (${pipeline.error})` : ""}`;
  }

  if (pipeline.status === "queued") {
    return `${pipeline.candidateCount || 0} candidates queued${pipeline.batchCount ? ` in ${pipeline.batchCount} batches` : ""}`;
  }

  if (pipeline.status === "processing") {
    const completed = pipeline.completedBatchCount || 0;
    const failed = pipeline.failedBatchCount || 0;
    const total = pipeline.batchCount || completed + failed;
    return `${completed + failed}/${total} batches processed`;
  }

  if (pipeline.status === "completed") {
    const results = pipeline.resultsCount ?? pipeline.candidateCount ?? 0;
    return `completed dry-run for ${results} candidates`;
  }

  if (pipeline.status === "skipped") {
    return pipeline.reason === "not_configured" ? "not configured" : "no source-ready candidates";
  }

  if (pipeline.status === "failed") {
    return `dispatch failed${pipeline.error ? ` (${pipeline.error})` : ""}`;
  }

  return pipeline.status || "unknown";
}

function getContextSchemaMetadata(item: ExtractedWorkflowItem): ContextSchemaMetadata {
  const contextSchema = item.rawExtractedData?.contextSchema && typeof item.rawExtractedData.contextSchema === "object"
    ? item.rawExtractedData.contextSchema as Record<string, unknown>
    : {};
  const itemPayload = item.rawExtractedData?.item && typeof item.rawExtractedData.item === "object"
    ? item.rawExtractedData.item as Record<string, unknown>
    : {};

  return {
    itemType: getString(contextSchema.itemType) || getString(itemPayload.itemType),
    sourceEvidenceText: getString(contextSchema.sourceEvidenceText) || getString(itemPayload.sourceEvidenceText),
    missingFields: getStringList(contextSchema.missingFields ?? itemPayload.missingFields),
    builderInfoNeeded: getStringList(contextSchema.builderInfoNeeded ?? itemPayload.builderInfoNeeded),
    contextClassification: getString(contextSchema.contextClassification) || getString(itemPayload.contextClassification),
    classificationReason: getString(contextSchema.classificationReason) || getString(itemPayload.classificationReason),
  };
}

function getWorkflowReviewLanes(items: ExtractedWorkflowItem[], matches: ProductMatch[]) {
  const assigned = new Set<string>();
  const take = (predicate: (item: ExtractedWorkflowItem) => boolean) =>
    items.filter((item) => {
      if (assigned.has(item.id) || !predicate(item)) {
        return false;
      }

      assigned.add(item.id);
      return true;
    });

  const readyToAccept = take((item) => {
    const match = matches.find((candidate) => candidate.extractedItemId === item.id);
    return item.reviewStatus === "verified_match" || match?.matchStatus === "verified_match";
  });
  const projectDocuments = take((item) => {
    const metadata = getContextSchemaMetadata(item);
    return metadata.contextClassification === "project_document" || isQuoteLikeWorkflowItem(item, metadata);
  });
  const searchResultsReady = take((item) => {
    const raw = item.rawExtractedData || {};
    return Boolean(raw.sourceResults || raw.searchResults || raw.sourceReviewReady);
  });
  const notHandover = take((item) => {
    const metadata = getContextSchemaMetadata(item);
    return item.reviewStatus === "excluded"
      || metadata.contextClassification === "not_handover_relevant"
      || metadata.contextClassification === "admin_or_contract"
      || metadata.contextClassification === "generic_allowance";
  });
  const needsDetail = take((item) => {
    const metadata = getContextSchemaMetadata(item);
    return unresolvedWorkflowReviewStatuses.has(item.reviewStatus)
      || metadata.contextClassification === "builder_input_needed"
      || metadata.builderInfoNeeded.length > 0
      || metadata.missingFields.length > 0;
  });

  return {
    readyToAccept,
    needsDetail,
    projectDocuments,
    searchResultsReady,
    notHandover,
  };
}

function getNestedRecord(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getWorkflowVariationMetadata(item: ExtractedWorkflowItem) {
  const raw = item.rawExtractedData || {};
  const itemPayload = getNestedRecord(raw, "item");
  const variation = getNestedRecord(raw, "variation");
  const reviewMetadata = getNestedRecord(raw, "reviewMetadata");

  return {
    finish: getString(raw.finish) || getString(raw.variantOrFinish) || getString(itemPayload.finish) || getString(itemPayload.variantOrFinish) || getString(variation.finish) || getString(reviewMetadata.finish),
    colour: getString(raw.colour) || getString(raw.color) || getString(itemPayload.colour) || getString(itemPayload.color) || getString(variation.colour) || getString(reviewMetadata.colour),
    model: getString(raw.model) || getString(itemPayload.model) || getString(variation.model),
    quantity: getString(raw.quantity) || getString(itemPayload.quantity) || getString(variation.quantity) || getString(reviewMetadata.quantity),
  };
}

function getWorkflowComparisonRows(
  item: ExtractedWorkflowItem,
  variation: ReturnType<typeof getWorkflowVariationMetadata>,
  careGuidanceSource: string,
) {
  const originalValues = item.originalExtractedValues || {};
  const currentCategory = item.builderApprovedCategory || item.category || "";
  const rows = [
    {
      label: "Item",
      original: getOriginalValue(item, "productName") || item.productName,
      current: item.productName,
    },
    {
      label: "Manufacturer",
      original: getOriginalValue(item, "manufacturer") || getOriginalValue(item, "brand"),
      current: item.manufacturer || item.brand,
    },
    {
      label: "Model",
      original: getOriginalValue(item, "model") || variation.model,
      current: item.model || variation.model,
    },
    {
      label: "Supplier",
      original: getOriginalValue(item, "supplierName") || getOriginalValue(item, "supplier"),
      current: item.supplierName || item.supplier,
    },
    {
      label: "Quantity",
      original: getOriginalValue(item, "quantity") || variation.quantity,
      current: item.quantity || variation.quantity,
    },
    {
      label: "Finish",
      original: getOriginalValue(item, "variantOrFinish") || variation.finish,
      current: item.variantOrFinish || variation.finish,
    },
    {
      label: "Colour",
      original: getOriginalValue(item, "colour") || getOriginalValue(item, "color") || variation.colour,
      current: variation.colour,
    },
    {
      label: "Location",
      original: getOriginalValue(item, "location"),
      current: item.location,
    },
    {
      label: "Category",
      original: getOriginalValue(item, "aiSuggestedCategory") || getOriginalValue(item, "category") || item.aiSuggestedCategory || item.category,
      current: currentCategory,
    },
    {
      label: "Care label",
      original: formatCareGuidanceSource(getString(originalValues.careGuidanceSourceType) || careGuidanceSource),
      current: formatCareGuidanceSource(careGuidanceSource),
    },
  ];

  return rows.map((row) => {
    const original = formatComparisonValue(row.original);
    const current = formatComparisonValue(row.current);

    return {
      ...row,
      original,
      current,
      changed: original !== current,
    };
  });
}

function getOriginalValue(item: ExtractedWorkflowItem, key: string) {
  const originalValues = item.originalExtractedValues || {};
  const raw = item.rawExtractedData || {};
  const rawOriginalValues = getNestedRecord(raw, "originalExtractedValues");
  const itemPayload = getNestedRecord(raw, "item");

  return getString(originalValues[key])
    || getString(rawOriginalValues[key])
    || getString(itemPayload[key]);
}

function formatComparisonValue(value: unknown) {
  const text = getString(value);
  return text || "Not captured";
}

function getAiSuggestedCategory(item: ExtractedWorkflowItem) {
  const raw = item.rawExtractedData || {};
  const contextSchema = getNestedRecord(raw, "contextSchema");
  const itemPayload = getNestedRecord(raw, "item");

  return item.aiSuggestedCategory
    || getString(raw.aiCategory)
    || getString(raw.originalCategory)
    || getString(contextSchema.category)
    || getString(itemPayload.category);
}

function getCareGuidanceSource(item: ExtractedWorkflowItem) {
  const raw = item.rawExtractedData || {};
  const reviewMetadata = getNestedRecord(raw, "reviewMetadata");
  const value = item.careGuidanceSourceType || getString(raw.careGuidanceSource) || getString(reviewMetadata.careGuidanceSource);
  const allowed = new Set(careGuidanceSourceOptions.map((option) => option.value));

  if (allowed.has(value)) {
    return value;
  }

  if (item.maintenanceText && item.supplier) {
    return "supplier";
  }

  return item.maintenanceText ? "general_ai" : "manufacturer";
}

function formatCareGuidanceSource(value: string) {
  const option = careGuidanceSourceOptions.find((candidate) => candidate.value === value);
  return option?.label || "General AI care guidance";
}

function getCategoryOptions(current?: string) {
  if (!current || handoverCategoryOptions.some((option) => option.value === current)) {
    return handoverCategoryOptions;
  }

  return [{ label: current, value: current }, ...handoverCategoryOptions];
}

function isQuoteLikeWorkflowItem(item: ExtractedWorkflowItem, metadata = getContextSchemaMetadata(item)) {
  const haystack = [
    item.productName,
    item.category,
    item.supplier,
    item.quoteReferenceText,
    item.location,
    metadata.contextClassification,
    metadata.classificationReason,
    metadata.sourceEvidenceText,
    ...metadata.builderInfoNeeded,
    ...metadata.missingFields,
  ].filter(Boolean).join(" ").toLowerCase();

  return haystack.includes("quote")
    || haystack.includes("invoice")
    || haystack.includes("supplier schedule")
    || haystack.includes("as per")
    || haystack.includes("tbc by supplier");
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => getString(item)).filter(Boolean).slice(0, 8)
    : [];
}

function formatContextClassification(value?: string) {
  const labels: Record<string, string> = {
    source_ready: "Source-ready",
    builder_input_needed: "Builder input needed",
    project_document: "Project document",
    generic_allowance: "Generic allowance",
    admin_or_contract: "Admin or contract",
    not_handover_relevant: "Not handover-relevant",
  };

  return value ? labels[value] || value.replaceAll("_", " ") : "Document context";
}

function WorkflowMatchStatusPill({ status }: { status: ProductMatch["matchStatus"] }) {
  const styles = {
    verified_match: "border-emerald-200 bg-emerald-50 text-emerald-800",
    needs_review: "border-amber-200 bg-amber-50 text-amber-800",
    low_confidence: "border-orange-200 bg-orange-50 text-orange-800",
    unmatched: "border-rose-200 bg-rose-50 text-rose-800",
  };
  const labels = {
    verified_match: "Verified match",
    needs_review: "Needs review",
    low_confidence: "Low confidence",
    unmatched: "Unmatched",
  };

  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function formatWorkflowJobStatus(status: DocumentExtractionJob["status"]) {
  return status.replaceAll("_", " ").replace(/^\w/, (character) => character.toUpperCase());
}

function getModalEyebrow(mode: ModalMode) {
  if (mode === "create") {
    return "New project";
  }
  if (mode === "edit") {
    return "Project workspace";
  }
  if (mode === "send") {
    return "Package confirmation";
  }
  return "Projects help";
}

function getModalTitle(mode: ModalMode, project: Project | null) {
  if (mode === "create") {
    return "Add project";
  }
  if (mode === "edit") {
    return project?.name || "Edit project";
  }
  if (mode === "send") {
    return `Send ${project?.name || "package"}`;
  }
  return "How the project workflow works";
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
