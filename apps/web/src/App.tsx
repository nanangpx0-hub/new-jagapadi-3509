import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { AuthProvider } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { AkunPage } from './pages/AkunPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MapPage } from './pages/MapPage';
import { OptsPage } from './pages/OptsPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { ReportEditPage } from './pages/ReportEditPage';
import { ReportNewPage } from './pages/ReportNewPage';
import { ReportsPage } from './pages/ReportsPage';
import { StatusPage } from './pages/StatusPage';
import { UsersPage } from './pages/UsersPage';
import { WilayahPage } from './pages/WilayahPage';
import { Sprout } from 'lucide-react';

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <Sprout size={40} className="text-tinta3" aria-hidden="true" />
      <h1 className="font-display text-2xl font-bold text-tinta">Halaman tidak ditemukan</h1>
      <p className="max-w-sm text-sm text-tinta2">Alamat yang Anda buka tidak tersedia. Periksa kembali tautan Anda.</p>
      <a href="/" className="mt-2 inline-flex min-h-11 items-center rounded-md bg-cta px-5 text-sm font-bold text-ctafg">
        Kembali ke Beranda
      </a>
    </div>
  );
}

export default function App() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/reports/new" element={<ReportNewPage />} />
                <Route path="/reports/:id" element={<ReportDetailPage />} />
                <Route path="/reports/:id/edit" element={<ReportEditPage />} />
                <Route path="/wilayah" element={<WilayahPage />} />
                <Route path="/opts" element={<OptsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/peta" element={<MapPage />} />
                <Route path="/status" element={<StatusPage />} />
                <Route path="/akun" element={<AkunPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
