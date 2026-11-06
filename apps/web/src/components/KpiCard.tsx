import type { LucideIcon } from 'lucide-react';

type Tone = 'green' | 'amber' | 'blue';

const TONE: Record<Tone, string> = {
  green: 'bg-kpi-green-bg text-kpi-green-fg',
  amber: 'bg-kpi-amber-bg text-kpi-amber-fg',
  blue: 'bg-kpi-blue-bg text-kpi-blue-fg',
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: Tone;
  hint?: string;
}) {
  return (
    <div className={`rounded-md p-4 ${TONE[tone]} shadow-card`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold opacity-90">{label}</span>
        <Icon size={18} strokeWidth={2} className="opacity-80" aria-hidden="true" />
      </div>
      <p className="mt-1.5 font-display text-3xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] font-medium opacity-80">{hint}</p>}
    </div>
  );
}
