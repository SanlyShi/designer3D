// const http = require('http')
// const fs = require('fs')
// const PN = process.argv[2]
// const data = JSON.stringify({
//   jsonPath: '/data/www/zwdcservice-sandbox/runtime/product3dDetailPartJs/678/608123acf017f-4007.json',
//   modelId: 'CUP_SC011',
//   productTypeModelId: 'xx',
//   designId: '0',
//   colorId: 'red',
//   imgDir: '',
//   size: 1200,
//   baseWidth: 1200,
//   actualSize: 450
// })
//
// const options = {
//   hostname: 'localhost',
//   path: '/',
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/json',
//     'Content-Length': data.length,
//   },
// }
//
// let total = PN * 20
// let error = 0
// const date = new Date()
//
// const str1 = fs.readFileSync('/tmp/total-new.log', 'utf-8')
// const reg1 = /jsonPath: \S*json/g
// const match1 = str1.match(reg1)
//
// const paths = match1.reduce((acc, cur) => {
//   acc.push(cur.slice(10))
//   return acc
// }, [])
//
// function request(port, count) {
//   if (count === 0) {
//     if (total === 0) {
//       console.log(`
//       ${(new Date() - date) / 1000}s,
//       ${PN * 20 / ((new Date() - date) / 1000)}per sec,
//       ${error / PN * 20 * 100} %
//     `)
//     }
//     return
//   }
//   options.port = port
//   options.jsonPath = paths[PN * 20 + count]
//   const reqDate = new Date()
//   const req = http.request(options, res => {
//     let str = ''
//     res.on('data', data => str += data)
//     res.on('end', () => {
//       console.log('reqTime:', new Date() - reqDate)
//       console.log(total, str)
//       if (str !== 'success') {
//         ++error
//       }
//       --total
//       request(port, --count)
//     })
//   })
//   req.write(data)
//   req.end()
// }
//
// for (let i = 15000; i < (15000 + +PN); i++) {
//   request(i, 20)
// }






const http = require('http')
const PN = 1
const data = JSON.stringify({
  // jsonPath: '/data/www/zwdcservice-sandbox2/runtime/product3dDetailPartJs/100/606d66ff8fdf6-2809.json',
  jsonPath: '/Users/huanghuazhi/Desktop/zwdc3d/3d2/src/data.json',
  modelId: 'CUP_SC011',
  productTypeModelId: 'xx',
  designId: '0',
  colorId: 'red',
  // imgDir: '/Users/huanghuazhi/Desktop/projects/zwdcservice/3d2/static/imgs',
  imgDir: '/data/www/zwdcservice-sandbox2/runtime/imgDir',
  size: 1200,
  baseWidth: 1200,
  actualSize: 300
})

const options = {
  hostname: 'localhost',
  path: '/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
}

let total = PN
let error = 0
const date = new Date()

function request(port, count) {
  if (count === 0) {
    if (total === 0) {
      console.log(`
      ${(new Date() - date) / 1000}s,
      ${PN / ((new Date() - date) / 1000)}per sec,
      ${error / PN * 100} %
    `)
    }
    return
  }
  options.port = port
  const reqDate = new Date()
  const req = http.request(options, res => {
    let str = ''
    res.on('data', data => str += data)
    res.on('end', () => {
      console.log('reqTime:', new Date() - reqDate)
      console.log(total, str)
      if (str !== 'success') {
        ++error
      }
      --total
      request(port, --count)
    })
  })
  req.write(data)
  req.end()
}

for (let i = 12000; i < (12000 + +PN); i++) {
  request(i, 20)
}
