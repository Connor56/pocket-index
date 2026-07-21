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

const path = require('path')

const test = require('brittle')
const b4a = require('b4a')

const { BM25Index, levenshteinSimilarity } = require('../lib/bm25')

function basicExtractor(text) {
  const split = text.split(' ')
  const filtered = split.filter((x) => x != '')
  const lowered = filtered.map((key) => key.toLowerCase())
  return lowered
}

function differentExtractor(text) {
  const split = text.split(' ')
  const filtered = split.filter((x) => x != '')
  const lowered = filtered.map((key) => key.toLowerCase())
  const set = new Set(lowered)
  return [...set]
}

function createIndex(overrides = {}) {
  return new BM25Index({
    extractor: basicExtractor,
    k1: 1.5,
    b: 0.75,
    ...overrides
  })
}

test('add a document to index', (t) => {
  const docId = 'test-1'
  const documents = [
    {
      content: 'This is a document I wish to add to the index.',
      id: docId
    }
  ]

  const index = createIndex()
  index.add(documents)

  t.ok(index.contains(docId), 'Document added to index')
})

test('add rejects duplicate document ids', (t) => {
  const index = createIndex()
  const id = 'dup-1'

  index.add([{ id, content: 'First document with this id.' }])

  t.exception(
    () => index.add([{ id, content: 'Second document with the same id.' }]),
    /duplicate doc/i,
    'Duplicate documents cannot be added'
  )
})

test('add rejects invalid documents', (t) => {
  const index = createIndex()

  t.exception(
    () => index.add([{ id: 'missing-content' }]),
    /id and some content/i,
    'Documents without content are rejected'
  )
})

test('serialize the bm25 index into a binary format', (t) => {
  const docId = 'test-1'
  const documents = [
    {
      content: 'This is a document I wish to add to the index.',
      id: docId
    }
  ]

  const index = createIndex()
  index.add(documents)

  const buff = index.serialize()

  t.is(b4a.isBuffer(buff), true, 'Buffer is a buffer')
  t.is(buff.length, 274, 'Buffer length is correct')
})

test('load restores index state from a binary buffer', (t) => {
  const documents = [
    {
      content: 'This is a document I wish to add to the index.',
      id: 'test-1'
    },
    {
      content: 'A completely different document, with some completely different content.',
      id: 'test-2'
    }
  ]

  const index = createIndex()
  index.add(documents)

  const buff = index.serialize()

  const newIndex = createIndex()
  newIndex.load(buff)

  t.alike(index.bm25Docs, newIndex.bm25Docs, 'Docs are the same')
  t.alike(index.avgLength, newIndex.avgLength, 'Avg length is the same')
  t.alike(index.k1, newIndex.k1, 'K1 is the same')
  t.alike(index.b, newIndex.b, 'B is the same')
  t.alike(index.fuzzyThreshold, newIndex.fuzzyThreshold, 'Fuzzy threshold is the same')
  t.alike(index.keywordSet, newIndex.keywordSet, 'Keyword set is the same')
  t.alike(index.extractorHash, newIndex.extractorHash, 'Extractor hash is the same')
  t.alike(index.version, newIndex.version, 'Version is the same')
})

test('load fails when the extractors are different', (t) => {
  const documents = [
    {
      content: 'This is a document I wish to add to the index.',
      id: 'test-1'
    }
  ]

  const index = createIndex()
  index.add(documents)

  const buff = index.serialize()

  const newIndex = createIndex({ extractor: differentExtractor })
  t.exception(
    () => newIndex.load(buff),
    /extractor hash mismatch/i,
    'Different extractors cause a loading failure'
  )
})

test('load fails when neither path nor buffer is provided', (t) => {
  const index = createIndex()

  t.exception(() => index.load(42), /path or buffer/i, 'Invalid load input is rejected')
})

test('save and load round-trip through a file path', async (t) => {
  const dir = await t.tmp()
  const filePath = path.join(dir, 'bm25-index.bin')

  const documents = [
    { id: 'cats', content: 'Cats are small furry pets that meow.' },
    { id: 'cars', content: 'Cars are vehicles with engines and wheels.' }
  ]

  const index = createIndex()
  index.add(documents)
  index.save(filePath)

  const loaded = createIndex()
  loaded.load(filePath)

  t.alike(loaded.list().sort(), ['cars', 'cats'])
  t.alike(loaded.bm25Docs, index.bm25Docs)
  t.is(loaded.contains('cats'), true)
})

test('list returns the ids currently in the index', (t) => {
  const index = createIndex()

  index.add([
    { id: 'alpha', content: 'First listed document.' },
    { id: 'beta', content: 'Second listed document.' }
  ])

  t.alike(index.list().sort(), ['alpha', 'beta'])
})

test('remove deletes a document from the index', (t) => {
  const index = createIndex()

  index.add([
    { id: 'keep', content: 'Document that should remain.' },
    { id: 'drop', content: 'Document that should be removed.' }
  ])

  index.remove('drop')

  t.is(index.contains('drop'), false)
  t.is(index.contains('keep'), true)
  t.alike(index.list(), ['keep'])
})

test('contains returns true for present ids and false otherwise', (t) => {
  const index = createIndex()
  index.add([{ id: 'doc-a', content: 'A short document about cats.' }])

  t.is(index.contains('doc-a'), true)
  t.is(index.contains('missing-id'), false)
})

test('search returns relevant document ids ranked by score', (t) => {
  const index = createIndex()

  index.add([
    { id: 'cats', content: 'Cats are small furry pets that meow and chase mice.' },
    { id: 'cars', content: 'Cars are vehicles with engines, wheels, and roads.' }
  ])

  const results = index.search('feline pets that meow')

  t.ok(results.length >= 1)
  t.is(results[0].id, 'cats')
  t.ok(typeof results[0].score === 'number')
  t.ok(results[0].score > 0)
})

test('search never returns a NaN score', (t) => {
  const index = createIndex()

  index.add([
    { id: 'cats', content: 'Cats are small furry pets that meow and chase mice.' },
    { id: 'cars', content: 'Cars are vehicles with engines, wheels, and roads.' }
  ])

  const results = index.search('feline pets that meow')
  const scores = results.map((r) => r.score)

  t.absent(
    scores.some((s) => Number.isNaN(s)),
    'No score is NaN'
  )
})

test('search respects topK', (t) => {
  const index = createIndex()

  index.add([
    { id: 'a', content: 'red apple fruit tree garden.' },
    { id: 'b', content: 'green apple fruit juice snack.' },
    { id: 'c', content: 'blue car vehicle engine road.' }
  ])

  const results = index.search('apple fruit', 1)

  t.is(results.length, 1)
  t.ok(['a', 'b'].includes(results[0].id))
})

test('keyword fuzzy matching works', (t) => {
  const documents = [
    {
      content: 'This is a document I wish to add to the index.',
      id: 'test-1'
    }
  ]

  const index = createIndex()
  index.add(documents)

  const matched = index._fuzzyMatchKeywords([
    'No',
    'this',
    'is',
    'wrong',
    'docuemnt',
    'docament',
    'indax'
  ])

  t.alike(matched, ['this', 'is', 'document'], 'The correct keywords were matched')
})

test('calculate idf scores rare terms higher than common ones', (t) => {
  const index = createIndex()

  index.add([
    { id: 'a', content: 'unique shared' },
    { id: 'b', content: 'shared common' }
  ])

  const expectedRare = Math.log((2 - 1 + 0.5) / (1 + 0.5) + 1)
  const expectedCommon = Math.log((2 - 2 + 0.5) / (2 + 0.5) + 1)

  t.is(index.idf.unique, expectedRare)
  t.is(index.idf.common, expectedRare)
  t.is(index.idf.shared, expectedCommon)
  t.ok(index.idf.unique > index.idf.shared)
})

test('levenshteinSimilarity returns 1 for identical strings', (t) => {
  t.is(levenshteinSimilarity('document', 'document'), 1)
})

test('levenshteinSimilarity decreases as strings diverge', (t) => {
  const close = levenshteinSimilarity('document', 'docuemnt')
  const far = levenshteinSimilarity('document', 'zzzzzzzz')

  t.ok(close > far)
  t.ok(close > 0.5)
  t.ok(far < 0.5)
})
