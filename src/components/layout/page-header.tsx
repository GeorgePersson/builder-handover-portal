import type { LucideIcon } from "lucide-react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon: Icon,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-cyan-700">
          {Icon ? <Icon className="size-4" /> : null}
          {eyebrow}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
