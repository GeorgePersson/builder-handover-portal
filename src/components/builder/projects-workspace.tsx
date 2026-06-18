"use client";

import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  Bell,
  Bot,
  CalendarCheck2,
  FileText,
  HelpCircle,
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
import {
  createBuilderProjectRequestAction,
  createClientInviteAction,
  createDocumentAction,
  createProjectAction,
  createSpecificationUploadAction,
  publishHandoverPackageAction,
  revokeClientInviteAction,
  updateProjectAction,
} from "@/lib/server/actions";
import { formatDate } from "@/lib/utils";
import type {
  ExtractedHandoverItem,
  HandoverDocument,
  MaintenanceTask,
  ProductVersion,
  Project,
  SpecificationUpload,
} from "@/lib/types";

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
  documents: HandoverDocument[];
  projects: Project[];
  specifications: SpecificationUpload[];
  extractedItems: ExtractedHandoverItem[];
  maintenanceTasks: MaintenanceTask[];
  productVersions: ProductVersion[];
};

type ModalMode = "create" | "edit" | "send" | "help" | null;

const packageReadyStatuses = new Set(["accepted", "auto_approved", "builder_approved", "global_approved"]);
const adminReviewStatuses = new Set(["admin_review", "edited", "proposed"]);

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
  documents,
  projects,
  specifications,
  extractedItems,
  maintenanceTasks,
  productVersions,
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

        return {
          project,
          awaitingAdmin,
          documents: projectDocuments,
          readyItems,
          specifications: specifications.filter((specification) => specification.projectId === project.id),
          tasks,
        };
      }),
    [documents, extractedItems, maintenanceTasks, projects, specifications],
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
          draft={draft === "invite-created" || draft === "invite-revoked" ? undefined : draft}
          error={error}
          errorMessages={{
            "client-already-accepted": "That client has already accepted their invite.",
            "client-not-found": "No client record was found for that project.",
            "credit-check-failed": "Project credits could not be checked.",
            "credit-deduct-failed": "The project credit could not be deducted.",
            "credit-event-failed": "The project credit event could not be recorded.",
            "create-client-invite-failed": "The client invite link could not be created.",
            "create-request-failed": "The missing item request could not be created.",
            "insufficient-project-credits": "This organisation does not have a project credit available yet.",
            "no-organisation": "No builder workspace exists for this account yet. Open Builder setup to finish account setup.",
            "publish-package-failed": "The handover package could not be published for this project.",
            "revoke-client-invite-failed": "The client invite link could not be revoked.",
            "project-credit-not-confirmed": "Confirm project credit use before creating the project.",
            "update-project-failed": "The project could not be updated.",
            "upload-document-failed": "The document file could not be uploaded.",
          }}
          storage={storage}
        />

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
            {projectSnapshots.map(({ project, awaitingAdmin, readyItems, specifications: projectSpecs, tasks }) => (
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
    documents: HandoverDocument[];
    readyItems: ExtractedHandoverItem[];
    specifications: SpecificationUpload[];
    tasks: MaintenanceTask[];
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
            <div className="mt-4 flex flex-wrap gap-2">
              {project.clientInviteStatus === "accepted" ? null : (
                <form action={createClientInviteAction}>
                  <input name="projectId" type="hidden" value={project.id} />
                  <SubmitButton
                    icon={Link2}
                    label={project.clientInviteStatus === "invited" ? "Regenerate invite" : "Create invite"}
                  />
                </form>
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

      <section className="rounded-lg border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-950">Documents in this project</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {snapshot.documents.length ? snapshot.documents.map((document) => (
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
              {document.storagePath ? (
                <a
                  className="mt-4 inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  href={`/api/documents/${document.id}/download`}
                >
                  Download
                </a>
              ) : null}
            </div>
          )) : <p className="text-sm text-slate-500">No client documents have been added yet.</p>}
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

function SendPackagePanel({
  project,
  snapshot,
}: {
  project: Project;
  snapshot: {
    awaitingAdmin: ExtractedHandoverItem[];
    readyItems: ExtractedHandoverItem[];
    tasks: MaintenanceTask[];
  };
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
      <section className="rounded-lg border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-950">Package checks</h3>
        <div className="mt-4 space-y-3">
          <CheckRow label={`${snapshot.readyItems.length} package-ready items`} ok={snapshot.readyItems.length > 0} />
          <CheckRow label={`${snapshot.awaitingAdmin.length} items still awaiting admin`} ok={snapshot.awaitingAdmin.length === 0} />
          <CheckRow label={`${snapshot.tasks.length} maintenance tasks attached`} ok={snapshot.tasks.length > 0} />
        </div>
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Builder confirmation: AI-assisted package details must be reviewed against the actual
          specification, warranties, and supplied documents before sending to the homeowner.
        </div>
        <form action={publishHandoverPackageAction} className="mt-5 flex justify-end">
          <input name="projectId" type="hidden" value={project.id} />
          <SubmitButton icon={Send} label="Confirm and send package" />
        </form>
      </section>
      <section className="rounded-lg border border-slate-200 p-5">
        <p className="text-sm font-semibold text-cyan-700">Sending package</p>
        <h3 className="mt-1 font-semibold text-slate-950">{project.name}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The homeowner portal will show only published, builder-reviewed package information for {project.clientName}.
        </p>
        <ItemColumn icon={PackageCheck} items={snapshot.readyItems.slice(0, 5)} title="Preview items" empty="No items ready to send." />
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
