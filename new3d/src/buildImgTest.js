import fs from "fs"

const drawImage = require('./buildImg.js')
const arg = process.argv[2]
const stream = fs.createWriteStream(__dirname + '/total.log', {flags: 'a'})

function write(str) {
  stream.write(str)
}

write(`
        <start---
        date: ${new Date()} 
        jsonPath: ${arg} 
        end--->
      `)

drawImage({
  productTypeModelId: 'xx',
  jsonPath: arg,
  modelId: '0',
  designId: '0',
  colorId: '0',
  imgDir: '/Users/huanghuazhi/Desktop/projects/zwdc/frontend/previewer/static/imgs',
  size: 1200,
  baseWidth: 1200,
  write
})