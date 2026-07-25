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

### VectorIndex

To use the VectorIndex, you should do

## Some thoughts

- At some point, I will probably release a new package with a list of extractors to use, unless someone beats me to it or one already exists.
- In the fullness of time, I will move to a simpler vector embedding method than the massive hugging face library.

## License

MIT

```

```
