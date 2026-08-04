const fs = require('fs')

const b4a = require('b4a')
const cenc = require('compact-encoding')
const { distance } = require('fastest-levenshtein')

const BaseIndex = require('./base.js')
const { bm25IndexCodec } = require('./codecs.js')

class BM25Index extends BaseIndex {
  constructor(opts) {
    if (new.target === BaseIndex) {
      throw new Error('BaseIndex cannot be instantiated directly')
    }

    super(opts)

    const { extractor, extractorId, k1 = 1.5, b = 0.75, fuzzyThreshold = 0.85 } = opts

    this._validateExtractor(extractor)
    this._validateExtractorId(extractorId)

    this.extractor = extractor
    this.extractorId = extractorId
    this.version = 2
    this.fuzzyThreshold = fuzzyThreshold
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

  load(pathOrBytes) {
    if (typeof pathOrBytes == 'string') {
      const bytes = fs.readFileSync(pathOrBytes)
      return this._loadFromBinary(bytes)
    } else if (b4a.isBuffer(pathOrBytes)) {
      return this._loadFromBinary(pathOrBytes)
    } else {
      throw new Error('Either path or bytes must be provided')
    }
  }

  save(path) {
    const bytes = this.serialize()
    fs.writeFileSync(path, bytes)
  }

  serialize() {
    return cenc.encode(bm25IndexCodec, this)
  }

  list() {
    return Object.keys(this.bm25Docs)
  }

  remove(id) {
    const deleted = delete this.bm25Docs[id]

    this._calculateAvgLength()
    this._calculateIdf()

    return deleted
  }

  search(query, topK = null) {
    const keywords = this._extractKeywords(query)
    const fuzzyMatchedKeywords = this._fuzzyMatchKeywords(keywords)
    const topIds = []

    for (const [id, doc] of Object.entries(this.bm25Docs)) {
      const score = this._scoreDoc(doc, fuzzyMatchedKeywords)

      topIds.push({
        id,
        score
      })
    }

    topIds.sort((a, b) => b.score - a.score)

    if (topK != null) return topIds.slice(0, topK)
    return topIds
  }

  contains(id) {
    return this.bm25Docs[id] ? true : false
  }

  _loadFromBinary(bytes) {
    const state = cenc.decode(bm25IndexCodec, bytes)

    if (this.extractorId !== state.extractorId) {
      throw new Error(
        `Extractor ID mismatch. Expected: ${this.extractorId}, got: ${state.extractorId}`
      )
    }

    this.version = state.version
    this.k1 = state.k1
    this.b = state.b
    this.fuzzyThreshold = state.fuzzyThreshold
    this.bm25Docs = state.bm25Docs
    this.keywordSet = state.keywordSet

    this._calculateAvgLength()

    if (this.avgLength != state.avgLength) {
      throw new Error('Average length mismatch')
    }

    this._calculateIdf()
  }

  // The exact keyword extraction method is decided by the user when they
  // provide the extraction function.
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
      const occurrences = bm25Doc.keywordMap[key]
      if (!occurrences) continue

      const numerator = occurrences * (this.k1 + 1)
      const denominator =
        (occurrences + this.k1) * (1 - this.b + this.b * (bm25Doc.length / this.avgLength))

      const keyScore = (this.idf[key] * numerator) / denominator
      score += keyScore
    }

    return score
  }

  _fuzzyMatchKeywords(keywords) {
    const fuzzyMatchedKeywords = new Set()

    for (const keyword of keywords) {
      for (const key of this.keywordSet) {
        const similarity = levenshteinSimilarity(keyword, key)

        if (similarity >= this.fuzzyThreshold) fuzzyMatchedKeywords.add(key)
      }
    }

    return [...fuzzyMatchedKeywords]
  }

  // Pre calculates IDF for every keyword
  _calculateIdf() {
    const idf = {}
    const totalDocs = Object.keys(this.bm25Docs).length

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

  _validateExtractorId(extractorId) {
    if (!extractorId || typeof extractorId != 'string')
      throw new Error('Extractor ID is required and must be a non-empty string')
  }

  _validateDocument(doc) {
    if (!doc.id || !doc.content)
      throw new Error(`Document must contain an id and some content. Got: ${doc}`)

    if (typeof doc.id != 'string' || typeof doc.content != 'string')
      throw new Error(`The document's id and content must be strings Got: ${doc}`)
  }
}

// The similarity between two strings computed by levenshtein distance, and
// normalised into the [0, 1] range.
function levenshteinSimilarity(s1, s2) {
  const maxLen = Math.max(s1.length, s2.length)
  const levDist = distance(s1, s2)
  const ratio = levDist / maxLen

  return 1 - ratio
}

module.exports = { BM25Index, levenshteinSimilarity }
