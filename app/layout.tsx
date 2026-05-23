import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ICBK — DB Read-Only Proxy",
  description: "Proxy di sola lettura per il database di produzione ICBK",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
