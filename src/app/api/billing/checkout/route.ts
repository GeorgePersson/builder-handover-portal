import { createSupabaseServerClient } from "@/lib/supabase/server";

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getBaseUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return Response.redirect(`${getBaseUrl(request)}/builder/settings?error=billing-requires-supabase`, 303);
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const projectCreditPriceId = process.env.NEXT_PUBLIC_STRIPE_PROJECT_CREDIT_PRICE_ID;

  if (!stripeSecretKey || !projectCreditPriceId) {
    return Response.redirect(`${getBaseUrl(request)}/builder/settings?error=stripe-not-configured`, 303);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.redirect(`${getBaseUrl(request)}/login?next=${encodeURIComponent("/builder/settings")}`, 303);
  }

  const { data: member, error: memberError } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memberError || !member?.organisation_id) {
    return Response.redirect(`${getBaseUrl(request)}/builder/onboarding?next=/builder/settings`, 303);
  }

  const formData = await request.formData();
  const quantity = Math.max(1, Math.min(Number(formData.get("quantity") || 5), 100));
  const body = new URLSearchParams({
    mode: "payment",
    success_url: `${getBaseUrl(request)}/builder/settings?billing=success`,
    cancel_url: `${getBaseUrl(request)}/builder/settings?billing=cancelled`,
    customer_email: user.email || "",
    client_reference_id: member.organisation_id,
    "line_items[0][price]": projectCreditPriceId,
    "line_items[0][quantity]": String(quantity),
    "metadata[organisation_id]": member.organisation_id,
    "metadata[credit_quantity]": String(quantity),
  });

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!stripeResponse.ok) {
    return Response.redirect(`${getBaseUrl(request)}/builder/settings?error=stripe-checkout-failed`, 303);
  }

  const session = (await stripeResponse.json()) as { url?: string };

  if (!session.url) {
    return Response.redirect(`${getBaseUrl(request)}/builder/settings?error=stripe-checkout-failed`, 303);
  }

  return Response.redirect(session.url, 303);
}
