import type { Doc, SearchResult } from './models.d.ts'

export interface BM25IndexOptions {
  extractor: (text: string) => string[]
  extractorId: string
  k1?: number
  b?: number
  fuzzyThreshold?: number
}

export interface BM25Doc {
  keywordMap: Record<string, number>
  length: number
}

export declare class BM25Index {
  constructor(opts: BM25IndexOptions)
  add(documents: Doc[]): void
  serialize(): Uint8Array
  save(path: string): void
  load(pathOrBytes: string | Uint8Array): void
  search(query: string, topK?: number | null): SearchResult[]
  remove(id: string): void
  list(): string[]
  contains(id: string): boolean

  _loadFromBinary(bytes: Uint8Array): void
  _extractKeywords(text: string): string[]
  _buildKeywordMap(keywords: string[]): Record<string, number>
  _scoreDoc(bm25Doc: BM25Doc, keywords: string[]): number
  _fuzzyMatchKeywords(keywords: string[]): string[]
  _calculateIdf(): void
  _calculateAvgLength(): void
  _validateExtractor(extractor: (text: string) => string[]): void
  _validateExtractorId(extractorId: string): void
  _validateDocument(doc: Doc): void

  extractor: (text: string) => string[]
  extractorId: string
  version: number
  fuzzyThreshold: number
  k1: number
  b: number
  bm25Docs: Record<string, BM25Doc>
  avgLength: number
  idf: Record<string, number>
  keywordSet: Set<string>
}

export declare function levenshteinSimilarity(s1: string, s2: string): number
