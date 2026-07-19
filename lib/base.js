class BaseIndex {
  constructor(opts) {
    if (new.target === BaseIndex) {
      throw new Error('BaseIndex cannot be instantiated directly')
    }

    const keys = Object.keys(opts)
    if (keys.includes('path') && keys.includes('docs')) {
      throw new Error('Cannot provide both path and docs during initialisation')
    }
  }

  add(documents) {
    throw new Error('add is not implemented')
  }

  load(path) {
    throw new Error('load is not implemented')
  }

  save(path) {
    throw new Error('save is not implemented')
  }

  serialize() {
    throw new Error('serialize is not implemented')
  }

  _loadFromBinary(buffer) {
    throw new Error('loadFromBinary is not implemented')
  }

  list() {
    throw new Error('list is not implemented')
  }

  remove(id) {
    throw new Error('remove is not implemented')
  }

  search(query) {
    throw new Error('search is not implemented')
  }
}

module.exports = BaseIndex
