const path = require('path')
const merge = require('webpack-merge')
const {CleanWebpackPlugin} = require('clean-webpack-plugin')
const fs = require('fs')

const baseConfig = require('./base')
const version = JSON.parse(fs.readFileSync("package.json", "utf-8")).version

const envConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'env.json')))
const fileNameReg = /zw3d\S*.js/

const feFiles = [
  // "view/admin/productType3DModel/edit.php",
  // "view/admin/productTypeDetail/detail3D.php",
  // "view/frontend/create/index.php",
  // "view/merchant/batchDesign/index.php",
  // "public/shopifySDK/shopifyOpWapSdk.php",
  // "public/shopifySDK/shopifyOpSdk.php",
  // "view/admin/productType3DModel/commonEdit.php",
  // "view/wap/productType/design.php",
  // "view/merchant/productType/combineProductType.php",
  // "view/admin/productType3DModel/index.php",
  // "view/merchant/customerCombineProduct/index.php",
  //模板合图涉及到的页面start
  "view/frontend/galleryNew/index.php",
  "view/frontend/galleryTemplate/edit.php",
  "view/frontend/galleryTemplate/index.php",
  "view/frontend/productType/detail.php",
  "view/frontend/productType/list.php",
  "view/frontend/productType/search.php",
  "view/merchant/productType/edit.php",
  "view/merchant/productType/index.php",
  "view/merchant/productType/productTypeCategory.php",
  "view/merchant/productType/subAccount.php",
  "view/wap/productType/detail.php",
  //模板合图涉及到的页面end
]

class OutputPlugin {
  apply (compiler) {
    compiler.hooks.assetEmitted.tap(
      'OutputPlugin',
      fileName => {
        function processFile (path) {
          let str = fs.readFileSync(path, 'utf-8')
          str = str.replace(fileNameReg, fileName)
          fs.writeFileSync(path, str)
        }

        feFiles.forEach(file => processFile(path.join(envConfig.zwdcPath, file)))
      }
    )
  }
}

function getConfig() {
  const addTag = process.argv[4] === '--tag'

  if (addTag) {
    return {
      entry: './src/main.ts',
      output: {
        path: path.join(envConfig.zwdcPath, 'public/static/admin/dist'),
        filename: `zw3d@${version}.js`
      },
      plugins: [
        new OutputPlugin(),
      ]
    }
  }else {
    return {
      optimization: {
        minimize: false
      },
      output: {
        path: path.resolve(__dirname, '../', 'lib'),
        filename: '[name].js'
      },
      entry: {
        zw3d: './src/main.ts',
        zwDesign: './src/designerMain.ts'
      },
      plugins: [
        new CleanWebpackPlugin()
      ]
    }
  }
}

module.exports = merge(
  baseConfig,
  {
    entry: './src/main.ts',
    output: {
      library: 'Zw3d',
      libraryTarget: 'umd'
    }
  },
  getConfig()
)