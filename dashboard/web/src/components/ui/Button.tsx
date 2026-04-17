import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-cf-navy text-white shadow-sm hover:opacity-[0.97] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cf-navy/40",
  secondary:
    "border border-cf-line bg-white text-cf-navy hover:bg-slate-50 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cf-navy/25",
  ghost: "text-cf-muted hover:bg-slate-100 hover:text-cf-navy focus-visible:ring-2 focus-visible:ring-cf-navy/20",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-pill px-4 py-2.5 text-sm font-semibold transition select-none disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
