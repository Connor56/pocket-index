const fs = require('fs')
const path = require('path')

function loadArticles() {
  const dataDir = path.join(__dirname, '..', 'data')

  return fs
    .readdirSync(dataDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({
      id: name.replace(/\.md$/, ''),
      content: fs.readFileSync(path.join(dataDir, name), 'utf8')
    }))
}

module.exports = {
  loadArticles
}
