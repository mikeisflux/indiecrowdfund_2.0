import nextConfig from "eslint-config-next";

const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "public/**",
      "scripts/**",
      "prisma/**",
      "*.config.ts",
      "*.config.js",
      "next-env.d.ts",
      "debug-stats.js",
    ],
  },
  ...nextConfig,
  // Disable new React Hooks strict rules from eslint-config-next@16
  // until we adopt React 19 + the React Compiler. These are optimization
  // hints for the compiler, not correctness issues — the flagged patterns
  // all work correctly on React 18.
  {
    rules: {
      "react-compiler/react-compiler": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
    },
  },
];

export default config;
