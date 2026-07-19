class BaseIndex {
  constructor(opts) {
    if (new.target === BaseIndex) {
      throw new Error('BaseIndex cannot be instantiated directly')
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

  contains(id) {
    throw new Error('contains is not implemented')
  }
}

module.exports = BaseIndex
