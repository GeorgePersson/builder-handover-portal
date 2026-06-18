import Link from "next/link";
import { Building2, Mail, Settings, ShieldCheck, UserRoundCog } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

const settingsSections = [
  {
    icon: Building2,
    title: "Organisation",
    description: "Trading name, legal name, address, and public contact details for handover packages.",
    fields: ["Organisation name", "Trading name", "Main phone", "Public email"],
  },
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
    icon: ShieldCheck,
    title: "Review checks",
    description: "Default builder confirmation copy and project handover liability reminders.",
    fields: ["Send-package confirmation", "AI/source warning", "Client portal disclaimer"],
  },
];

export default function BuilderSettingsPage() {
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
