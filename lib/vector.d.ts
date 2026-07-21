import type { Doc, SearchResult } from './models.d.ts'

export interface HuggingFaceTensor {
  data: Float32Array
}

export type HuggingFaceExtractorType = (
  texts: string[],
  opts: Record<string, any>
) => HuggingFaceTensor

export interface VectorIndexOptions {
  extractor: HuggingFaceExtractorType
  dimension: number
  tokensPerChunk: number
  windowStep: number
  oneVecPerDoc: boolean
  modelId: string
}

export declare class VectorIndex {
  constructor(opts: VectorIndexOptions)
  add(documents: Doc[]): Promise<void>
  serialize(): Buffer
  save(path: string): void
  load(path: string | Buffer): void
  search(query: string, topK?: number | null): Promise<SearchResult[]>
  remove(id: string): void
  list(): string[]
  contains(id: string): boolean

  _splitTextIntoSentenceChunks(text: string): string[]
  _loadFromBinary(data: Buffer): void
  _embedText(text: string, extractor: HuggingFaceExtractorType): Promise<Float32Array>
  _validateExtractor(extractor: HuggingFaceExtractorType): void
  _validateModelId(modelId: string): void
  _validateDocument(document: Doc): void

  extractor: HuggingFaceExtractorType
  modelId: string
  dimension: number
  tokensPerChunk: number
  windowStep: number
  oneVecPerDoc: boolean
  version: number
  index: string[]
  vectors: Float32Array[]
  idSet: Set<string>
}

export declare function addVectors(
  vec1: Float32Array,
  vec2: Float32Array,
  inplace?: boolean
): Float32Array

export declare function normaliseVector(vec: Float32Array, inplace?: boolean): Float32Array

export declare function sumVectorArray(vectorArray: Float32Array[]): Float32Array

export declare function argsort(values: number[] | string[], reverse?: boolean): number[] | string[]

export declare function cosineSimilarity(vec1: Float32Array, vec2: Float32Array): number
