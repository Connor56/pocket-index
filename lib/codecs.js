/**
 * Codecs for the various index types for storing the data in the most compact
 * form possible. Uses `compact-encoding` to define the codecs and write them
 * in a binary format.
 */

const c = require('compact-encoding')

const vectorIndexCodec = {
  preencode(state, value) {
    c.uint.preencode(state, value.version)
    c.string.preencode(state, value.modelId)
    c.uint.preencode(state, value.dimension)
    c.uint.preencode(state, value.tokensPerChunk)
    c.uint.preencode(state, value.windowStep)
    c.bool.preencode(state, value.oneVecPerDoc)
    c.array(c.string).preencode(state, value.index)
    c.array(c.float32array).preencode(state, value.vectors)
  },

  encode(state, value) {
    c.uint.encode(state, value.version)
    c.string.encode(state, value.modelId)
    c.uint.encode(state, value.dimension)
    c.uint.encode(state, value.tokensPerChunk)
    c.uint.encode(state, value.windowStep)
    c.bool.encode(state, value.oneVecPerDoc)
    c.array(c.string).encode(state, value.index)
    c.array(c.float32array).encode(state, value.vectors)
  },

  decode(state) {
    return {
      version: c.uint.decode(state),
      modelId: c.string.decode(state),
      dimension: c.uint.decode(state),
      tokensPerChunk: c.uint.decode(state),
      windowStep: c.uint.decode(state),
      oneVecPerDoc: c.bool.decode(state),
      index: c.array(c.string).decode(state),
      vectors: c.array(c.float32array).decode(state)
    }
  }
}

const bm25IndexCodec = {
  preencode(state, value) {
    c.uint.preencode(state, value.version)
    c.string.preencode(state, value.extractorHash)
    c.float64.preencode(state, value.k1)
    c.float64.preencode(state, value.b)
    c.float64.preencode(state, value.avgLength)
    c.float64.preencode(state, value.fuzzyThreshold)

    const { encodedDocs, keyIntMapping } = encodeBm25Docs(value)

    c.json.preencode(state, keyIntMapping)
    c.uint.preencode(state, encodedDocs.length)

    for (const doc of encodedDocs) {
      c.string.preencode(state, doc.id)
      c.uint.preencode(state, doc.length)
      c.float32array.preencode(state, doc.flattenedPairs)
    }
  },
  encode(state, value) {
    c.uint.encode(state, value.version)
    c.string.encode(state, value.extractorHash)
    c.float64.encode(state, value.k1)
    c.float64.encode(state, value.b)
    c.float64.encode(state, value.avgLength)
    c.float64.encode(state, value.fuzzyThreshold)

    const { encodedDocs, keyIntMapping } = encodeBm25Docs(value)

    c.json.encode(state, keyIntMapping)
    c.uint.encode(state, encodedDocs.length)

    for (const doc of encodedDocs) {
      c.string.encode(state, doc.id)
      c.uint.encode(state, doc.length)
      c.float32array.encode(state, doc.flattenedPairs)
    }
  },
  decode(state) {
    const version = c.uint.decode(state)
    const extractorHash = c.string.decode(state)
    const k1 = c.float64.decode(state)
    const b = c.float64.decode(state)
    const avgLength = c.float64.decode(state)
    const fuzzyThreshold = c.float64.decode(state)

    const keyIntMapping = c.json.decode(state)
    const totalDocs = c.uint.decode(state)

    const intKeyMapping = {}
    for (const [key, value] of Object.entries(keyIntMapping)) {
      intKeyMapping[value] = key
    }

    const docs = {}
    for (let i = 0; i < totalDocs; i++) {
      const id = c.string.decode(state)
      const length = c.uint.decode(state)
      const flattenedPairs = c.float32array.decode(state)

      const keywordMap = unflattenPairs(flattenedPairs, intKeyMapping)

      docs[id] = {
        length,
        keywordMap
      }
    }

    return {
      version,
      extractorHash,
      k1,
      b,
      avgLength,
      fuzzyThreshold,
      bm25Docs: docs,
      keywordSet: new Set(Object.keys(keyIntMapping))
    }
  }
}

function encodeBm25Docs(bm25Index) {
  const keyIntMapping = {}
  let i = 0
  for (const key of bm25Index.keywordSet) {
    keyIntMapping[key] = i++
  }

  const encodedDocs = []

  for (const [id, doc] of Object.entries(bm25Index.bm25Docs)) {
    const flattenedPairs = []
    for (const [key, value] of Object.entries(doc.keywordMap)) {
      flattenedPairs.push(keyIntMapping[key], value)
    }

    encodedDocs.push({
      id,
      length: doc.length,
      flattenedPairs: Float32Array.from(flattenedPairs)
    })
  }

  return { encodedDocs, keyIntMapping }
}

function unflattenPairs(flattenedPairs, intKeyMapping) {
  const keywordMap = {}
  for (let i = 0; i < flattenedPairs.length; i += 2) {
    const key = intKeyMapping[flattenedPairs[i]]
    const value = flattenedPairs[i + 1]

    keywordMap[key] = value
  }

  return keywordMap
}

module.exports = { vectorIndexCodec, bm25IndexCodec }
