import { redirect } from "next/navigation";
import { ProjectsWorkspace } from "@/components/builder/projects-workspace";
import {
  getBuilderCreditStatus,
  getDocumentExtractionJobs,
  getDocumentDownloadEvents,
  getDocuments,
  getExtractedHandoverItems,
  getExtractedWorkflowItems,
  getMaintenanceTasks,
  getProductVersions,
  getProjects,
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
      inviteToken={params.inviteToken}
      maintenanceTasks={maintenanceTasks}
      productVersions={productVersions}
      projects={projects}
      specifications={specifications}
      storage={params.storage}
      uploadedDocuments={uploadedDocuments}
    />
  );
}
