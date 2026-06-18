import { createSupabaseServerClient } from "@/lib/supabase/server";

function hasSupabaseConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function GET(_request: Request, context: RouteContext<"/api/documents/[documentId]/download">) {
  const { documentId } = await context.params;

  if (!hasSupabaseConfig()) {
    return Response.json(
      { error: "Document downloads require Supabase Storage." },
      { status: 501 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("id,storage_path")
    .eq("id", documentId)
    .single();

  if (documentError || !document?.storage_path) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from("handover-documents")
    .createSignedUrl(document.storage_path, 60 * 5);

  if (signedUrlError || !signedUrl?.signedUrl) {
    return Response.json({ error: "Could not create download link." }, { status: 500 });
  }

  return Response.redirect(signedUrl.signedUrl, 302);
}
