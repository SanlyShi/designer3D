import fs from "fs"
import sharp from 'sharp'

function toArrayBuffer(buf) {
  const ab = new ArrayBuffer(buf.length)
  const view = new Uint8Array(ab)
  for (let i = 0; i < buf.length; ++i) {
    view[i] = buf[i]
  }
  return ab
}

function base64ToPng(str, path, async) {
  let base64Image = str.split(';base64,').pop()
  if (async) {
    const tempPath = path + new Date() * Math.random()
    return fs.writeFile(tempPath, base64Image, (err) => {
      if (err) {
        throw(err)
      }
      fs.renameSync(tempPath, path)
    })
  }else {
    return fs.writeFileSync(path, base64Image, {encoding: 'base64'})
  }
}

function mkdir(path) {
  try {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path)
    }
  } catch (e) {

  }
}

async function file2base64(path, {isUv, notImage} = {}) {
  if (isUv && !fs.existsSync(path)) {
    return null
  }
  const data = await new Promise(resolve => {
    fs.readFile(path, (err, data) => {
      if (err) throw err
      resolve(data)
    })
  })
  let str = data.toString('base64')
  if (!notImage) {
    str = 'data:image/png;base64, ' + str
  }
  return str
}

function file2RGBA(path) {
  return sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject: true})
}

function rgbToHex (rgb) {
  let hex = Number(rgb).toString(16);
  if (hex.length < 2) {
    hex = "0" + hex
  }
  return hex
}

function fullColorHex (r, g, b) {
  const red = rgbToHex(r)
  const green = rgbToHex(g)
  const blue = rgbToHex(b)
  return `#${red}${green}${blue}`
}

export {
  file2base64,
  mkdir,
  base64ToPng,
  file2RGBA,
  toArrayBuffer,
  fullColorHex,
  rgbToHex
}