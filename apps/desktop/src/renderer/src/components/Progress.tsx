export function Progress({
  value,
  tone = "accent",
  label,
}: {
  value: number;
  tone?: "accent" | "warn" | "danger";
  label: string;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const color = tone === "danger" ? "bg-negative" : tone === "warn" ? "bg-warn" : "bg-accent";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1.5 w-full overflow-hidden rounded-full bg-line"
    >
      <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
    </div>
  );
}
