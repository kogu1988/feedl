import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Vendored istemci kütüphanesi (html-to-image) — `npm run vendor:capture`
      // ile üretilen minify tek satırlık bundle. Kendi kodumuz değil; lint
      // etmek CI'ı sürekli düşürüyordu (52 bulgu, 1 error).
      "public/widget-capture.js",
    ],
  },
];

export default eslintConfig;
