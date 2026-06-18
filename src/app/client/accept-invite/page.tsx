import Link from "next/link";
import { CheckCircle2, LogIn } from "lucide-react";
import { SubmitButton } from "@/components/forms/submit-button";
import { acceptClientInviteAction } from "@/lib/server/actions";

const errorMessages: Record<string, string> = {
  "invalid-invite": "This invite link could not be accepted. Sign in with the invited email address, or ask the builder for a fresh link.",
};

export default async function ClientAcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const token = params.token || "";

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10 text-slate-950">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-cyan-700 text-white">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-cyan-700">Client invite</p>
            <h1 className="mt-1 text-xl font-semibold tracking-normal">Connect your home manual</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Accepting this invite connects your signed-in account to the builder project, then
              opens the client portal for the published handover package. Use the same email address
              the builder invited.
            </p>
          </div>
        </div>

        {params.mode === "stub" ? (
          <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
            Supabase is not configured, so invite acceptance is only available after the backend is connected.
          </p>
        ) : null}
        {params.error ? (
          <p className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800">
            {errorMessages[params.error] || errorMessages["invalid-invite"]}
          </p>
        ) : null}
        {!token ? (
          <p className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800">
            This invite link is missing its token. Ask the builder for a fresh invite link.
          </p>
        ) : null}

        <form action={acceptClientInviteAction} className="mt-6 flex justify-end">
          <input name="token" type="hidden" value={token} />
          <SubmitButton disabled={!token} icon={CheckCircle2} label="Accept invite" />
        </form>

        <Link
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          href="/login"
        >
          <LogIn className="size-4" />
          Sign in with a different email
        </Link>
      </section>
    </main>
  );
}
