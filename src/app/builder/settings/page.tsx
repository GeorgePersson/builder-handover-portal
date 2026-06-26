import Link from "next/link";
import { Building2, CreditCard, Mail, Settings, ShieldCheck, UserRoundCog } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SubmitButton } from "@/components/forms/submit-button";
import { StatusBanner } from "@/components/status-banner";
import { updateBuilderOrganisationAction } from "@/lib/server/actions";
import { getBuilderCreditStatus, getBuilderOrganisationSettings } from "@/lib/server/queries";

const settingsSections = [
  {
    icon: UserRoundCog,
    title: "Users",
    description: "Owner and team-member access will be managed here as the builder account grows.",
    fields: ["Owner account", "Builder admins", "Project staff"],
  },
  {
    icon: Mail,
    title: "Client messaging",
    description: "Client invite links are manual for now. Transactional email settings can be connected later.",
    fields: ["Invite sender", "Reply-to email", "Email delivery status"],
  },
  {
    icon: CreditCard,
    title: "Billing and credits",
    description: "Stripe-backed project credits will live here. Test accounts can be marked unlimited while billing is in setup.",
    fields: ["Credit balance", "Stripe customer", "Project credit price", "Webhook status"],
  },
  {
    icon: ShieldCheck,
    title: "Review checks",
    description: "Default builder confirmation copy and project handover liability reminders.",
    fields: ["Send-package confirmation", "AI/source warning", "Client portal disclaimer"],
  },
];

export default async function BuilderSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string; draft?: string; error?: string; storage?: string }>;
}) {
  const params = await searchParams;
  const [organisation, creditStatus] = await Promise.all([
    getBuilderOrganisationSettings(),
    getBuilderCreditStatus(),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          actions={
            <Link
              className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/builder/onboarding"
            >
              Edit setup
            </Link>
          }
          description="Account, organisation, contact, team, and builder confirmation settings for the portal."
          eyebrow="Builder workspace"
          icon={Settings}
          title="Settings"
        />
        <StatusBanner
          draft={params.billing === "success" || params.draft === "organisation-saved" ? "saved" : undefined}
          error={params.error}
          errorMessages={{
            "billing-requires-supabase": "Billing checkout requires Supabase auth and organisation context.",
            "stripe-checkout-failed": "Stripe checkout could not be started.",
            "stripe-not-configured": "Stripe keys and project credit price id are not configured yet.",
            "update-organisation-failed": "Organisation settings could not be updated.",
          }}
          storage={params.storage}
        />

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <Building2 className="mt-1 size-5 text-cyan-700" />
            <div>
              <h2 className="font-semibold text-slate-950">Organisation</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                These details appear in builder-side account records and can be reused for handover communications.
              </p>
            </div>
          </div>
          <form action={updateBuilderOrganisationAction} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Organisation name
              <input
                className="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-950 outline-none focus:border-cyan-700"
                defaultValue={organisation.name}
                name="name"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Trading name
              <input
                className="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-950 outline-none focus:border-cyan-700"
                defaultValue={organisation.tradingName}
                name="tradingName"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Public email
              <input
                className="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-950 outline-none focus:border-cyan-700"
                defaultValue={organisation.contactEmail}
                name="contactEmail"
                type="email"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Main phone
              <input
                className="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-950 outline-none focus:border-cyan-700"
                defaultValue={organisation.contactPhone}
                name="contactPhone"
                type="tel"
              />
            </label>
            <div className="md:col-span-2">
              <SubmitButton icon={Building2} label="Save organisation" />
            </div>
          </form>
        </section>

        <section className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="size-5 text-cyan-700" />
                <h2 className="font-semibold text-slate-950">Buy project credits</h2>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-900">
                This starts a Stripe Checkout session when billing keys are configured. Current balance:{" "}
                {creditStatus.availableCredits === "infinite" ? "infinite" : creditStatus.availableCredits} credits.
              </p>
            </div>
            <form action="/api/billing/checkout" className="flex flex-wrap gap-2" method="post">
              <select
                className="h-10 rounded-md border border-cyan-200 bg-white px-3 text-sm text-slate-950"
                name="quantity"
                defaultValue="5"
              >
                <option value="1">1 credit</option>
                <option value="5">5 credits</option>
                <option value="10">10 credits</option>
                <option value="25">25 credits</option>
              </select>
              <button
                className="inline-flex h-10 items-center rounded-md bg-cyan-700 px-3 text-sm font-semibold text-white hover:bg-cyan-800"
                type="submit"
              >
                Open checkout
              </button>
            </form>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {settingsSections.map((section) => (
            <article className="rounded-lg border border-slate-200 bg-white p-5" key={section.title}>
              <section.icon className="size-5 text-cyan-700" />
              <h2 className="mt-3 font-semibold text-slate-950">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{section.description}</p>
              <div className="mt-5 grid gap-3">
                {section.fields.map((field) => (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2" key={field}>
                    <p className="text-xs font-semibold uppercase text-slate-500">{field}</p>
                    <p className="mt-1 text-sm text-slate-700">Ready for account data</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
