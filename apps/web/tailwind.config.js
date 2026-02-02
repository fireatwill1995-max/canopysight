/** @type {import('tailwindcss').Config} */
const baseConfig = require("@canopy-sight/ui/tailwind.config");

module.exports = {
  ...baseConfig,
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
};
