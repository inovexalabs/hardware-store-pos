import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // receipt PDFs (max 4 MB) and product photos are uploaded through
      // server actions; the default limit is 1 MB
      bodySizeLimit: '5mb',
    },
  },
};

export default nextConfig;
