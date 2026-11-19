import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * Building blocks of the SEO App screens: the page frame and title, white
 * panels, segmented tabs, status pills, score rings and the trend chart.
 */

export function PageFrame({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main
      className={cn(
        "flex w-full flex-col gap-5 px-4 pt-6 pb-24 md:px-8 md:pt-7 md:pb-12",
        wide ? "max-w-[1280px]" : "max-w-[1120px]",
      )}
    >
      {children}
    </main>
  );
}

export function PageTitle({
  title,
  domain,
  subtitle,
  actions,
}: {
  title: string;
  domain?: string | null;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
          {title}
          {domain ? <span className="text-muted-foreground"> : </span> : null}
          {domain ? <span>{domain}</span> : null}
        </h1>
        {subtitle ? (
          <div className="text-[15px] text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      ) : null}
    </header>
  );
}

export function Panel({
  title,
  aside,
  children,
  footer,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section
      aria-labelledby={title && id ? id : undefined}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      {title ? (
        <div className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-3">
          <h2 id={id} className="flex-1 text-[15px] font-semibold">
            {title}
          </h2>
          {aside}
        </div>
      ) : null}
      <div className={cn(title ? "px-5 pb-5" : "p-5", bodyClassName)}>
        {children}
      </div>
      {footer ? (
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border bg-muted px-5 py-3 text-[13px] text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<{ value: T; label: ReactNode; count?: number; alert?: boolean }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex max-w-full gap-0.5 self-start overflow-x-auto rounded-[10px] border border-border bg-secondary p-[3px]"
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            className={cn(
              "flex min-h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm whitespace-nowrap",
              selected
                ? "border-border bg-card font-semibold text-foreground shadow-xs"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-[7px] py-px text-[11px] font-medium",
                  tab.alert && tab.count > 0
                    ? "bg-[#FDECEA] text-[#B42318] dark:bg-destructive/20 dark:text-destructive"
                    : "bg-background text-muted-foreground",
                )}
              >
                {tab.count.toLocaleString("en-US")}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

type Tone = "up" | "down" | "warn" | "neutral" | "info";

const TONES: Record<Tone, string> = {
  up: "bg-[#E3F6EA] text-[#17663A] dark:bg-success/20 dark:text-success",
  down: "bg-[#FDECEA] text-[#B42318] dark:bg-destructive/20 dark:text-destructive",
  warn: "bg-[#FDF3E1] text-[#8A5300] dark:bg-warning/20 dark:text-warning",
  neutral: "bg-secondary text-muted-foreground",
  info: "bg-primary/15 text-[#0A5C66] dark:text-primary",
};

export function Pill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** "↑ 12%" / "↓ 4%" for a fractional change; a dash without a baseline. */
export function ChangePill({
  change,
  invert = false,
}: {
  change: number | null;
  /** For metrics where lower is better (position). */
  invert?: boolean;
}) {
  if (change === null || !Number.isFinite(change)) {
    return <span className="text-muted-foreground">–</span>;
  }
  const good = invert ? change <= 0 : change >= 0;
  return (
    <Pill tone={good ? "up" : "down"}>
      {change >= 0 ? "↑" : "↓"} {Math.abs(Math.round(change * 100))}%
    </Pill>
  );
}

function scoreColor(score: number) {
  if (score >= 60) return "var(--primary)";
  if (score >= 40) return "var(--warning)";
  return "var(--destructive)";
}

export function ScoreBar({ score }: { score: number }) {
  return (
    <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-background">
      <span
        className="block h-full rounded-full"
        style={{
          width: `${Math.max(score, 2)}%`,
          background: scoreColor(score),
        }}
      />
    </span>
  );
}

export function ScoreRing({
  score,
  size = 92,
  label,
}: {
  score: number;
  size?: number;
  label: string;
}) {
  const circumference = 2 * Math.PI * 54;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      role="img"
      aria-label={label}
    >
      <circle
        cx="64"
        cy="64"
        r="54"
        stroke="var(--background)"
        strokeWidth="11"
        fill="none"
      />
      <circle
        cx="64"
        cy="64"
        r="54"
        stroke={scoreColor(score)}
        strokeWidth="11"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
        transform="rotate(-90 64 64)"
      />
    </svg>
  );
}

export function Sparkline({
  values,
  label,
  max = 100,
}: {
  values: number[];
  label: string;
  max?: number;
}) {
  if (values.length < 2) return null;
  const step = 232 / (values.length - 1);
  const path = values
    .map((value, index) => {
      const x = 4 + index * step;
      const y = 44 - (value / max) * 40;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox="0 0 240 48"
      className="h-12 w-full"
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <line x1="0" y1="44" x2="240" y2="44" stroke="var(--border)" />
      <path
        d={path}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function formatNumber(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

export function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatPosition(value: number) {
  return value > 0 ? value.toFixed(1) : "–";
}

export function relativeChange(current: number, previous: number) {
  return previous > 0 ? (current - previous) / previous : null;
}

export function pathOf(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}
