import { redirect } from "next/navigation";
import { ProjectsWorkspace } from "@/components/builder/projects-workspace";
import {
  getBuilderCreditStatus,
  getDocumentExtractionJobs,
  getDocumentDownloadEvents,
  getDocuments,
  getExtractedHandoverItems,
  getExtractedWorkflowItems,
  getHandoverOpenEvents,
  getMaintenanceTasks,
  getProductVersions,
  getProjects,
  getProductMatches,
  getProjectHandoverChecklistItems,
  getSpecificationUploads,
  getUploadedProjectDocuments,
  hasBuilderWorkspace,
} from "@/lib/server/queries";

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
  if (!(await hasBuilderWorkspace())) {
    redirect("/builder/onboarding?next=/builder/projects");
  }

  const [
    projects,
    specifications,
    extractedItems,
    maintenanceTasks,
    productVersions,
    documents,
    downloadEvents,
    uploadedDocuments,
    extractionJobs,
    extractedWorkflowItems,
    productMatches,
    handoverOpenEvents,
    checklistItems,
    creditStatus,
  ] =
    await Promise.all([
      getProjects(),
      getSpecificationUploads(),
      getExtractedHandoverItems(),
      getMaintenanceTasks(),
      getProductVersions(),
      getDocuments(),
      getDocumentDownloadEvents(),
      getUploadedProjectDocuments(),
      getDocumentExtractionJobs(),
      getExtractedWorkflowItems(),
      getProductMatches(),
      getHandoverOpenEvents(),
      getProjectHandoverChecklistItems(),
      getBuilderCreditStatus(),
    ]);

  return (
    <ProjectsWorkspace
      creditStatus={creditStatus}
      draft={params.draft}
      downloadEvents={downloadEvents}
      documents={documents}
      error={params.error}
      extractedItems={extractedItems}
      extractedWorkflowItems={extractedWorkflowItems}
      extractionJobs={extractionJobs}
      initialProjectId={params.projectId}
      inviteToken={params.inviteToken}
      maintenanceTasks={maintenanceTasks}
      productVersions={productVersions}
      productMatches={productMatches}
      projects={projects}
      handoverOpenEvents={handoverOpenEvents}
      checklistItems={checklistItems}
      specifications={specifications}
      storage={params.storage}
      uploadedDocuments={uploadedDocuments}
    />
  );
}
