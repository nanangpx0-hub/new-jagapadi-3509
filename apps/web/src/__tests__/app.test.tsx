import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { StatusBadge } from '../components/StatusBadge';

describe('Aplikasi JAGAPADI', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('menampilkan halaman masuk saat belum terautentikasi', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /^masuk$/i })).toBeDefined();
    expect(screen.getByLabelText(/^email$/i)).toBeDefined();
    expect(screen.getByLabelText(/^kata sandi$/i)).toBeDefined();
  });
});

describe('StatusBadge', () => {
  it('menampilkan label status enum PRD', () => {
    render(<StatusBadge status="Diverifikasi" />);
    expect(screen.getByText('Diverifikasi')).toBeDefined();
  });

  it('menampilkan label Dikirim untuk status Submitted', () => {
    render(<StatusBadge status="Submitted" />);
    expect(screen.getByText('Dikirim')).toBeDefined();
  });
});
