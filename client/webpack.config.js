const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const extractSass = new ExtractTextPlugin({
  filename: "css/[name].css"
});

module.exports = {
  context: path.resolve(__dirname),
  entry: {
    main: './src/index.js',
    "wav-recorder-worker": './src/lib/wavrecorder/worker.js',
    style: "./styles/style.scss"
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
      },
      {
        test: /\.scss$/,
        use: extractSass.extract({
          use: [{loader: 'css-loader'}, {loader:'sass-loader'}],
        })
      },
    ],
  },
  plugins: [
    extractSass,
    new CopyWebpackPlugin([
      {from: "sounds/*.mp3"},
    ])
  ],
  devtool: 'source-map',
  resolve: {
    extensions: ['.js', '.jsx'],
    modules: [
        path.resolve(__dirname, "src"),
        "node_modules"
    ]
  },
}