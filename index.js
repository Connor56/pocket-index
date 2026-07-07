/*
  The root index.js is the public API of a Holepunch-style module.

  Keep this file focused on the main exported class or function. Put internal
  protocol details, encodings, helpers, and platform-specific code in lib/.

  Common patterns to add here:
  - const isOptions = require('is-options') for flexible constructor arguments.
  - const ReadyResource = require('ready-resource') for ready()/close() lifecycle.
  - const safetyCatch = require('safety-catch') when starting async open work.
  - module.exports = YourMainClass at the bottom of the file.

  Avoid adding a build step, TypeScript output, generated files, or multiple
  competing public APIs unless the package genuinely needs them.
*/
