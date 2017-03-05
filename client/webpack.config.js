var path = require('path');

module.exports = {
  context: path.resolve(__dirname),
  entry: {
    main: './index.js',
    "wav-recorder-worker": './lib/wavrecorder/worker.js'
  },
  output: {
    filename: '[name].js',
    path: './dist',
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
    extensions: ['.js', '.jsx']
  }
}
