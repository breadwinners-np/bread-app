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
};

export default nextConfig;
