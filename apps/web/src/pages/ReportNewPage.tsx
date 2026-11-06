import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ReportForm } from '../components/ReportForm';

export function ReportNewPage() {
  return (
    <div className="space-y-4">
      <Link
        to="/reports"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-tinta2 hover:text-tinta"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Kembali ke daftar laporan
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-tinta">Laporan Baru</h1>
        <p className="mt-0.5 text-xs text-tinta2">Isi dari lapangan. Foto dan titik GPS wajib saat mengirim.</p>
      </div>
      <ReportForm mode="create" />
    </div>
  );
}
