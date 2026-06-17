type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
};

export function TextField({
  label,
  name,
  type = "text",
  placeholder,
  required,
  defaultValue,
}: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none ring-cyan-700/20 placeholder:text-slate-400 focus:border-cyan-700 focus:ring-4"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  name,
  placeholder,
  required,
  defaultValue,
}: Omit<FieldProps, "type">) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        className="mt-2 min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none ring-cyan-700/20 placeholder:text-slate-400 focus:border-cyan-700 focus:ring-4"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  required,
}: {
  label: string;
  name: string;
  options: Array<{ label: string; value: string }>;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none ring-cyan-700/20 focus:border-cyan-700 focus:ring-4"
        name={name}
        required={required}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({
  label,
  name,
  description,
}: {
  label: string;
  name: string;
  description?: string;
}) {
  return (
    <label className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <input className="mt-1 size-4 accent-cyan-700" name={name} type="checkbox" />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description ? <span className="mt-1 block text-sm leading-6 text-slate-500">{description}</span> : null}
      </span>
    </label>
  );
}
