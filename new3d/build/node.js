const {CleanWebpackPlugin} = require('clean-webpack-plugin')
const merge = require('webpack-merge')
const path = require('path')
const baseConfig = require('./base')

module.exports = merge(
  baseConfig,
  {
    entry: './src/server.ts',
    output: {
      filename: 'server.js',
      path: path.resolve(__dirname, '../dist'),
    },
    node: {
      __dirname: true
    },
    target: 'node',
    externals: [
      {
        puppeteer: 'commonjs puppeteer',
        sharp: 'commonjs sharp',
        jsdom: 'commonjs jsdom',
        gl: 'commonjs gl',
      },
      (context, request, callback) => {
        if (/^three\/.+$/.test(request)) {
          return callback(null, 'commonjs ' + request);
        }
        callback();
      }
    ],
    plugins: [
      new CleanWebpackPlugin(),
    ]
  }
)