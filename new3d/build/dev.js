const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')
const path = require('path')
const merge = require('webpack-merge')
const webpack = require('webpack')

const baseConfig = require('./base')

module.exports = merge(
  baseConfig,
  {
    entry: './src/main.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'zw_3d.js',
      library: 'zw_3d',
      libraryTarget: 'umd'
    },
    devServer: {
      contentBase: path.join(__dirname, 'dist'),
      host: 'localhost'
    },
    plugins: [
      new webpack.DefinePlugin({
        decoderPath: JSON.stringify('https://www.gstatic.com/draco/v1/decoders/')
      }),
      new HtmlWebpackPlugin({
        template: 'src/index.html'
      }),
      new CopyPlugin([
        {from: 'static'}
      ])
    ]
  }
)