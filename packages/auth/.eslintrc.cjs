"use strict";
module.exports = {
  root: true,
  extends: ["../config/eslint/base.js"],
  parserOptions: { project: null },
  ignorePatterns: ["node_modules", "dist"],
};
