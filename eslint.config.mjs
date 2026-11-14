import js from "@eslint/js";
import babelParser from "@babel/eslint-parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".deploy/**",
      ".deploy-test/**",
      "out/**",
      "build/**",
      "dist/**",
      "node_modules/**",
      ".wrangler/**",
      "scratch/**",
      "next-env.d.ts",
      "scripts/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-react", "@babel/preset-typescript"],
        },
      },
    },
    rules: {
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^(Metadata|Viewport|D1Database|Room|TrackReference|SVGProps)$",
          argsIgnorePattern: "^_",
        },
      ],
      "no-undef": "off",
    },
  },
];
