import { Mail } from "lucide-react";
import { TextField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { requestMagicLinkAction } from "@/lib/server/auth-actions";

const errorMessages: Record<string, string> = {
  "callback-failed": "The sign-in link could not be verified. Request a fresh magic link and try again.",
  "callback-missing-code": "The sign-in link was missing its verification code. Request a fresh magic link.",
  "email-provider": "Supabase could not send the email. Check Auth email provider settings or wait for the built-in email limit to reset.",
  "magic-link-failed": "Sign-in could not be completed. Check the Supabase auth settings and try again.",
  "rate-limit": "Supabase is rate-limiting magic links right now. Wait a bit, then request another link.",
  "redirect-url":
    "Supabase rejected the redirect URL. Add this app's /auth/callback URL in Supabase Auth redirect settings.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; sent?: string; mode?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-700 text-white">
            <Mail className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-cyan-700">Builder Handover</p>
            <h1 className="text-xl font-semibold tracking-normal">Sign in</h1>
          </div>
        </div>

        {params.sent ? (
          <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">
            Magic link requested. Check your email to continue.
          </p>
        ) : null}
        {params.mode === "stub" ? (
          <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
            Supabase keys are not configured yet, so auth is running in local scaffold mode.
          </p>
        ) : null}
        {params.error ? (
          <p className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800">
            {errorMessages[params.error] ?? errorMessages["magic-link-failed"]}
          </p>
        ) : null}

        <form action={requestMagicLinkAction} className="mt-6 space-y-5">
          <input name="next" type="hidden" value={params.next || "/builder/projects"} />
          <TextField label="Email address" name="email" placeholder="you@example.co.nz" required type="email" />
          <div className="flex justify-end">
            <SubmitButton icon={Mail} label="Send magic link" />
          </div>
        </form>
      </section>
    </main>
  );
}
