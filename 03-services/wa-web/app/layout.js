import './globals.css';

export const metadata = { title: 'WA Gateway', description: 'Kelola multi-akun WhatsApp & broadcast' };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <nav className="nav">
          <div className="nav-inner">
            <span className="brand">📲 WA Gateway</span>
            <a href="/">Sesi</a>
            <a href="/groups">Grup</a>
            <a href="/broadcast">Broadcast</a>
            <a href="/history">Riwayat</a>
          </div>
        </nav>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
