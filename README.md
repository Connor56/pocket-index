# Pocket Index

Pocket Index is a simple, browser compatible search index that lets users search for content locally and retrieve it separately. There are three problems it was designed to solve:

1. Reducing backend request volume whilst preserving a fantastic user experience.
2. Minimising data sent to the user.
3. Creating a simple API for building search indexes.

It solves these by:

1. Sending just the search index to the client side so when the user searches your site for content, their own, powerful, extremely low latency machine does the calculations.
2. Encoding search indexes in compact binary that can be gzipped and sent with a minimal footprint.
3. Providing a bare minimum API that gives you everything you need to build, search, save, and load an index.

## The problem it was orginally created to solve

I built this for a blogging website that I'm running on the free tier of Cloudflare's infrastructure. The thought process is:

1. I'd like to use vector embedding on my documents for a great search experience.
2. I don't want to pay for the vector computation.
3. I KNOW! I'll let the user do it client side and provide them with an index to search against.

The index will return a list of IDs and I'll use these to order the articles on the client. Instant search, zero cost, lovely.

## Features

- **Vector Search Index.** Use content-based vector embeddings across your documents.
- **Bring your own Embedding.** The package relies on the [Hugging face transformers](https://www.npmjs.com/package/@huggingface/transformers) package for vector embeddings, and you can use whatever model you like. However, bare in mind the user will have to load that same model client side to use your index.
- **BM25 Search Index.** Use the [Okapi BM25 ranking function](https://en.wikipedia.org/wiki/Okapi_BM25) to perform keyword lookup type queries.
- **Bring your own Extractor.** BM25 relies on keyword extraction to build its data structure and compare queries to documents. The exact extraction function used is passed as a parameter, so you can make it whatever you like. Just make sure it's the same on the backend and the client!

## Install

To install the package run:

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
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
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
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
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

Both indexes can be written to a file or turned into a buffer you upload somewhere else (S3, R2, a CDN, etc.).

**CommonJS**

```js
// Persist the built index as a compact binary file on disk.
index.save('./search-index.bin')

// Or serialize to a buffer if you want to upload without writing a local file.
const buffer = index.serialize()

// Upload that buffer to object storage (Cloudflare R2, S3, etc.).
// Clients can later download this object and call load(buffer).
await s3.send(
  new PutObjectCommand({
    Bucket: 'my-bucket',
    Key: 'indexes/search-index.bin',
    Body: buffer, // the compact-encoding binary from serialize()
    ContentType: 'application/octet-stream'
  })
)
```

**TypeScript**

```ts
// Persist the built index as a compact binary file on disk.
index.save('./search-index.bin')

// Or serialize to a buffer if you want to upload without writing a local file.
const buffer = index.serialize()

// Upload that buffer to object storage (Cloudflare R2, S3, etc.).
// Clients can later download this object and call load(buffer).
await s3.send(
  new PutObjectCommand({
    Bucket: 'my-bucket',
    Key: 'indexes/search-index.bin',
    Body: buffer, // the compact-encoding binary from serialize()
    ContentType: 'application/octet-stream'
  })
)
```

On the client (or another process), recreate the index with the same extractor (BM25) or the same `modelId` + extractor (vector), then load from a path or buffer:

**CommonJS**

```js
// Recreate with the SAME extractor used at build time, then restore state.
const loaded = new BM25Index({ extractor: extractKeywords })

// load() accepts a file path...
loaded.load('./search-index.bin')
// ...or the buffer you downloaded from R2/S3:
// loaded.load(buffer)

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
loaded.load(buffer)

// Queries are embedded with the client-side model, then ranked against the index.
const results = await loaded.search('how do peers find each other?', 5)
```

**TypeScript**

```ts
// Recreate with the SAME extractor used at build time, then restore state.
const loaded = new BM25Index({ extractor: extractKeywords })

// load() accepts a file path...
loaded.load('./search-index.bin')
// ...or the buffer you downloaded from R2/S3:
// loaded.load(buffer)

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
loaded.load(buffer)

// Queries are embedded with the client-side model, then ranked against the index.
const results = await loaded.search('how do peers find each other?', 5)
```

A typical flow is: build the index in CI or on a backend → `serialize()` → upload to R2/S3 → clients fetch the `.bin` → `load(buffer)` → search locally and fetch full documents by `id` as needed.

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

#### `const buffer = index.serialize()`

Encode the index to a binary buffer.

#### `index.save(path)`

Serialize the index and write it to `path`.

#### `index.load(pathOrBuffer)`

Restore index state from a file path or a buffer previously produced by `serialize()` / `save()`. The extractor must match the one used when the index was built (checked via a hash of `extractor.toString()`).

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
  extractor, // required embedding function (Hugging Face style)
  modelId, // required string, stored and checked on load
  dimension, // required embedding size
  tokensPerChunk, // chunk size in tokens/words for long documents
  windowStep, // step between chunks
  oneVecPerDoc // if true, sum chunk vectors into one vector per document
}
```

#### `await index.add(documents)`

Embed and add documents. Each document must be `{ id, content }`. Throws if an `id` is duplicated.

#### `const results = await index.search(query[, topK])`

Embed the query and return `[{ id, score }, ...]` ranked by cosine similarity. If `topK` is set, only that many unique document ids are returned.

#### `const buffer = index.serialize()`

Encode the index to a binary buffer.

#### `index.save(path)`

Serialize the index and write it to `path`.

#### `index.load(pathOrBuffer)`

Restore index state from a file path or buffer. `modelId` must match the model used when the index was built.

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
