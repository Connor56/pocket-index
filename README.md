# pocket-index

Tiny browser-friendly search indexes for external documents.

Pocket Index lets users search locally and retrieve full content separately. It is aimed at three goals:

1. Cut backend request volume without giving up a fast search UX.
2. Minimise what you send to the client — ship an index, not every document body.
3. Keep a small API for building, searching, saving, and loading indexes.

It achieves these by sending a compact binary index to the client so ranking runs on the user's machine, encoding that index so it gzips well for CDN or object storage, and exposing only the methods you need to build and query it.

## Why

Built for frontend search with minimal backend cost. Embedding or ranking every query on a server adds latency and spend; prebuilding an index and searching in the browser avoids that. A typical flow is: build the index offline or in CI, host the binary on a CDN / S3 / R2, let the client search locally, then use the returned ids to fetch or order full documents.

## Features

- **Vector search index** — content embeddings across your documents. Bring your own embedding pipeline (e.g. [Hugging Face transformers](https://www.npmjs.com/package/@huggingface/transformers)); clients must load the same model to search.
- **BM25 search index** — [Okapi BM25](https://en.wikipedia.org/wiki/Okapi_BM25) keyword ranking. Bring your own keyword extractor and use the same function on build and client.
- **Compact binary format** — serialize or save indexes for cheap static hosting and small downloads.

## Install

```sh
npm i pocket-index
```

## Usage

Before using either index you need to prepare your documents. Currently, the indexes expect plain text documents. Read them from file or wherever else and organise them into an array like so:

```js
// Each document needs a stable id you can resolve later (slug, CMS id, path, etc.)
// and the plain text content you want searchable.
const documents = [
  { id: 'hypercore', content: 'Hypercore is an append-only log...' },
  { id: 'hyperdht', content: 'HyperDHT is a distributed hash table...' }
]
```

### BM25Index

BM25 is a keyword ranking index. Pass in your own keyword extractor and use the same function when building and when loading/searching.

**CommonJS**

```js
const { BM25Index } = require('pocket-index')

// You control how text becomes keywords. Keep this identical on build and client.
function extractKeywords(text) {
  return text.toLowerCase().split(/\W+/).filter(Boolean)
}

// Create the index with your extractor. Optional k1/b/fuzzyThreshold have defaults.
const index = new BM25Index({ extractor: extractKeywords })

// Index the documents. This builds keyword maps and BM25 stats in memory.
index.add(documents)

// Search returns [{ id, score }, ...] sorted best-first.
// The second argument limits how many hits you get back.
const results = index.search('append only log', 5)
// e.g. [{ id: 'hypercore', score: 2.1 }, ...]
// Use result.id to fetch the full article from your CMS, JSON, or storage.
```

**TypeScript**

```ts
import { BM25Index } from 'pocket-index'

// You control how text becomes keywords. Keep this identical on build and client.
function extractKeywords(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(Boolean)
}

// Create the index with your extractor. Optional k1/b/fuzzyThreshold have defaults.
const index = new BM25Index({ extractor: extractKeywords })

// Index the documents. This builds keyword maps and BM25 stats in memory.
index.add(documents)

// Search returns [{ id, score }, ...] sorted best-first.
// The second argument limits how many hits you get back.
const results = index.search('append only log', 5)
// e.g. [{ id: 'hypercore', score: 2.1 }, ...]
// Use result.id to fetch the full article from your CMS, JSON, or storage.
```

### VectorIndex

To use the VectorIndex, provide an embedding function compatible with Hugging Face Transformers (for example `@huggingface/transformers`). The client must load the same `modelId` to search.

**CommonJS**

```js
const { VectorIndex } = require('pocket-index')
const { pipeline } = require('@huggingface/transformers')

// Pick an embedding model. Clients must load this same modelId to search.
const modelId = 'onnx-community/all-MiniLM-L6-v2-ONNX'

// Build a feature-extraction pipeline. This is what turns text into vectors.
const extractor = await pipeline('feature-extraction', modelId, { dtype: 'fp32' })

const index = new VectorIndex({
  extractor, // embedding function used for add() and search()
  modelId, // stored in the binary so load() can reject mismatches
  dimension: 384, // must match the model output size
  tokensPerChunk: 256, // long docs are split into chunks of this size
  windowStep: 256, // how far the chunk window advances
  oneVecPerDoc: true // true = one summed vector per doc; false = keep chunk vectors
})

// Embed each document and store the vectors in the index.
await index.add(documents)

// Embed the query and rank documents by cosine similarity.
const results = await index.search('how do peers find each other?', 5)
// e.g. [{ id: 'hyperdht', score: 0.72 }, ...]
```

**TypeScript**

```ts
import { VectorIndex } from 'pocket-index'
import { pipeline } from '@huggingface/transformers'

// Pick an embedding model. Clients must load this same modelId to search.
const modelId = 'onnx-community/all-MiniLM-L6-v2-ONNX'

// Build a feature-extraction pipeline. This is what turns text into vectors.
const extractor = await pipeline('feature-extraction', modelId, { dtype: 'fp32' })

const index = new VectorIndex({
  extractor, // embedding function used for add() and search()
  modelId, // stored in the binary so load() can reject mismatches
  dimension: 384, // must match the model output size
  tokensPerChunk: 256, // long docs are split into chunks of this size
  windowStep: 256, // how far the chunk window advances
  oneVecPerDoc: true // true = one summed vector per doc; false = keep chunk vectors
})

// Embed each document and store the vectors in the index.
await index.add(documents)

// Embed the query and rank documents by cosine similarity.
const results = await index.search('how do peers find each other?', 5)
// e.g. [{ id: 'hyperdht', score: 0.72 }, ...]
```

### Serialize, save, and ship the index

Both indexes can be written to a file or serialized into a `Uint8Array` you upload somewhere else (S3, R2, a CDN, etc.). Throughout this API and documentation, serialized binary values are named `bytes`.

**CommonJS**

```js
// Persist the built index as a compact binary file on disk.
await index.save('./search-index.bin')

// Or serialize to bytes if you want to upload without writing a local file.
const bytes = await index.serialize()

// Upload those bytes to object storage (Cloudflare R2, S3, etc.).
// Clients can later download this object and call load(bytes).
await s3.send(
  new PutObjectCommand({
    Bucket: 'my-bucket',
    Key: 'indexes/search-index.bin',
    Body: bytes, // the Uint8Array returned by serialize()
    ContentType: 'application/octet-stream'
  })
)
```

**TypeScript**

```ts
// Persist the built index as a compact binary file on disk.
await index.save('./search-index.bin')

// Or serialize to bytes if you want to upload without writing a local file.
const bytes: Uint8Array = await index.serialize()

// Upload those bytes to object storage (Cloudflare R2, S3, etc.).
// Clients can later download this object and call load(bytes).
await s3.send(
  new PutObjectCommand({
    Bucket: 'my-bucket',
    Key: 'indexes/search-index.bin',
    Body: bytes, // the Uint8Array returned by serialize()
    ContentType: 'application/octet-stream'
  })
)
```

On the client (or another process), recreate the index with the same extractor (BM25) or the same `modelId` + extractor (vector), then load from a path or `Uint8Array`:

**CommonJS**

```js
// Recreate with the SAME extractor used at build time, then restore state.
const loaded = new BM25Index({ extractor: extractKeywords })

// load() accepts a file path...
await loaded.load('./search-index.bin')
// ...or the bytes you downloaded from R2/S3:
// await loaded.load(bytes)

// Search works the same as on the freshly built index.
const results = loaded.search('append only log', 5)
```

```js
// Recreate with the SAME modelId + extractor used at build time.
const loaded = new VectorIndex({
  extractor,
  modelId,
  dimension: 384,
  tokensPerChunk: 256,
  windowStep: 256,
  oneVecPerDoc: true
})

// Restore vectors/ids from the downloaded binary.
loaded.load(bytes)

// Queries are embedded with the client-side model, then ranked against the index.
const results = await loaded.search('how do peers find each other?', 5)
```

**TypeScript**

```ts
// Recreate with the SAME extractor used at build time, then restore state.
const loaded = new BM25Index({ extractor: extractKeywords })

// load() accepts a file path...
await loaded.load('./search-index.bin')
// ...or the bytes you downloaded from R2/S3:
// await loaded.load(bytes)

// Search works the same as on the freshly built index.
const results = loaded.search('append only log', 5)
```

```ts
// Recreate with the SAME modelId + extractor used at build time.
const loaded = new VectorIndex({
  extractor,
  modelId,
  dimension: 384,
  tokensPerChunk: 256,
  windowStep: 256,
  oneVecPerDoc: true
})

// Restore vectors/ids from the downloaded binary.
loaded.load(bytes)

// Queries are embedded with the client-side model, then ranked against the index.
const results = await loaded.search('how do peers find each other?', 5)
```

A typical flow is: build the index in CI or on a backend → `serialize()` → upload the bytes to R2/S3 → clients fetch the `.bin` as a `Uint8Array` → `load(bytes)` → search locally and fetch full documents by `id` as needed.

## API

#### `const { BM25Index, VectorIndex } = require('pocket-index')`

#### `import { BM25Index, VectorIndex } from 'pocket-index'`

### BM25Index

#### `const index = new BM25Index(options)`

Create a BM25 keyword index.

`options` include:

```js
{
  extractor, // required function (text) => string[]
  k1: 1.5, // term frequency saturation
  b: 0.75, // document length normalisation
  fuzzyThreshold: 0.85 // levenshtein similarity threshold for fuzzy keyword match
}
```

#### `index.add(documents)`

Add documents. Each document must be `{ id, content }`. Throws if an `id` is duplicated.

#### `const results = index.search(query[, topK])`

Search the index. Returns `[{ id, score }, ...]` sorted by score descending. If `topK` is set, only that many results are returned.

#### `const bytes = await index.serialize()`

Encode the index and return its serialized bytes as a `Promise<Uint8Array>`.

#### `await index.save(path)`

Serialize the index and write it to `path`.

#### `await index.load(pathOrBytes)`

Restore index state from a file path or a `Uint8Array` produced by `serialize()`. The extractor must match the one used when the index was built (checked via a hash of `extractor.toString()`).

#### `index.remove(id)`

Remove a document by id and recompute BM25 stats.

#### `const ids = index.list()`

Return the document ids currently in the index.

#### `const bool = index.contains(id)`

Return whether `id` is in the index.

### VectorIndex

#### `const index = new VectorIndex(options)`

Create a vector index.

`options` include:

```js
{
  ;(extractor, // required embedding function (Hugging Face style)
    modelId, // required string, stored and checked on load
    dimension, // required embedding size
    tokensPerChunk, // chunk size in tokens/words for long documents
    windowStep, // step between chunks
    oneVecPerDoc) // if true, sum chunk vectors into one vector per document
}
```

#### `await index.add(documents)`

Embed and add documents. Each document must be `{ id, content }`. Throws if an `id` is duplicated.

#### `const results = await index.search(query[, topK])`

Embed the query and return `[{ id, score }, ...]` ranked by cosine similarity. If `topK` is set, only that many unique document ids are returned.

#### `const bytes = index.serialize()`

Encode the index and return its serialized bytes as a `Uint8Array`.

#### `index.save(path)`

Serialize the index and write it to `path`.

#### `index.load(pathOrBytes)`

Restore index state from a file path or serialized `Uint8Array`. `modelId` must match the model used when the index was built.

#### `index.remove(id)`

Remove a document (and all of its chunk vectors) by id.

#### `const ids = index.list()`

Return the document ids currently in the index.

#### `const bool = index.contains(id)`

Return whether `id` is in the index.

## Some thoughts

- At some point, I will probably release a new package with a list of extractors to use, unless someone beats me to it or one already exists.
- In the fullness of time, I will move to a simpler vector embedding method than the massive hugging face library.

## License

MIT
