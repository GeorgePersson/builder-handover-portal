"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requestMagicLinkAction(formData: FormData) {
  const email = formData.get("email");
  const next = formData.get("next");

  if (typeof email !== "string" || email.trim().length === 0) {
    throw new Error("email is required");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/login?mode=stub");
  }

  const supabase = await createSupabaseServerClient();
  const redirectTo = typeof next === "string" && next.startsWith("/") ? next : "/builder/projects";

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    redirect("/login?error=magic-link-failed");
  }

  redirect("/login?sent=true");
}
