"use strict";
module.exports = {
  root: true,
  extends: ["../../packages/config/eslint/base.js"],
  parserOptions: { project: null },
  ignorePatterns: ["node_modules", "dist"],
};
