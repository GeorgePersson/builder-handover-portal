import { FileUp } from "lucide-react";
import { SelectField, TextField } from "@/components/forms/form-field";
import { SpecExtractPanel } from "@/components/forms/spec-extract-panel";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/layout/page-header";
import { getProjects } from "@/lib/server/queries";
import { createSpecificationUploadAction } from "@/lib/server/actions";

export default async function NewSpecificationPage() {
  const projects = await getProjects();

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          description="This is the main intake path: upload the project specification, run extraction, then review the proposed handover package."
          eyebrow="Specification intelligence"
          icon={FileUp}
          title="Upload specification PDF"
        />

        <SpecExtractPanel projects={projects.map((project) => ({ id: project.id, name: project.name }))} />

        <details className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">
            Manual register fallback
          </summary>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Use this only when a specification needs to be tracked without running extraction.
          </p>
          <form action={createSpecificationUploadAction} className="mt-5">
            <div className="grid gap-5 md:grid-cols-2">
              <SelectField
                label="Project"
                name="projectId"
                options={projects.map((project) => ({ label: project.name, value: project.id }))}
                required
              />
              <TextField label="Specification file name" name="fileName" placeholder="Project specification.pdf" required />
              <TextField label="Storage path" name="storagePath" placeholder="project-id/specifications/file.pdf" />
              <label className="block">
                <span className="text-sm font-medium text-slate-700">PDF file</span>
                <input
                  accept="application/pdf"
                  className="mt-2 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
                  name="specificationPdf"
                  type="file"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end">
              <SubmitButton icon={FileUp} label="Register specification" />
            </div>
          </form>
        </details>
      </div>
    </main>
  );
}
