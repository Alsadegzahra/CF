import type { InputHTMLAttributes } from "react";

type TextFieldProps = {
  id: string;
  label: string;
  /** Extra classes on the outer label wrapper (e.g. margin-bottom). */
  wrapperClassName?: string;
} & InputHTMLAttributes<HTMLInputElement>;

const inputClass =
  "mt-1.5 w-full min-h-[44px] rounded-xl border border-cf-line bg-white px-3 py-2.5 text-sm text-cf-navy shadow-sm placeholder:text-cf-muted/70 focus:border-cf-navy/35 focus:outline-none focus:ring-2 focus:ring-cf-navy/15";

export function TextField({ id, label, wrapperClassName = "", ...rest }: TextFieldProps) {
  return (
    <label htmlFor={id} className={`block text-sm font-semibold text-cf-muted ${wrapperClassName}`.trim()}>
      {label}
      <input id={id} className={inputClass} {...rest} />
    </label>
  );
}
