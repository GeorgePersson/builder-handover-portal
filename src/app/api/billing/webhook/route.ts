import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StripeCheckoutSession = {
  id: string;
  customer?: string | null;
  metadata?: {
    organisation_id?: string;
    credit_quantity?: string;
  };
};

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: StripeCheckoutSession;
  };
};

function getSignatureParts(signatureHeader: string) {
  return signatureHeader.split(",").reduce(
    (parts, item) => {
      const [key, value] = item.split("=");
      if (key === "t") {
        parts.timestamp = value;
      }
      if (key === "v1") {
        parts.signatures.push(value);
      }
      return parts;
    },
    { signatures: [] as string[], timestamp: "" },
  );
}

function verifyStripeSignature(payload: string, signatureHeader: string, endpointSecret: string) {
  const { signatures, timestamp } = getSignatureParts(signatureHeader);

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const expectedSignature = createHmac("sha256", endpointSecret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  return signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, "hex");
    return (
      signatureBuffer.length === expectedBuffer.length &&
      timingSafeEqual(signatureBuffer, expectedBuffer)
    );
  });
}

function isMissingBillingRpc(error: { message?: string; code?: string } | null) {
  return Boolean(
    error?.code === "42883" ||
      error?.message?.includes("apply_project_credit_purchase") ||
      error?.message?.includes("Could not find the function"),
  );
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return Response.json({ error: "Stripe webhook secret is not configured." }, { status: 500 });
  }

  const signatureHeader = request.headers.get("stripe-signature");
  const payload = await request.text();

  if (!signatureHeader || !verifyStripeSignature(payload, signatureHeader, webhookSecret)) {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEvent;

  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true });
  }

  const session = event.data.object;
  const organisationId = session.metadata?.organisation_id;
  const creditQuantity = Math.max(0, Number(session.metadata?.credit_quantity || 0));

  if (!organisationId || creditQuantity < 1) {
    return Response.json({ error: "Checkout session metadata is incomplete." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error: rpcError } = await supabase.rpc("apply_project_credit_purchase", {
    target_organisation_id: organisationId,
    stripe_event: event.id,
    stripe_customer: session.customer || null,
    stripe_checkout_session: session.id,
    credit_quantity: creditQuantity,
  });

  if (!rpcError) {
    return Response.json({ received: true });
  }

  if (!isMissingBillingRpc(rpcError)) {
    return Response.json({ error: "Could not apply credit purchase." }, { status: 500 });
  }

  const { error: eventInsertError } = await supabase.from("project_credit_events").insert({
    organisation_id: organisationId,
    stripe_event_id: event.id,
    event_type: "stripe_checkout_completed",
    credit_delta: creditQuantity,
    notes: `Stripe Checkout session ${session.id} completed.`,
  });

  if (eventInsertError?.code === "23505") {
    return Response.json({ received: true, duplicate: true });
  }

  if (eventInsertError) {
    return Response.json({ error: "Could not record credit event." }, { status: 500 });
  }

  const { data: account, error: accountError } = await supabase
    .from("project_credit_accounts")
    .select("credit_balance,stripe_customer_id")
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (accountError) {
    return Response.json({ error: "Could not read credit account." }, { status: 500 });
  }

  const balanceAfter = (account?.credit_balance || 0) + creditQuantity;
  const accountPayload = {
    organisation_id: organisationId,
    stripe_customer_id: account?.stripe_customer_id || session.customer || null,
    credit_balance: balanceAfter,
    updated_at: new Date().toISOString(),
  };
  const { error: upsertError } = await supabase
    .from("project_credit_accounts")
    .upsert(accountPayload);

  if (upsertError) {
    return Response.json({ error: "Could not update credit balance." }, { status: 500 });
  }

  await supabase
    .from("project_credit_events")
    .update({ balance_after: balanceAfter })
    .eq("stripe_event_id", event.id);

  return Response.json({ received: true });
}
