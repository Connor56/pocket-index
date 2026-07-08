const BaseIndex = require('./base-index.js')

class VectorIndex extends BaseIndex {
  constructor(opts) {
    const { extractor, dimension, tokenInputSize, windowStep } = opts

    this.extractor = extractor
    this._validateExtractor(this.extractor)

    this.version = 1
    this.index = []
    this.dimension = dimension
    this.tokenInputSize = tokenInputSize
    this.windowStep = windowStep

    super(opts)
  }

  _splitTextIntoSentenceChunks(text) {
    const windowStep = this.windowStep
    const tokenInputSize = this.tokenInputSize

    if (!windowStep) {
      windowStep = tokenInputSize
    }

    // The use of "()" prevents split char removal
    const stopChars = /(?<=[.!?])/
    const sentences = text.split(stopChars)

    const cumulativeTokens = []
    const sentenceTokens = []

    for (const s of sentences) {
      let tokens = s.length / 4
      sentenceTokens.push(tokens)

      if (cumulativeTokens.length > 0) {
        tokens += cumulativeTokens.at(-1)
      }

      cumulativeTokens.push(tokens)
    }

    const windowIndexes = [0]

    for (const [index, tokens] of cumulativeTokens.entries()) {
      const steps = Math.floor(tokens / windowStep)
      if (steps >= windowIndexes.length) {
        windowIndexes.push(index)
      }
    }

    const chunks = []

    for (const wi of windowIndexes) {
      let splitTokens = 0
      let sentence = ''

      for (let i = wi; i < sentences.length; i++) {
        splitTokens += sentenceTokens[i]
        sentence += sentences[i]

        if (splitTokens >= tokenInputSize) {
          chunks.push(sentence)
          break
        }
      }

      // Add the last sentence even if it doesn't fit
      chunks.push(sentence)
    }

    return chunks
  }

  _embedChunks(chunks) {}

  _embedText(text, extractor) {}

  _validateExtractor(extractor) {
    const constructor = extractor.constructor.name
    if (constructor != 'FeatureExtractionPipeline')
      throw new Error('Must provide a hugging face feature extraction pipeline. Got:' + constructor)
  }

  _validateDocument(doc) {
    if (!doc.id || !doc.content)
      throw new Error(`Document must contain an id and some content. Got: ${doc}`)

    if (typeof doc.id != 'string' || typeof doc.content != 'string')
      throw new Error(`The document's id and content must be strings Got: ${doc}`)
  }
}

function addVectors(vec1, vec2, inplace = true) {
  if (!(vec1 instanceof Float32Array) || !(vec2 instanceof Float32Array))
    throw new Error(
      `Vectors must both be Float32Arrays:\nvec1: ${vec1.constructor.name}}\nvec2: ${vec2.constructor.name}`
    )

  if (!typeof inplace == 'boolean')
    throw new Error(`Inplace must be a boolean value. Type is: ${typeof inplace}`)

  if (vec1.length !== vec2.length)
    throw new Error(
      `Cannot add vectors with different lengths:\nvec1: ${vec1.length}\nvec2: ${vec2.length}`
    )

  let sum = vec1
  if (!inplace) {
    sum = new Float32Array(this.dimension)
  }

  for (let i = 0; i < vec1.length; i++) {
    const elementSum = vec1[i] + vec2[i]
    sum[i] = elementSum
  }

  return sum
}

module.exports = {
  VectorIndex,
  addVectors: addVectors
}
