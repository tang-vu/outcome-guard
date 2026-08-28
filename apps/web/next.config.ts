import type { NextConfig } from "next";

const config: NextConfig = { reactStrictMode: true, allowedDevOrigins: ["127.0.0.1"], transpilePackages: ["@outcome-guard/dreamdex", "@outcome-guard/hedge-engine", "@outcome-guard/policy-engine", "@outcome-guard/receipt", "@outcome-guard/schemas", "@outcome-guard/shared"] };
export default config;
