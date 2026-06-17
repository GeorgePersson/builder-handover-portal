"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeNext(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/builder/projects";
  }

  return value;
}

async function getRequestOrigin() {
  const headersList = await headers();
  const origin = headersList.get("origin");

  if (origin?.startsWith("http://") || origin?.startsWith("https://")) {
    return origin;
  }

  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  if (!host) {
    return "http://127.0.0.1:3000";
  }

  const protocol =
    headersList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");

  return `${protocol}://${host}`;
}

function getLoginErrorCode(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("redirect")) {
    return "redirect-url";
  }

  if (lowerMessage.includes("rate") || lowerMessage.includes("too many")) {
    return "rate-limit";
  }

  if (lowerMessage.includes("email")) {
    return "email-provider";
  }

  return "magic-link-failed";
}

export async function requestMagicLinkAction(formData: FormData) {
  const email = formData.get("email");
  const next = formData.get("next");
  const redirectTo = getSafeNext(next);

  if (typeof email !== "string" || email.trim().length === 0) {
    throw new Error("email is required");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/login?mode=stub");
  }

  const supabase = await createSupabaseServerClient();
  const callbackUrl = new URL("/auth/callback", await getRequestOrigin());
  callbackUrl.searchParams.set("next", redirectTo);

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: callbackUrl.toString(),
    },
  });

  if (error) {
    console.error("Supabase magic link request failed", {
      code: error.code,
      message: error.message,
      status: error.status,
    });

    const params = new URLSearchParams({
      error: getLoginErrorCode(error.message),
      next: redirectTo,
    });

    redirect(`/login?${params.toString()}`);
  }

  const params = new URLSearchParams({
    sent: "true",
    next: redirectTo,
  });

  redirect(`/login?${params.toString()}`);
}
