import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // IITrack menegakkan izin di lapisan server (PRD NFR Keamanan Akses), jadi
  // aplikasi tidak boleh di-export sebagai situs statis seperti default template.
  output: "standalone",
};

export default nextConfig;
