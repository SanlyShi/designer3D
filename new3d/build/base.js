module.exports = {
  mode: process.env.NODE_ENV,
  // optimization: {
  //   minimize: false
  // },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.png$/,
        use: 'url-loader'
      }
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  }
}