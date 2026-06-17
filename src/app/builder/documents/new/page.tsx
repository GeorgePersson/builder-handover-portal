import { Upload } from "lucide-react";
import { CheckboxField, SelectField, TextField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/layout/page-header";
import { projects } from "@/lib/data";
import { createDocumentAction } from "@/lib/server/actions";

export default function NewDocumentPage() {
  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Document register"
          title="Add document metadata"
          description="The real file upload will connect to Supabase Storage; this page captures the metadata and client visibility rules."
        />

        <form action={createDocumentAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField
              label="Project"
              name="projectId"
              options={projects.map((project) => ({ label: project.name, value: project.id }))}
              required
            />
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
            <TextField label="Document name" name="name" placeholder="Window warranty schedule.pdf" required />
            <TextField label="Storage path" name="storagePath" placeholder="project-id/documents/file.pdf" />
          </div>
          <div className="mt-5">
            <CheckboxField
              description="Only approved homeowner-facing documents should be visible in the client portal."
              label="Visible to client"
              name="visibleToClient"
            />
          </div>
          <div className="mt-6 flex justify-end">
            <SubmitButton icon={Upload} label="Save document" />
          </div>
        </form>
      </div>
    </main>
  );
}
