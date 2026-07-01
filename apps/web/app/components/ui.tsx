'use client';

import { type ReactNode } from 'react';

// ── Loading Spinner ──────────────────────────────
export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-zinc-400 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ── Loading Page ─────────────────────────────────
export function LoadingPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

// ── Error Banner ─────────────────────────────────
export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-red-500">⚠</span>
        <div className="flex-1">
          <p className="font-medium">Error</p>
          <p className="mt-1">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────
export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-4xl">{icon}</span>
      <h3 className="mt-4 text-lg font-semibold text-zinc-800">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-zinc-500">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// ── Badge ────────────────────────────────────────
const BADGE_COLORS: Record<string, string> = {
  easy: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  hard: 'bg-red-100 text-red-700 border-red-200',
  dsa: 'bg-blue-100 text-blue-700 border-blue-200',
  backend: 'bg-purple-100 text-purple-700 border-purple-200',
  javascript: 'bg-amber-100 text-amber-700 border-amber-200',
  typescript: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  nodejs: 'bg-lime-100 text-lime-700 border-lime-200',
  database: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  os: 'bg-slate-100 text-slate-700 border-slate-200',
  networking: 'bg-teal-100 text-teal-700 border-teal-200',
  oop: 'bg-violet-100 text-violet-700 border-violet-200',
  system_design: 'bg-rose-100 text-rose-700 border-rose-200',
  behavioral: 'bg-orange-100 text-orange-700 border-orange-200',
};

export function Badge({
  label,
  variant,
}: {
  label: string;
  variant?: string;
}) {
  const colorClass = BADGE_COLORS[variant ?? label] ?? 'bg-zinc-100 text-zinc-700 border-zinc-200';
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

// ── Card ─────────────────────────────────────────
export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-5 shadow-sm ${onClick ? 'cursor-pointer hover:border-zinc-300 hover:shadow-md transition-shadow' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ── Pagination ───────────────────────────────────
export function Pagination({
  page,
  limit,
  total,
  onChange,
}: {
  page: number;
  limit: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 pt-6">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40 hover:bg-zinc-50"
      >
        ← Prev
      </button>
      <span className="text-sm text-zinc-500">
        Page {page} of {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40 hover:bg-zinc-50"
      >
        Next →
      </button>
    </div>
  );
}
