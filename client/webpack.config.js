path = require('path');

module.exports = {
  entry: './index.js',
  output: {
    filename: 'bundle.js'
  },
  resolve: {
    modules: [
      path.resolve('.')
    ]
  }
}
