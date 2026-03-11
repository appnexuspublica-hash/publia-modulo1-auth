/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "nexuspublica.com.br", pathname: "/**" },
      { protocol: "https", hostname: "www.nexuspublica.com.br", pathname: "/**" },
    ],
  },

  outputFileTracingIncludes: {
    "/api/pdf/*": [
      "./scripts/extract-pdf.mjs",
      "./node_modules/pdfjs-dist/**/*",
    ],
  },
};

export default nextConfig;