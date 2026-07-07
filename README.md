# holepunch-module-template

Template for a Holepunch-style npm module.

Use this as a starting point for small CommonJS npm packages that follow the
mafintosh / Holepunch module style.

## Structure

```
my-package/
|-- index.js
|-- lib/
|   `-- example-lib.js
|-- test/
|   |-- all.js
|   |-- basic.js
|   `-- helpers/
|       `-- index.js
|-- examples/
|   `-- basic.js
|-- package.json
|-- README.md
|-- CONTRIBUTING.md
|-- LICENSE
|-- .prettierrc
|-- .gitignore
|-- .vscode/
|   `-- extensions.json
`-- .gitattributes
```

## Files

| File                      | Purpose                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `index.js`                | Public API. Replace the module-level comment with the package's main exported class or function. |
| `lib/`                    | Internal implementation modules used by `index.js`.                                              |
| `test/basic.js`           | First brittle test file. Replace the guidance comment with real behaviour tests.                 |
| `test/all.js`             | Brittle runner that imports test files. Regenerate with `npm run test:generate`.                 |
| `test/helpers/`           | Shared test helpers such as `create`, `collect`, temporary storage, or replication setup.        |
| `examples/`               | Optional runnable examples. Do not rely on these as tests.                                       |
| `CONTRIBUTING.md`         | Checklist for keeping the package in mafintosh / Holepunch style.                                |
| `.vscode/extensions.json` | Recommends the Lunte VS Code extension for editor diagnostics.                                   |

## Style Rules

See `CONTRIBUTING.md` for the full checklist. The short version is:

- CommonJS, no build step, one main export from `index.js`.
- Internals live in `lib/`; tests live in `test/`.
- Use small dependencies and Node/Bare-compatible packages where possible.
- Use `brittle`, `prettier-config-holepunch`, and `lunte`.
- Only add `bin.js`, GitHub workflows, generated files, or extra public entrypoints when the package actually needs them.

# Example Package

Here is a small example of what a package made from this template might become.
This is intentionally not checked into the template files as real code because
every new module would delete it.

Imagine a package called `tiny-counter`:

```js
// index.js
const isOptions = require('is-options')
const ReadyResource = require('ready-resource')
const safetyCatch = require('safety-catch')

const CounterState = require('./lib/counter-state')

module.exports = class TinyCounter extends ReadyResource {
  constructor(opts = {}) {
    super()

    if (!isOptions(opts)) opts = {}

    this.destroyed = false
    this._state = new CounterState(opts.start || 0)

    this.ready().catch(safetyCatch)
  }

  get value() {
    return this._state.value
  }

  inc() {
    return this._state.inc()
  }

  async _open() {
    // Open files, sockets, cores, stores, or other async resources here.
  }

  async _close() {
    this.destroyed = true
  }
}
```

```js
// lib/counter-state.js
module.exports = class CounterState {
  constructor(value) {
    this.value = value
  }

  inc() {
    return ++this.value
  }
}
```

```js
// test/basic.js
const test = require('brittle')
const TinyCounter = require('..')

test('increments', async function (t) {
  const counter = new TinyCounter({ start: 1 })
  t.teardown(() => counter.close())

  await counter.ready()

  t.is(counter.value, 1)
  t.is(counter.inc(), 2)
})
```

The important shape is: `index.js` owns the public API, `lib/` owns internal
details, and tests use the package the same way users would.

# Dependencies

This template only installs development tools by default:

| Dependency                  | Why it is here                                                           |
| --------------------------- | ------------------------------------------------------------------------ |
| `brittle`                   | Test runner used across many Holepunch packages.                         |
| `lunte`                     | JavaScript linter, roughly covering Standard-style non-formatting rules. |
| `prettier`                  | Code formatter.                                                          |
| `prettier-config-holepunch` | Shared Holepunch Prettier config from npm. `.prettierrc` points at it.   |

Common runtime dependencies are not installed until the package actually uses
them:

| Dependency       | Add it when                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `b4a`            | You work with buffers and want Node/Bare-compatible buffer helpers.                                 |
| `streamx`        | The public API exposes streams.                                                                     |
| `is-options`     | Constructors support flexible argument forms like `new Thing(opts)` and `new Thing(storage, opts)`. |
| `ready-resource` | The module has async lifecycle with `ready()` and `close()`.                                        |
| `safety-catch`   | You start async lifecycle work in the constructor and need to avoid unhandled rejections.           |
| `bare-events`    | You use `require('events')` and want an `imports` mapping for Bare.                                 |
| `bare-process`   | You use `require('process')` and want an `imports` mapping for Bare.                                |

For example, only add this once the code needs EventEmitter compatibility across
Node and Bare:

```json
{
  "imports": {
    "events": {
      "bare": "bare-events",
      "default": "events"
    }
  },
  "dependencies": {
    "bare-events": "^2.2.0"
  }
}
```

# Testing On Node And Bare

`brittle` is the test framework. The runtime is chosen by the command you run:

```json
{
  "test": "npm run test:node && npm run test:bare",
  "test:node": "brittle-node test/all.js",
  "test:bare": "brittle-bare test/all.js"
}
```

`brittle-node` runs the same tests in Node.js. `brittle-bare` runs the same tests
in Bare, the JavaScript runtime used by Pear. Brittle itself does not magically
switch runtimes inside one process; the npm scripts invoke separate runners.

This catches cases where code accidentally relies on Node-only globals or core
modules. If a module must use runtime-specific packages, add an `imports` mapping
so Node gets the Node module and Bare gets the Bare-compatible package.

# Editor Setup

This repo includes `.vscode/extensions.json` recommending the Lunte extension:

```json
{
  "recommendations": ["holepunch.vscode-lunte"]
}
```

VS Code and Cursor can prompt contributors to install recommended extensions
when they open the folder. The extension is the VS Code client for Lunte's
language server; `npm run lint` still remains the source of truth in CI or local
terminal checks.

## Using This Template

1. Copy this directory and rename it to your package name.
2. Update `name`, `description`, `repository`, `bugs`, `homepage`, and `author` in `package.json`.
3. Replace the comment in `index.js` with the package's real public API.
4. Replace `lib/example-lib.js` with real internal modules.
5. Replace the guidance comment in `test/basic.js` with real tests.
6. Run `npm install`, then `npm test`.

## License

MIT
