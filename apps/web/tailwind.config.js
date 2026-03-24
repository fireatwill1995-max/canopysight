/** @type {import('tailwindcss').Config} */
const path = require("path");
const baseConfig = require(path.resolve(__dirname, "../../packages/ui/tailwind.config.js"));

module.exports = {
  ...baseConfig,
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
};
