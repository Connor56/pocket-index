// @ts-check

const BaseIndex = require('./base.js')
const cenc = require('compact-encoding')
const { vectorIndexCodec } = require('./codecs.js')
const fs = require('fs')
const b4a = require('b4a')

class VectorIndex extends BaseIndex {
  constructor(opts) {
    const { extractor, dimension, tokensPerChunk, windowStep, oneVecPerDoc, modelId } = opts

    super(opts)

    this._validateExtractor(extractor)
    this._validateModelId(modelId)

    this.extractor = extractor
    // modelId is stored so it can be checked on deserialization
    this.modelId = modelId
    this.dimension = dimension
    this.tokensPerChunk = tokensPerChunk
    this.windowStep = windowStep
    // If true, all chunks are summed
    this.oneVecPerDoc = oneVecPerDoc

    this.version = 1
    this.index = []
    this.vectors = []
    this.idSet = new Set()
  }

  _splitTextIntoSentenceChunks(text) {
    let windowStep = this.windowStep
    const tokenInputSize = this.tokensPerChunk

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

      if (this.idSet.has(doc.id)) {
        console.log(`skipped ${doc} as ID is already in use`)
        continue
      }

      const chunks = this._splitTextIntoSentenceChunks(doc.content)
      const embeddings = []

      for (const chunk of chunks) {
        const embedding = await this._embedText(chunk, this.extractor)
        embeddings.push(embedding)
      }

      if (this.oneVecPerDoc) {
        const sum = sumVectorArray(embeddings)
        const normed = normaliseVector(sum)

        this.vectors.push(normed)
        this.index.push(doc.id)
        this.idSet.add(doc.id)

        continue
      }

      for (const vec in embeddings) {
        const normed = normaliseVector(vec)

        this.vectors.push(normed)
        this.index.push(doc.id)
      }

      this.idSet.add(doc.id)
    }
  }

  serialize() {
    return cenc.encode(vectorIndexCodec, this)
  }

  save(path) {
    const buffer = this.serialize()
    fs.writeFileSync(path, buffer)
  }

  load(pathOrBuffer) {
    if (typeof pathOrBuffer == 'string') {
      const data = fs.readFileSync(path)
      return this._loadFromBinary(data)
    } else if (b4a.isBuffer(pathOrBuffer)) {
      return this._loadFromBinary(buffer)
    } else {
      throw new Error('Either path or buffer must be provided')
    }
  }

  async search(query, topK = 10) {
    const queryVector = await this._embedText(query, this.extractor)
    const normedVector = normaliseVector(queryVector)
    const distances = this.vectors.map((vec) => cosineDistance(normedVector, vec))
    const sorted = distances.sort((a, b) => a - b)

    const sortedIndices = argsort(distances)
    const topIds = []

    for (const index of sortedIndices) {
      if (topIds.length >= topK) break
      if (topIds.includes(this.index[index])) continue

      topIds.push(this.index[index])
    }

    return topIds
  }

  remove(id) {
    let start = -1
    let end = -1

    for (let i = 0; i < this.index.length; i++) {
      if (this.index[i] == id && start == -1) start = i
      if (this.index[i] == id) end = i
    }

    // Takes advantage of IDs being unique and added sequentially
    const deleteCount = end - start + 1
    if (deleteCount >= 1) {
      this.index.splice(start, deleteCount)
      this.vectors.splice(start, deleteCount)
      this.idSet.delete(id)
    }
  }

  list() {
    return this.index
  }

  contains(id) {
    return this.idSet.has(id)
  }

  _loadFromBinary(buffer) {
    const data = cenc.decode(vectorIndexCodec, buffer)
    const {
      version,
      modelId,
      dimension,
      tokensPerChunk,
      windowStep,
      oneVecPerDoc,
      index,
      vectors
    } = data

    if (modelId !== this.modelId) {
      throw new Error(`Model ID mismatch. Expected: ${this.modelId}, got: ${modelId}`)
    }

    if (dimension !== this.dimension) {
      throw new Error(`Dimension mismatch. Expected: ${this.dimension}, got: ${dimension}`)
    }

    this.version = version
    this.tokensPerChunk = tokensPerChunk
    this.windowStep = windowStep
    this.oneVecPerDoc = oneVecPerDoc
    this.index = index
    this.vectors = vectors
    this.idSet = new Set(index)
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

  _validateModelId(modelId) {
    if (!modelId || typeof modelId != 'string' || modelId.length === 0)
      throw new Error('Model ID is required and must be a non-empty string')
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
    sum = new Float32Array(vec1.length)
  }

  for (let i = 0; i < vec1.length; i++) {
    sum[i] = vec1[i] + vec2[i]
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

function argsort(values, reverse = false) {
  if (!Array.isArray(values)) throw new Error('Values must be an array')

  return values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => (reverse ? b.value - a.value : a.value - b.value))
    .map((item) => item.index)
}

module.exports = {
  VectorIndex,
  addVectors: addVectors,
  normaliseVector: normaliseVector,
  sumVectorArray: sumVectorArray
}
