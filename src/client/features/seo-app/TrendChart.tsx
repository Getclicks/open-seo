import { useState } from "react";

function niceMax(value: number) {
  if (value <= 0) return 10;
  const power = 10 ** Math.floor(Math.log10(value));
  const scaled = value / power;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * power;
}

const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/**
 * Daily clicks against the previous period, aligned by day index, with a
 * hover readout.
 */
export function TrendChart({
  current,
  previous,
  label,
}: {
  current: Array<{ date: string; value: number }>;
  previous: Array<{ date: string; value: number }>;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const days = current.length;
  if (days === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No data for this period yet.
      </p>
    );
  }
  const max = niceMax(
    Math.max(...current.map((d) => d.value), ...previous.map((d) => d.value)),
  );
  const x = (index: number) =>
    40 + (days === 1 ? 0 : (index / (days - 1)) * 710);
  const y = (value: number) => 200 - (value / max) * 180;
  const path = (points: Array<{ value: number }>) =>
    points
      .slice(0, days)
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`,
      )
      .join(" ");
  const active = hover ?? days - 1;
  const ticks = [0, Math.floor((days - 1) / 2), days - 1].filter(
    (value, index, list) => list.indexOf(value) === index,
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <svg
          viewBox="0 0 760 220"
          preserveAspectRatio="none"
          role="img"
          aria-label={label}
          className="h-[220px] w-full"
        >
          {[20, 80, 140].map((lineY) => (
            <line
              key={lineY}
              x1="40"
              y1={lineY}
              x2="750"
              y2={lineY}
              stroke="var(--border)"
              strokeDasharray="3 4"
            />
          ))}
          <line x1="40" y1="200" x2="750" y2="200" stroke="var(--input)" />
          {[max, (max * 2) / 3, max / 3].map((value, index) => (
            <text
              key={value}
              x="32"
              y={24 + index * 60}
              textAnchor="end"
              fontSize="11"
              fill="var(--muted-foreground)"
            >
              {Math.round(value).toLocaleString("en-US")}
            </text>
          ))}
          <text
            x="32"
            y="204"
            textAnchor="end"
            fontSize="11"
            fill="var(--muted-foreground)"
          >
            0
          </text>
          <line
            x1={x(active)}
            y1="20"
            x2={x(active)}
            y2="200"
            stroke="var(--input)"
            strokeDasharray="2 3"
          />
          <path
            d={path(previous)}
            fill="none"
            stroke="var(--chart-2)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d={path(current)}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
        </svg>
        <div
          className="absolute inset-y-0 right-[1.3%] left-[5.3%] flex"
          onMouseLeave={() => setHover(null)}
        >
          {current.map((point, index) => (
            <span
              key={point.date}
              className="flex-1"
              onMouseEnter={() => setHover(index)}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
        <span className="font-medium">{shortDate(current[active].date)}</span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-chart-1" aria-hidden />
          <span className="text-muted-foreground">This period</span>
          <strong className="tabular-nums">
            {current[active].value.toLocaleString("en-US")}
          </strong>
        </span>
        {previous[active] ? (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-chart-2" aria-hidden />
            <span className="text-muted-foreground">Previous</span>
            <strong className="tabular-nums">
              {previous[active].value.toLocaleString("en-US")}
            </strong>
          </span>
        ) : null}
        <span className="ml-auto flex gap-6 text-xs text-muted-foreground">
          {ticks.map((tick) => (
            <span key={tick}>{shortDate(current[tick].date)}</span>
          ))}
        </span>
      </div>
    </div>
  );
}
