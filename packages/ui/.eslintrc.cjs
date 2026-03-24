"use strict";
module.exports = {
  root: true,
  extends: ["../config/eslint/base.js"],
  parserOptions: { project: null },
  ignorePatterns: ["node_modules", "dist"],
  overrides: [
    { files: ["**/*.config.js"], rules: { "@typescript-eslint/no-require-imports": "off", "@typescript-eslint/no-var-requires": "off" } },
  ],
};
