import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // receipt PDFs (max 4 MB) and product photos are uploaded through
      // server actions; the default limit is 1 MB
      bodySizeLimit: '5mb',
    },
    // keep pages the user just visited in the browser for 30 s, so going
    // back is instant; saving anything refreshes them straight away
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
