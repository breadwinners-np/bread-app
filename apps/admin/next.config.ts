import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @bread/shared ships raw TypeScript with no build step (decision 0003),
  // so Next has to compile it rather than treat it as a built dependency.
  transpilePackages: ["@bread/shared"],

  // This app lives in a workspace. Without this, Next infers the project root
  // from the nearest lockfile and warns about the one at the monorepo root.
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },

  // "Inventory" and "Costs" were two screens for one question — what did I
  // spend? — and are now one screen at /spending. These keep any bookmark or
  // typed-in address working. Not permanent: the old paths never reached a
  // real user, so they can be dropped once nobody is used to them.
  async redirects() {
    return [
      { source: "/inventory", destination: "/spending", permanent: false },
      { source: "/inventory/new", destination: "/spending/new", permanent: false },
      { source: "/costs", destination: "/spending", permanent: false },
    ];
  },
};

export default nextConfig;
