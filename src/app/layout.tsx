import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nordmende Spectra Color Studio · 1973",
  description:
    "Interactive 3D recreation of the Nordmende Spectra Color Studio multiview television system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
