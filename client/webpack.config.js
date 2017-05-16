var path = require('path');

module.exports = {
  context: path.resolve(__dirname),
  entry: {
    main: './index.js',
    "wav-recorder-worker": './lib/wavrecorder/worker.js'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [
          'babel-loader',
        ],
      }
    ]
  },
  devtool: 'source-map',
  resolve: {
      extensions: ['.js', '.jsx'],
      modules: [
          __dirname,
          "node_modules"
      ]
  },
  resolveLoader: {
      modules: [
          __dirname,
          'node_modules'
      ]
  }
}
