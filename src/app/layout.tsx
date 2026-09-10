import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

/*
 * Sans serif geometris humanis, satu keluarga huruf untuk judul dan badan
 * sekaligus (Design Brief bab 3).
 */
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
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
    <html lang="id" className={plusJakarta.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
