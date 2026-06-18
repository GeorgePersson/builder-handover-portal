import { redirect } from "next/navigation";
import { Save } from "lucide-react";
import { TextField, SelectField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/layout/page-header";
import { createProjectAction } from "@/lib/server/actions";
import { hasBuilderWorkspace } from "@/lib/server/queries";

export default async function NewProjectPage() {
  if (!(await hasBuilderWorkspace())) {
    redirect("/builder/onboarding?next=/builder/projects/new");
  }

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Project setup"
          title="Create project"
          description="Capture the property, client, and handover basics before documents and products are attached."
        />

        <form action={createProjectAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Project name" name="name" placeholder="Bayview Road New Build" required />
            <SelectField
              label="Project type"
              name="projectType"
              options={[
                { label: "New residential build", value: "New residential build" },
                { label: "Full renovation", value: "Full renovation" },
                { label: "Bathroom renovation", value: "Bathroom renovation" },
                { label: "Kitchen renovation", value: "Kitchen renovation" },
                { label: "Reclad project", value: "Reclad project" },
                { label: "Roofing project", value: "Roofing project" },
              ]}
              required
            />
            <TextField label="Property address" name="address" placeholder="18 Bayview Road, Tauranga" required />
            <TextField label="Target handover date" name="handoverDate" type="date" />
            <TextField label="Client name" name="clientName" placeholder="Amelia and Noah Smith" required />
            <TextField label="Client email" name="clientEmail" placeholder="client@example.co.nz" required type="email" />
          </div>
          <div className="mt-6 flex justify-end">
            <SubmitButton icon={Save} label="Save project" />
          </div>
        </form>
      </div>
    </main>
  );
}
