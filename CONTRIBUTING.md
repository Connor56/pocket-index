# Contributing

Use this as the checklist for keeping the package in mafintosh / Holepunch style.

| Rule              | What to do                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module system     | Use CommonJS. Keep `"main": "index.js"`. Do not add `"type": "module"` unless the package genuinely needs dual entrypoints.                                      |
| Public API        | Export one main class or function from `index.js`. Keep the user-facing surface small.                                                                           |
| File layout       | Put the public API in `index.js`, internals in `lib/`, tests in `test/`, and optional demos in `examples/`.                                                      |
| Published files   | Keep the `files` field explicit. Publish `index.js`, `lib/**.js`, and any deliberate public entrypoints only.                                                    |
| Constructor style | Use `is-options` when a constructor supports flexible arguments like `new Thing(opts)` and `new Thing(storage, opts)`.                                           |
| Lifecycle         | Use `ready-resource` for async `ready()` / `close()` lifecycle, or clear `destroyed` / `closed` flags for smaller modules.                                       |
| Internals         | Prefix internal state and methods with `_`. Keep helper functions private or place them in `lib/`.                                                               |
| Dependencies      | Prefer small focused dependencies such as `b4a`, `streamx`, `compact-encoding`, `ready-resource`, and `safety-catch`, but only add them when the code uses them. |
| Buffers           | Use `b4a` instead of directly relying on Node `Buffer` APIs.                                                                                                     |
| Streams           | Use `streamx` for stream APIs.                                                                                                                                   |
| Runtime support   | Use `imports` mappings for Node/Bare differences, for example `events`, `fs`, `path`, or `process`.                                                              |
| Errors            | Use package-specific errors or shared ecosystem errors when needed. Keep `.code` stable for user-visible failures.                                               |
| Tests             | Use `brittle`. Split tests by behaviour, with shared setup in `test/helpers/`.                                                                                   |
| Test runner       | Keep `test/all.js` as the generated runner when the suite has multiple files. Regenerate it with `npm run test:generate`.                                        |
| Formatting        | Use Prettier with `prettier-config-holepunch` and run `npm run lint`.                                                                                            |
| Editor support    | Keep `.vscode/extensions.json` recommending `holepunch.vscode-lunte` so editors can prompt contributors to install Lunte diagnostics.                            |
| Lockfiles         | Do not commit `package-lock.json`.                                                                                                                               |
| README            | Keep it short: install, usage, API, license. Move contributor guidance into this file.                                                                           |
| Build steps       | Avoid build steps, transpilers, and generated output unless the module truly requires them.                                                                      |
| CLI               | Only add `bin.js` and a `bin` field when the package intentionally ships a command-line program.                                                                 |
