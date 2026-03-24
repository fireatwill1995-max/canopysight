"use strict";
const base = require("./eslint/base.js");
module.exports = {
  ...base,
  ignorePatterns: [...(base.ignorePatterns || []), "eslint"],
  overrides: [
    { files: ["**/*.js"], rules: { "@typescript-eslint/no-var-requires": "off" } },
  ],
};
