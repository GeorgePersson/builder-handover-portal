import { CreditCard, ReceiptText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type CreditAccountRow = {
  organisation_id: string;
  stripe_customer_id: string | null;
  credit_balance: number;
  unlimited: boolean;
  updated_at: string;
  organisations?: { name?: string } | Array<{ name?: string }> | null;
};

type CreditEventRow = {
  id: string;
  organisation_id: string;
  stripe_event_id: string | null;
  event_type: string;
  credit_delta: number;
  balance_after: number | null;
  notes: string | null;
  created_at: string;
  organisations?: { name?: string } | Array<{ name?: string }> | null;
};

async function getBillingRows() {
  try {
    const supabase = createSupabaseAdminClient();
    const [accountsResult, eventsResult] = await Promise.all([
      supabase
        .from("project_credit_accounts")
        .select("organisation_id,stripe_customer_id,credit_balance,unlimited,updated_at,organisations(name)")
        .order("updated_at", { ascending: false }),
      supabase
        .from("project_credit_events")
        .select("id,organisation_id,stripe_event_id,event_type,credit_delta,balance_after,notes,created_at,organisations(name)")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (accountsResult.error || eventsResult.error) {
      return {
        accounts: [] as CreditAccountRow[],
        events: [] as CreditEventRow[],
        setupError: "Billing tables are not available yet.",
      };
    }

    return {
      accounts: (accountsResult.data || []) as CreditAccountRow[],
      events: (eventsResult.data || []) as CreditEventRow[],
      setupError: null,
    };
  } catch {
    return {
      accounts: [] as CreditAccountRow[],
      events: [] as CreditEventRow[],
      setupError: "Billing requires Supabase service-role configuration.",
    };
  }
}

export default async function AdminBillingPage() {
  const { accounts, events, setupError } = await getBillingRows();
  const totalCredits = accounts.reduce((sum, account) => sum + account.credit_balance, 0);
  const unlimitedAccounts = accounts.filter((account) => account.unlimited).length;

  return (
    <main className="px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          description="Operational view for project-credit balances, Stripe customer links, and credit ledger events."
          eyebrow="Platform billing"
          icon={CreditCard}
          title="Billing"
        />

        {setupError ? (
          <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 text-amber-700" />
              <div>
                <h2 className="font-semibold text-amber-950">Billing setup incomplete</h2>
                <p className="mt-2 text-sm leading-6 text-amber-800">{setupError}</p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <Metric label="Credit accounts" value={accounts.length} />
          <Metric label="Available credits" value={totalCredits} />
          <Metric label="Unlimited accounts" value={unlimitedAccounts} />
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-950">Credit accounts</h2>
            <p className="mt-1 text-sm text-slate-500">Balances used when builders create projects.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Organisation</th>
                  <th className="px-5 py-3">Balance</th>
                  <th className="px-5 py-3">Mode</th>
                  <th className="px-5 py-3">Stripe customer</th>
                  <th className="px-5 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((account) => (
                  <tr key={account.organisation_id}>
                    <td className="px-5 py-4 font-medium text-slate-950">{getOrganisationName(account.organisations)}</td>
                    <td className="px-5 py-4 text-slate-700">{account.credit_balance}</td>
                    <td className="px-5 py-4 text-slate-700">{account.unlimited ? "Unlimited" : "Metered"}</td>
                    <td className="px-5 py-4 text-slate-600">{account.stripe_customer_id || "Not linked"}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(account.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <ReceiptText className="size-5 text-cyan-700" />
            <h2 className="font-semibold text-slate-950">Recent credit events</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {events.length === 0 ? <p className="p-5 text-sm text-slate-500">No credit events recorded yet.</p> : null}
            {events.map((event) => (
              <article className="grid gap-3 p-5 md:grid-cols-[1fr_auto]" key={event.id}>
                <div>
                  <p className="text-sm font-semibold text-slate-950">{event.event_type.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{event.notes || "No notes recorded."}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {getOrganisationName(event.organisations)} - {formatDate(event.created_at)}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-semibold text-slate-950">
                    {event.credit_delta > 0 ? "+" : ""}
                    {event.credit_delta}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Balance {event.balance_after ?? "pending"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function getOrganisationName(value: CreditAccountRow["organisations"] | CreditEventRow["organisations"]) {
  const organisation = Array.isArray(value) ? value[0] : value;
  return organisation?.name || "Unknown organisation";
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}
