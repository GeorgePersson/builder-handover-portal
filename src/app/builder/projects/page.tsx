import { redirect } from "next/navigation";
import { ProjectsWorkspace } from "@/components/builder/projects-workspace";
import {
  getExtractedHandoverItems,
  getMaintenanceTasks,
  getProductVersions,
  getProjects,
  getSpecificationUploads,
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

  const [projects, specifications, extractedItems, maintenanceTasks, productVersions] =
    await Promise.all([
      getProjects(),
      getSpecificationUploads(),
      getExtractedHandoverItems(),
      getMaintenanceTasks(),
      getProductVersions(),
    ]);

  return (
    <ProjectsWorkspace
      draft={params.draft}
      error={params.error}
      extractedItems={extractedItems}
      inviteToken={params.inviteToken}
      maintenanceTasks={maintenanceTasks}
      productVersions={productVersions}
      projects={projects}
      specifications={specifications}
      storage={params.storage}
    />
  );
}
