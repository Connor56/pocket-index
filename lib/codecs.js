// @ts-check

/**
 * Codecs for the various index types for storing the data in the most compact
 * form possible. Uses `compact-encoding` to define the codecs and write them
 * in a binary format.
 */

const c = require('compact-encoding')

const vectorIndexCodec = {
  preencode(state, value) {
    console.log('preencode', Object.keys(value))
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
    console.log('encode', Object.keys(value))
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

module.exports = { vectorIndexCodec }
