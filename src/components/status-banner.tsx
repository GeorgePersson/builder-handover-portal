type StatusBannerProps = {
  draft?: string;
  storage?: string;
  error?: string;
  errorMessages?: Record<string, string>;
};

export function StatusBanner({ draft, storage, error, errorMessages }: StatusBannerProps) {
  if (error) {
    const message = errorMessages?.[error] || `Action failed: ${error.replaceAll("-", " ")}.`;

    return (
      <p className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800">
        {message}
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
