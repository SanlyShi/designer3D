const fs = require("fs")
const path = require('path')
const {CleanWebpackPlugin} = require('clean-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')
const merge = require("webpack-merge")
const webpack = require('webpack')

const env = process.env.NODE_ENV
const isProd = env === 'production'
const isDev = env === 'development'
const isFe = process.argv[4] === '--fe'

const envConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'env.json')))
const fileNameReg = /zw_previewer\S*.js/

class OutputPlugin {
  apply(compiler) {
    compiler.hooks.assetEmitted.tap(
      'OutputPlugin',
      fileName => {
        function processFile(path) {
          let str = fs.readFileSync(path, 'utf-8')
          str = str.replace(fileNameReg, fileName)
          fs.writeFileSync(path, str)
        }

        envConfig.feFiles.forEach(file => processFile(file))
      }
    )
  }
}

const baseConfig = {
  entry: './src/previewer.ts',
  // optimization: {
  //   minimize: false
  // },
  mode: env,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader'
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: 'zw_previewer.js',
    library: 'Zw_previewer',
    libraryTarget: 'window',
    // path: path.resolve(__dirname, isProd && !isFe ? 'dist' : envConfig.buildPath),
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new webpack.DefinePlugin({
      decoderPath: JSON.stringify(isProd
        ? '/static/admin/plugin/three/draco/'
        : 'https://www.gstatic.com/draco/v1/decoders/')
    }),
    new webpack.DefinePlugin({
      inNode: JSON.stringify(!isFe)
    })

  ]
}

const devConfig = {
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    host: 'localhost'
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/index.html'
    }),
    new CopyPlugin([
      {from: 'static'}
    ])
  ]
}

const prodConfig = {
  plugins: [
    new CleanWebpackPlugin(),
    new OutputPlugin()
  ]
}

module.exports = merge(
  baseConfig,
  isProd ? prodConfig : devConfig
)