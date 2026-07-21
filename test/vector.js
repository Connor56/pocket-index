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
const {
  VectorIndex,
  addVectors,
  sumVectorArray,
  normaliseVector,
  argsort
} = require('../lib/vector')
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

async function createIndex(overrides = {}) {
  const extractor = await getFeatureExtractor()

  return new VectorIndex({
    extractor,
    dimension: 384,
    tokensPerChunk: 256,
    windowStep: 256,
    oneVecPerDoc: true,
    modelId: MODEL_ID,
    ...overrides
  })
}

test('add a document to index', async (t) => {
  const docId = 'test-1'
  const documents = [
    {
      content: 'This is a document I wish to add to the index.',
      id: docId
    }
  ]

  const index = await createIndex()
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

  const index = await createIndex()
  await index.add(documents)

  const buff = index.serialize()

  t.is(buff.length, 1596)
  t.is(b4a.isBuffer(buff), true)
  t.alike(index.index[0], docId)
})

test('argsort returns indices for ascending integer order', (t) => {
  t.alike(argsort([3, 1, 2]), [1, 2, 0])
  t.alike(argsort([10, 5, 8, 1]), [3, 1, 2, 0])
  t.alike(argsort([10, 5, 8, 1], true), [0, 2, 1, 3])
})

test('contains returns true for present ids and false otherwise', async (t) => {
  const index = await createIndex()
  await index.add([{ id: 'doc-a', content: 'A short document about cats.' }])

  t.is(index.contains('doc-a'), true)
  t.is(index.contains('missing-id'), false)
})

test('ids are added to idSet after a document is added', async (t) => {
  const index = await createIndex()
  t.is(index.idSet.has('doc-b'), false)

  await index.add([{ id: 'doc-b', content: 'A short document about dogs.' }])

  t.is(index.idSet.has('doc-b'), true)
  t.is(index.idSet.size, 1)
})

test('duplicate document ids cause an error', async (t) => {
  const index = await createIndex()
  const id = 'dup-1'

  await t.exception(
    async () =>
      await index.add([
        { id, content: 'First document with this id.' },
        { id, content: 'Second document with the same id should be skipped.' }
      ]),
    /duplicate doc/i,
    'Duplicate documents cannot be added'
  )
})

test('remove clears index, vectors, and idSet when oneVecPerDoc is true', async (t) => {
  const index = await createIndex({ oneVecPerDoc: true })

  await index.add([
    { id: 'keep', content: 'Document that should remain.' },
    { id: 'drop', content: 'Document that should be removed.' }
  ])

  t.is(index.index.length, 2)
  t.is(index.vectors.length, 2)
  t.is(index.idSet.size, 2)

  index.remove('drop')

  t.alike(index.index, ['keep'])
  t.is(index.vectors.length, 1)
  t.is(index.idSet.has('drop'), false)
  t.is(index.idSet.has('keep'), true)
  t.is(index.contains('drop'), false)
})

test('remove clears all chunk entries when oneVecPerDoc is false', async (t) => {
  const index = await createIndex({
    oneVecPerDoc: false,
    tokensPerChunk: 8,
    windowStep: 8
  })

  const longContent =
    'Sentence one is here. Sentence two is here. Sentence three is here. Sentence four is here. Sentence five is here.'

  await index.add([
    { id: 'keep', content: 'A short keep document.' },
    { id: 'drop', content: longContent }
  ])

  const dropCount = index.index.filter((id) => id === 'drop').length
  t.ok(dropCount >= 1)
  t.is(index.idSet.has('drop'), true)

  index.remove('drop')

  t.alike(
    index.index.filter((id) => id === 'drop'),
    []
  )
  t.is(index.vectors.length, index.index.length)
  t.is(index.idSet.has('drop'), false)
  t.is(index.contains('keep'), true)
  t.ok(index.index.includes('keep'))
})

test('list returns the ids currently in the index', async (t) => {
  const index = await createIndex()

  await index.add([
    { id: 'alpha', content: 'First listed document.' },
    { id: 'beta', content: 'Second listed document.' }
  ])

  const ids = index.list()
  t.alike(ids.sort(), ['alpha', 'beta'])
})

test('search returns relevant document ids', async (t) => {
  const index = await createIndex()

  await index.add([
    { id: 'cats', content: 'Cats are small furry pets that meow and chase mice.' },
    { id: 'cars', content: 'Cars are vehicles with engines, wheels, and roads.' }
  ])

  const results = await index.search('feline pets that meow', 2)

  t.is(results[0].id, 'cats')
})

test('loading binary fails when modelId does not match', async (t) => {
  const source = await createIndex({ modelId: MODEL_ID })
  await source.add([{ id: 'doc-1', content: 'Document stored in the index binary.' }])

  const buffer = source.serialize()

  const target = await createIndex({ modelId: 'different-model-id' })

  t.exception(() => target.load(buffer), /Model ID mismatch/)
})

test('load restores index state from a binary buffer', async (t) => {
  const source = await createIndex()
  await source.add([{ id: 'doc-1', content: 'Document stored in the index binary.' }])
  await source.add([{ id: 'doc-2', content: 'A second document stored in the index binary.' }])

  const buffer = source.serialize()

  const target = await createIndex()
  target.load(buffer)

  t.alike(target.index, ['doc-1', 'doc-2'])
  t.is(target.vectors.length, 2)
  t.is(target.contains('doc-1'), true)
  t.alike(target.list().sort(), ['doc-1', 'doc-2'])
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
