import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Jaring pengaman terakhir: bila satu komponen melempar error saat render,
 * tampilkan pesan yang bisa ditindaklanjuti alih-alih layar putih kosong.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Kesalahan UI JAGAPADI:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-panel p-6">
        <div className="w-full max-w-lg rounded-xl border border-garis bg-panel2 p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto text-amber-600" size={38} aria-hidden="true" />
          <h1 className="mt-3 font-display text-xl font-bold text-tinta">Halaman gagal dimuat</h1>
          <p className="mt-2 text-sm text-tinta2">
            Terjadi kesalahan pada tampilan. Muat ulang halaman untuk mencoba lagi.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-md bg-panel p-3 text-left text-[11px] text-tinta3">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md bg-cta px-5 text-sm font-bold text-ctafg"
          >
            <RotateCcw size={16} aria-hidden="true" />
            Muat ulang
          </button>
        </div>
      </main>
    );
  }
}
