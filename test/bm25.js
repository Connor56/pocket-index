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
const { BM25Index, levenshteinSimilarity } = require('../lib/bm25')
const b4a = require('b4a')

function basicExtractor(text) {
  const split = text.split(' ')
  const filtered = split.filter((x) => x != '')
  const lowered = filtered.map((key) => key.toLowerCase())
  return lowered
}

function createIndex(overrides = {}) {
  return new BM25Index({
    extractor: basicExtractor,
    k1: 1.5,
    b: 0.75
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

test('test deserialising the binary format back into a BM25Index', (t) => {
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

  console.log(index.fuzzyThreshold, newIndex.fuzzyThreshold)

  t.alike(index.bm25Docs, newIndex.bm25Docs, 'Docs are the same')
  t.alike(index.avgLength, newIndex.avgLength, 'Avg length is the same')
  t.alike(index.k, newIndex.k, 'K is the same')
  t.alike(index.b, newIndex.b, 'B is the same')
  t.alike(index.fuzzyThreshold, newIndex.fuzzyThreshold, 'Fuzzy threshold is the same')
  t.alike(index.keywordSet, newIndex.keywordSet, 'Keyword set is the same')
  t.alike(index.extractorHash, newIndex.extractorHash, 'Extractor hash is the same')
  t.alike(index.version, newIndex.version, 'Version is the same')
})

test('test keyword fuzzy matching works', (t) => {
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
