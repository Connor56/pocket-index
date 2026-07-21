const BaseIndex = require('./base.js')
const cenc = require('compact-encoding')
const fs = require('fs')
const b4a = require('b4a')
const { createHash } = require('crypto')
const { bm25IndexCodec } = require('./codecs.js')

class BM25Index extends BaseIndex {
  constructor(opts) {
    if (new.target === BaseIndex) {
      throw new Error('BaseIndex cannot be instantiated directly')
    }

    super(opts)

    const { extractor, k1 = 1.5, b = 0.75 } = opts

    this._validateExtractor(extractor)
    const extractorHash = createHash('sha256').update(extractor.toString()).digest('hex')

    this.extractor = extractor
    // Helps warn of a mismatch between keyword extractors
    this.extractorHash = extractorHash
    this.version = 1
    this.k1 = k1
    this.b = b
    this.bm25Docs = {}
    this.avgLength = 0
    this.idf = {}
    this.keywordSet = new Set()
  }

  add(documents) {
    for (const doc of documents) {
      this._validateDocument(doc)
      if (this.bm25Docs[doc.id]) throw new Error(`Duplicate doc id: ${doc.id}`)

      const keywords = this._extractKeywords(doc.content)
      const keywordMap = this._buildKeywordMap(keywords)

      for (const key of keywords) this.keywordSet.add(key)

      this.bm25Docs[doc.id] = {
        keywordMap,
        length: keywords.length
      }
    }

    this._calculateAvgLength()
    this._calculateIdf()
  }

  load(pathOrBuffer) {
    if (typeof pathOrBuffer == 'string') {
      const data = fs.readFileSync(pathOrBuffer)
      return this._loadFromBinary(data)
    } else if (b4a.isBuffer(pathOrBuffer)) {
      return this._loadFromBinary(pathOrBuffer)
    } else {
      throw new Error('Either path or buffer must be provided')
    }
  }

  save(path) {
    const buffer = this.serialize()
    fs.writeFileSync(path, buffer)
  }

  serialize() {
    return cenc.encode(bm25IndexCodec, this)
  }

  list() {
    return Object.keys(this.bm25Docs)
  }

  remove(id) {
    return delete this.bm25Docs[id]
  }

  search(query, topK = null) {
    const keywords = this._extractKeywords(query)
    const topIds = []

    for (const doc of this.bm25Docs) {
      if (topK != null && topIds.length >= topK) break

      const score = this._scoreDoc(doc, keywords)

      topIds.push({
        id: doc.id,
        score
      })
    }

    return topIds
  }

  contains(id) {
    return this.bm25Docs[id] ? true : false
  }

  _loadFromBinary(buffer) {
    const data = cenc.decode(bm25IndexCodec, buffer)
    console.dir(data, { depth: null })

    if (this.extractorHash !== data.extractorHash) {
      throw new Error('Extractor hash mismatch')
    }

    this.version = data.version
    this.k = data.k
    this.b = data.b
    this.bm25Docs = data.bm25Docs
    this.keywordSet = data.keywordSet

    this._calculateAvgLength()

    if (this.avgLength != data.avgLength) {
      throw new Error('Average length mismatch')
    }

    this._calculateIdf()
  }

  _extractKeywords(text) {
    return this.extractor(text)
  }

  _buildKeywordMap(keywords) {
    const keywordMap = {}

    for (const key of keywords) {
      const total = keywordMap[key] ?? 0
      keywordMap[key] = total + 1
    }

    return keywordMap
  }

  // Implemenation of the Okapi BM25 algorithm: https://en.wikipedia.org/wiki/Okapi_BM25
  _scoreDoc(bm25Doc, keywords) {
    let score = 0

    for (const key of keywords) {
      const occurrences = bm25Doc.keywords[key]

      const numerator = occurrences * (this.k1 + 1)
      const denominator =
        (occurrences + this.k1) * (1 - this.b + this.b * (bm25Doc.length / this.avgLength))

      score += (this.idf[key] * numerator) / denominator
    }

    return score
  }

  // Pre calculates IDF for every keyword
  _calculateIdf() {
    const idf = {}
    const totalDocs = this.bm25Docs.length

    for (const key of this.keywordSet) {
      let occurrences = 0

      for (const doc of Object.values(this.bm25Docs)) {
        const exists = doc.keywordMap[key]

        if (exists) occurrences++
      }

      const numerator = totalDocs - occurrences + 0.5
      const denominator = occurrences + 0.5
      idf[key] = Math.log(numerator / denominator + 1)
    }

    this.idf = idf
  }

  _calculateAvgLength() {
    let sum = 0
    for (const doc of Object.values(this.bm25Docs)) {
      sum += doc.length
    }

    const totalDocs = Object.keys(this.bm25Docs).length

    this.avgLength = sum / totalDocs
  }

  // Check the keyword extractor returns an array of strings
  _validateExtractor(extractor) {
    const dummyText = `This is a test string with complicated words about large
        alterations to the house in the woods that requires new paint and a
        brand spanking new kitchen with marble top surfaces. It will look lovely
        when it's done.`

    const keywords = extractor(dummyText)
    for (const key of keywords) {
      if (typeof key !== 'string')
        throw new Error(`Keyword extractor must turn text into an array of strings. Got: ${key}`)

      if (key === '') throw new Error('Keyword extractor must not capture empty strings')
    }
  }

  _validateDocument(doc) {
    if (!doc.id || !doc.content)
      throw new Error(`Document must contain an id and some content. Got: ${doc}`)

    if (typeof doc.id != 'string' || typeof doc.content != 'string')
      throw new Error(`The document's id and content must be strings Got: ${doc}`)
  }
}

module.exports = BM25Index
