import { Bot, Save } from "lucide-react";
import { SelectField, TextAreaField, TextField } from "@/components/forms/form-field";
import { ProductAiDraftPanel } from "@/components/forms/product-ai-draft-panel";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/layout/page-header";
import { createProductAction } from "@/lib/server/actions";

export default function NewProductPage() {
  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Product library"
          title="Add product"
          description="Start with the strongest identity details you have. Brand, model, and supplier URL make the AI lookup safer."
          icon={Bot}
        />

        <form action={createProductAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Product name" name="productName" placeholder="Linea Weatherboard" required />
            <TextField label="Brand/manufacturer" name="brand" placeholder="James Hardie" />
            <SelectField
              label="Category"
              name="category"
              options={[
                { label: "Cladding", value: "Cladding" },
                { label: "Roofing", value: "Roofing" },
                { label: "Windows and doors", value: "Windows and doors" },
                { label: "Appliance", value: "Appliance" },
                { label: "Plumbing fitting", value: "Plumbing fitting" },
                { label: "Paint/coating", value: "Paint/coating" },
                { label: "Other", value: "Other" },
              ]}
              required
            />
            <TextField label="Model/series" name="model" placeholder="Optional but strongly recommended" />
            <TextField label="Supplier or manufacturer URL" name="supplierUrl" placeholder="https://..." type="url" />
            <TextField label="Location in property" name="location" placeholder="Exterior envelope" />
          </div>
          <div className="mt-5">
            <TextAreaField
              label="Builder notes"
              name="notes"
              placeholder="Any install context, finish, exposure zone, or product variant notes."
            />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <ProductAiDraftPanel />
            <SubmitButton icon={Save} label="Save product" />
          </div>
        </form>
      </div>
    </main>
  );
}
