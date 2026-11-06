import { Archive, BadgeCheck, CircleX, FileClock, Send, type LucideIcon } from 'lucide-react';
import { REPORT_STATUS_LABEL, type ReportStatus } from '../lib/types';

const STYLES: Record<ReportStatus, { chip: string; Icon: LucideIcon }> = {
  Draf: { chip: 'bg-chip-draf-bg text-chip-draf-fg', Icon: FileClock },
  Submitted: { chip: 'bg-chip-dikirim-bg text-chip-dikirim-fg', Icon: Send },
  Diverifikasi: { chip: 'bg-chip-verifikasi-bg text-chip-verifikasi-fg', Icon: BadgeCheck },
  Ditolak: { chip: 'bg-chip-ditolak-bg text-chip-ditolak-fg', Icon: CircleX },
  Diarsipkan: { chip: 'bg-chip-arsip-bg text-chip-arsip-fg', Icon: Archive },
};

export function StatusBadge({
  status,
  size = 'md',
  className = '',
}: {
  status: ReportStatus;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const { chip, Icon } = STYLES[status];
  const sizing = size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${chip} ${sizing} ${className}`}
    >
      <Icon size={size === 'sm' ? 12 : 14} strokeWidth={2.25} aria-hidden="true" />
      {REPORT_STATUS_LABEL[status]}
    </span>
  );
}
