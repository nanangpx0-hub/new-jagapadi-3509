import { ArrowLeft, Loader2 } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ReportForm } from '../components/ReportForm';
import { getReport } from '../lib/api';
import { useAuth } from '../lib/auth';

export function ReportEditPage() {
  const { id } = useParams<{ id: string }>();
  const reportId = Number(id);
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => getReport(reportId),
    enabled: Number.isFinite(reportId),
  });
  const report = query.data;

  if (query.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={28} className="animate-spin text-tinta3" aria-hidden="true" />
      </div>
    );
  }

  if (query.isError || !report) {
    return <Navigate to="/reports" replace />;
  }

  // Hanya Draf/Ditolak milik sendiri atau admin yang boleh mengedit (ditegakkan server; ini guard UI)
  const isEditable = report.status === 'Draf' || report.status === 'Ditolak';
  const isOwner = user?.id === report.user?.id;
  if (!isEditable || (!isOwner && !user?.roles.includes('admin'))) {
    return <Navigate to={`/reports/${report.id}`} replace />;
  }

  return (
    <div className="space-y-4">
      <Link
        to={`/reports/${report.id}`}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-tinta2 hover:text-tinta"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Kembali ke detail
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">Perbaiki Laporan</h1>
        <p className="mt-0.5 text-xs text-tinta2">
          Status {report.status} — perubahan hanya untuk draf/laporan ditolak dan dikunci setelah dikirim.
        </p>
      </div>
      <ReportForm mode="edit" report={report} />
    </div>
  );
}
