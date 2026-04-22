import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Digsan — Platform Keluarga Indonesia',
  description: 'Platform sosial media keluarga Indonesia. Bangun silsilah, jaga koneksi, raih prestasi.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
