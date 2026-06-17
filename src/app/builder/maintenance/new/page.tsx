import { CalendarPlus } from "lucide-react";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/layout/page-header";
import { projects } from "@/lib/data";
import { createMaintenanceTaskAction } from "@/lib/server/actions";

export default function NewMaintenanceTaskPage() {
  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Maintenance"
          title="Create maintenance task"
          description="Add the recurring care items that help homeowners protect warranties and keep the house in good shape."
        />

        <form action={createMaintenanceTaskAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField
              label="Project"
              name="projectId"
              options={projects.map((project) => ({ label: project.name, value: project.id }))}
              required
            />
            <TextField label="Task title" name="title" placeholder="Wash exterior cladding" required />
            <TextField label="Related product/system" name="relatedProduct" placeholder="Linea Weatherboard" />
            <TextField label="Due date" name="dueDate" required type="date" />
            <SelectField
              label="Frequency"
              name="frequency"
              options={[
                { label: "One-off", value: "One-off" },
                { label: "Monthly", value: "Monthly" },
                { label: "Every 6 months", value: "Every 6 months" },
                { label: "Every 12 months", value: "Every 12 months" },
                { label: "Every 24 months", value: "Every 24 months" },
              ]}
            />
          </div>
          <div className="mt-5 space-y-5">
            <TextAreaField
              label="Instructions"
              name="description"
              placeholder="Describe what the homeowner should do and what proof is useful."
            />
            <CheckboxField
              description="Use for tasks that the source documents say are required to maintain warranty coverage."
              label="Required for warranty"
              name="requiredForWarranty"
            />
          </div>
          <div className="mt-6 flex justify-end">
            <SubmitButton icon={CalendarPlus} label="Save task" />
          </div>
        </form>
      </div>
    </main>
  );
}
