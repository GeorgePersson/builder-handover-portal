import { Building2 } from "lucide-react";
import { TextField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { createBuilderWorkspaceAction } from "@/lib/server/actions";

const errorMessages: Record<string, string> = {
  "create-workspace-failed": "The builder workspace could not be created. Check the Supabase bootstrap migration and try again.",
};

function getSafeNext(value?: string) {
  if (!value || !value.startsWith("/builder") || value.startsWith("//") || value.startsWith("/builder/onboarding")) {
    return "/builder/projects";
  }

  return value;
}

export default async function BuilderOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = getSafeNext(params.next);

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header>
          <div className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
            <Building2 className="size-4" />
            Builder setup
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
            Create your builder workspace
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Add your company details once, then projects, specifications, and client handovers will
            be attached to this workspace.
          </p>
        </header>

        {params.error ? (
          <p className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800">
            {errorMessages[params.error] || errorMessages["create-workspace-failed"]}
          </p>
        ) : null}

        <form action={createBuilderWorkspaceAction} className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <input name="next" type="hidden" value={next} />
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Organisation name" name="orgName" placeholder="Demo Builder Co" required />
            <TextField label="Trading name" name="tradingName" placeholder="Demo Homes" />
            <TextField label="Contact phone" name="contactPhone" placeholder="+64 21 000 0000" />
          </div>
          <div className="mt-6 flex justify-end">
            <SubmitButton icon={Building2} label="Create workspace" />
          </div>
        </form>
      </div>
    </main>
  );
}
