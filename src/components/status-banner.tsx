type StatusBannerProps = {
  draft?: string;
  storage?: string;
  error?: string;
};

export function StatusBanner({ draft, storage, error }: StatusBannerProps) {
  if (error) {
    return (
      <p className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800">
        Action failed: {error.replaceAll("-", " ")}.
      </p>
    );
  }

  if (draft === "saved") {
    return (
      <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">
        Draft saved through the {storage === "supabase" ? "Supabase" : "local scaffold"} path.
      </p>
    );
  }

  return null;
}
