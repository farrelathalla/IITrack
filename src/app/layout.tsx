import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/* Inter, satu keluarga huruf seperti prototipe Figma Make IITRACK. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "IITrack",
    template: "%s — IITrack",
  },
  description:
    "Sistem alur kerja lintas divisi Inkubator IT HMIF ITB. Satu project, satu Project ID.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Variabel font menempel di <html>, bukan <body>, karena Tailwind
    // meresolusi --font-sans pada elemen akar.
    <html lang="id" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
