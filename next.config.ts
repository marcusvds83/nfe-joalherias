import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Pacotes Node.js puros que NAO devem ser bundled pelo webpack
  // (devem ser incluidos no standalone como node_modules externos)
  serverExternalPackages: [
    'firebase-admin',
    'xml-crypto',
    'node-forge',
    'xmlrpc',
    'pdfkit',
    'bwip-js',
    'adm-zip',
  ],
};

export default nextConfig;
