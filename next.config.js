/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  async redirects() {
    return [
      {
        source: "/release-notes",
        destination:
          "https://heavenly-handstand-a1b.notion.site/Release-Notes-1967a08dca3d8090bad4ec73361f2697",
        permanent: false,
      },
    ];
  },
};

export default config;
