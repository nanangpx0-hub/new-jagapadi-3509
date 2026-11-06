import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-garis bg-panel2 px-6 py-12 text-center">
      <div className="rounded-full bg-chip-draf-bg p-4 text-tinta2">
        <Icon size={28} strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h3 className="font-display text-base font-bold text-tinta">{title}</h3>
      <p className="max-w-md text-sm text-tinta2">{description}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
