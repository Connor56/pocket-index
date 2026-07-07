const BaseIndex = require('./base-index.js')

class VectorIndex extends BaseIndex {
  constructor(opts) {
    const { extractor, dimension, tokenInputSize, windowStep } = opts

    this.version = 1
    this.index = []
    this.extractor = extractor
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
    const sentenceLengths = []

    for (const s of sentences) {
      let tokens = s.length / 4
      sentenceLengths.push(tokens)

      if (cumulativeTokens.length > 0) {
        tokens += cumulativeTokens.at(-1)
      }

      cumulativeTokens.push(tokens)
    }

    const windowStartIndexes = [0]

    for (const [index, tokens] of cumulativeTokens.entries()) {
      const windowSteps = Math.floor(tokens / windowStep)
      if (windowSteps >= windowStartIndexes.length) {
        windowStartIndexes.push(index)
      }
    }

    const chunks = []

    for (const wsi of windowStartIndexes) {
      let splitTokens = 0
      let sentence = ''

      for (let i = wsi; i < sentences.length; i++) {
        splitTokens += sentenceLengths[i]
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
}
