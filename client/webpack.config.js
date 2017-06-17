var path = require('path');

module.exports = {
  context: path.resolve(__dirname),
  entry: {
    main: './src/index.js',
    "wav-recorder-worker": './src/lib/wavrecorder/worker.js'
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
          'babel-loader?cacheDirectory=true',
        ],
      }
    ]
  },
  devtool: 'source-map',
  resolve: {
      extensions: ['.js', '.jsx'],
      modules: [
          path.resolve(__dirname, "src"),
          "node_modules"
      ]
  },
}
