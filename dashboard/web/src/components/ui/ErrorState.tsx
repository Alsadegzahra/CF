import type { ReactNode } from "react";
import { Button } from "./Button";

type ErrorStateProps = {
  title: string;
  message: string;
  primaryAction: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  children?: ReactNode;
};

export function ErrorState({ title, message, primaryAction, secondaryAction, children }: ErrorStateProps) {
  return (
    <div className="mx-auto max-w-lg rounded-card border border-red-200/90 bg-white p-6 shadow-card-sm sm:max-w-xl">
      <div className="flex gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700"
          aria-hidden
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-cf-navy">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-cf-muted">{message}</p>
          {children}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" variant="primary" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
            {secondaryAction ? (
              <Button type="button" variant="secondary" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
