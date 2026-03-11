/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/pdf/index": [
      "./scripts/extract-pdf.mjs",
      "./node_modules/pdfjs-dist/**/*",
    ],
    "/api/pdf/reprocess": [
      "./scripts/extract-pdf.mjs",
      "./node_modules/pdfjs-dist/**/*",
    ],
  },
};

export default nextConfig;