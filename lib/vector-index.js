const BaseIndex = require('./base-index.js')

class VectorIndex extends BaseIndex {
  constructor(opts) {
    const { extractor, dimension, tokenInputSize, windowStep, oneVecPerDoc } = opts

    this._validateExtractor(extractor)

    this.extractor = extractor
    this.dimension = dimension
    this.tokenInputSize = tokenInputSize
    this.windowStep = windowStep
    // If true, all chunks are summed
    this.oneVecPerDoc = oneVecPerDoc

    this.version = 1
    this.index = []
    this.vectors = []

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

  async add(documents) {
    for (const doc of documents) {
      this._validateDocument(doc)

      const chunks = this._splitTextIntoSentenceChunks(doc)
      const embeddings = chunks.map((chunk) => this._embedText(chunk))

      if (this.oneVecPerDoc) {
        const sum = sumVectorArray(embeddings)
        const normed = normaliseVector(sum)

        this.vectors.push(normed)
        this.index.push(doc.id)

        continue
      }

      for (const vec in embeddings) {
        const normed = normaliseVector(vec)

        this.vectors.push(normed)
        this.index.push(doc.id)
      }
    }
  }

  async _embedText(text, extractor) {
    if (typeof text != 'string') throw new Error(`Cannot embed none-string type: ${typeof text}`)

    const tensor = await extractor(text, {
      pooling: 'mean',
      normalize: true
    })

    return tensor.data
  }

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

function sumVectorArray(vectorArray) {
  const length = vectorArray[0].length
  const sum = new Float32Array(length)

  for (const vec of vectorArray) {
    if (!(vec instanceof Float32Array))
      throw new Error('All vectors must be Float32Arrays. Received: ' + vec.constructor.name)

    if (vec.length != length)
      throw new Error(
        `All vectors in array must have the same size. Expected size: ${length}, received: ${vec.length}`
      )

    addVectors(sum, vec)
  }

  return sum
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

function normaliseVector(vec, inplace = true) {
  let mag2 = 0

  for (const el of vec) {
    mag2 += el ** 2
  }

  const magnitude = Math.sqrt(mag2)
  const inverseMag = 1 / magnitude

  let normed = vec
  if (!inplace) {
    normed = new Float32Array(vec.length)
  }

  for (let i = 0; i < vec.length; i++) {
    normed[i] = vec[i] * inverseMag
  }

  return normed
}

module.exports = {
  VectorIndex,
  addVectors: addVectors,
  normaliseVector: normaliseVector
}
