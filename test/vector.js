// @ts-check

/*
  Basic tests should cover the public API from index.js.

  In mafintosh/Holepunch-style modules, tests usually:
  - use brittle (`const test = require('brittle')`)
  - require the package with `require('..')`
  - create real instances through helpers in `test/helpers`
  - assert public properties and lifecycle behaviour
  - close or destroy resources with `t.teardown()`

  Add one small `test('...', async function (t) {})` block per behaviour.
*/

const test = require('brittle')
const { VectorIndex, addVectors, sumVectorArray, normaliseVector } = require('../lib/vector')
const { pipeline, env } = require('@huggingface/transformers')
const b4a = require('b4a')

let EXTRACTOR = null
const MODEL_ID = 'onnx-community/all-MiniLM-L6-v2-ONNX'
env.cacheDir = './.cache/transformers'

async function getFeatureExtractor() {
  if (!EXTRACTOR) {
    EXTRACTOR = await pipeline('feature-extraction', MODEL_ID, {
      dtype: 'fp32'
    })
  }

  return EXTRACTOR
}

test('add a document to index', async (t) => {
  const docId = 'test-1'
  const documents = [
    {
      content: 'This is a document I wish to add to the index.',
      id: docId
    }
  ]

  const extractor = await getFeatureExtractor()

  const options = {
    extractor: extractor,
    dimension: 384,
    tokensPerChunk: 256,
    windowStep: 256,
    oneVecPerDoc: true,
    modelId: MODEL_ID
  }

  const index = new VectorIndex(options)
  await index.add(documents)

  t.alike(index.index[0], docId)
})

test('serialize the vector index into a binary format', async (t) => {
  const docId = 'test-1'
  const documents = [
    {
      content: 'This is a document I wish to add to the index.',
      id: docId
    }
  ]

  const extractor = await getFeatureExtractor()

  // console.log(Object.keys(extractor))
  // console.log(Object.keys(extractor.model))
  // console.dir(extractor.model, { depth: null })

  const options = {
    extractor: extractor,
    dimension: 384,
    tokensPerChunk: 256,
    windowStep: 256,
    oneVecPerDoc: true,
    modelId: MODEL_ID
  }

  const index = new VectorIndex(options)
  await index.add(documents)

  const buff = index.serialize()
  console.log(buff.length)

  t.is(buff.length, 1596)
  t.is(b4a.isBuffer(buff), true)

  t.alike(index.index[0], docId)
})

test('sum a float32 vector array', (t) => {
  const vectorArray = [
    Float32Array.from([1, 2, 3]),
    Float32Array.from([4, 5, 6]),
    Float32Array.from([7, 8, 9])
  ]
  const expectedSum = Float32Array.from([12, 15, 18])
  const sum = sumVectorArray(vectorArray)
  t.alike(sum, expectedSum)
})

test('add two vectors', (t) => {
  const vec1 = Float32Array.from([1, -1, 5])
  const vec2 = Float32Array.from([2, 0, -10])
  const expectedSum = Float32Array.from([3, -1, -5])

  // Setup for fair timing
  let sum = []
  sum = addVectors(vec1, vec2, false)

  const newArrayStart = performance.now()
  sum = addVectors(vec1, vec2, false)
  const newArrayTime = performance.now() - newArrayStart

  t.alike(sum, expectedSum)

  const inplaceStart = performance.now()
  sum = addVectors(vec1, vec2)
  const inplaceTime = performance.now() - inplaceStart

  t.alike(sum, expectedSum)
  t.comment(`inplace time: ${inplaceTime}, newArrayTime: ${newArrayTime}`)
})

test('normalise a vector', (t) => {
  const vec = Float32Array.from([1, 2, 3])
  const expectedNormalised = Float32Array.from([
    1 / Math.sqrt(14),
    2 / Math.sqrt(14),
    3 / Math.sqrt(14)
  ])
  const normalised = normaliseVector(vec)
  t.alike(normalised, expectedNormalised)
})
