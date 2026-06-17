import type { LucideIcon } from "lucide-react";

export function SubmitButton({
  label,
  icon: Icon,
}: {
  label: string;
  icon: LucideIcon;
}) {
  return (
    <button
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-cyan-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800"
      type="submit"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
