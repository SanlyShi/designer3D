const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')
const previewer = fs.readFileSync(path.join(__dirname, "../dist/zw_previewer.js"), 'utf-8')

import {
  rgbToHex,
  base64ToPng
} from './utils'
import formatData from './formatData'

let browser, page

async function initBrowser () {
  const dArgs = puppeteer.defaultArgs()
  dArgs.push('--no-sandbox')
  dArgs.push('--use-gl=egl')
  dArgs.push('--disable-accelerated-2d-canvas')
  browser = await puppeteer.launch({
    ignoreDefaultArgs: true,
    // devtools: true,
    dumpio: true,
    args: dArgs,
  })
}

async function initPage () {
  try {
    page = await browser.newPage()
    await Promise.all([
      // page.setCacheEnabled(false),
      page.exposeFunction('rgbToHex', rgbToHex),
      page.exposeFunction('base64ToPng', base64ToPng),
      page.addScriptTag({content: previewer}),
      page.addScriptTag({
        content: `
          const canvas = document.createElement('canvas')
          document.body.appendChild(canvas)
          const renderer = Zw_previewer.getRenderer(canvas, true)
      `
      })
    ])
  } catch (e) {
    console.log('initPageError: ', e)
    await browser.close()
    process.exit()
  }
}

async function initContext () {
  await initBrowser()
  await initPage()
  return browser.process().pid
}

async function closeBrowser () {
  if (browser && browser.close) {
    console.log(`context normal before close pid: ${process.pid}`)
    await browser.close()
  } else {
    console.log(`context error before close pid: ${process.pid}`)
  }
}

async function evaluate ({
  jsonPath,
  modelId,
  designId,
  productTypeModelId,
  imgDir,
  colorId,
  baseWidth,
  size,
  count
}) {
  const data = await formatData({
    jsonPath,
    modelId,
    colorId,
    designId,
    productTypeModelId,
    imgDir,
    baseWidth
  })

  if (!data) {
    return false
  }

  data.baseWidth = baseWidth
  data.size = size
  data.count = count
  if (browser && !browser.isConnected()) {
    console.log('browser disconnected')
    await closeBrowser()
    await initContext()
  }
  if (page && page.isClosed()) {
    console.log('page closed')
    if (page.close) {
      await page.close()
    }
    await initPage()
  }
  const base64 = await page.evaluate(async (previewer, data) => {
    let {
      colorId,
      productTypeModelId,
      designId,
      imgDir,
      baseWidth,
      uvList,
      rotation,
      matsInfo,
      GLTFBuffer,
      newLightModel,
      mainPointLight: {
        position: mainPointPosition,
        intensity: mainPointIntensity
      },
      ambientLight: {
        intensity: ambientLightIntensity
      },
      aroundPointLight: {
        intensity: aroundPointIntensity
      },
      zoom,
      customLights,
      cameraPosition,
      allowAlpha,
      size,
      partInfos
    } = data

    canvas.width = canvas.height = size

    function createImgPromise (url) {
      const img = new Image()
      img.width = img.height = baseWidth
      img.src = url

      return new Promise(resolve => {
        img.addEventListener(
          'load',
          async () => resolve(img)
        )
      })
    }

    function toAB (base64Data) {
      let isBrowser = typeof window !== 'undefined' && typeof window.atob === 'function'
      let binary = isBrowser ? window.atob(base64Data) : Buffer.from(base64Data, 'base64').toString('binary')
      let bytes = new Uint8Array(binary.length)

      for (let i = 0; i < binary.length; ++i) {
        bytes[i] = binary.charCodeAt(i)
      }
      return bytes.buffer
    }

    async function createUvPromises () {
      const uvImagesPromises = []
      uvList.forEach(uv => {
        const imagesPromises = uv.faceList.map(face => createImgPromise(face.url))
        uvImagesPromises.push(Promise.all(imagesPromises))
      })
      const uvImages = await Promise.all(uvImagesPromises)
      uvList.forEach((uv, uvIndex) => {
        uv.faceList.forEach((face, faceIndex) => {
          face.imgEle = uvImages[uvIndex][faceIndex]
        })
      })
    }

    const uvTime = new Date()
    await createUvPromises()

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

    uvList.forEach(uv => {
      const {
        faceList,
        customBase: {
          customBaseType,
          customBaseCode
        },
        name
      } = uv
      if (matsInfo[name].map) {
        return
      }

      const blurScale = faceList.reduce((acc, face) => {

        let {print_area} = face
        if (!print_area) {
          return 1
        }

        const {
          width: printAreaWidth,
          height: printAreaHeight
        } = print_area
        let scale = Math.min(printAreaHeight / baseWidth, printAreaWidth / baseWidth)
        if (scale <= 0.3) {
          return 1.4
        } else {
          return acc
        }
      }, 1)
      const size = baseWidth * blurScale

      const canvas = document.createElement('canvas')
      const uvCtx = canvas.getContext('2d')
      canvas.width = canvas.height = size
      uvCtx.clearRect(0, 0, size, size)
      const fillColor = allowAlpha == 1 ? 'rgba(0,0,0,0)' : '#fff'
      uvCtx.fillStyle = customBaseType === 1 ? fullColorHex(...customBaseCode) : fillColor
      uvCtx.fillRect(0, 0, size, size);
      uvCtx.globalCompositeOperation = "source-over"

      faceList.forEach(face => {
        let {
          params: {
            scaleX,
            scaleY,
            flipX,
            flipY,
            angle,
            centerX,
            centerY
          },
          width,
          height,
          imgEle
        } = face

        const {
          round,
          PI
        } = Math

        width = width * scaleX * blurScale
        height = height * scaleY * blurScale

        flipX = flipX ? -1 : 1
        flipY = flipY ? -1 : 1

        angle = angle * PI / 180

        uvCtx.save()
        uvCtx.scale(flipX, flipY)
        uvCtx.rotate(angle * flipX * flipY)
        if (centerX !== undefined && centerY !== undefined) {
          uvCtx.translate(round(centerX) * blurScale, round(centerY) * blurScale)
          uvCtx.translate(-width / 2, -height / 2)
        }
        uvCtx.drawImage(imgEle, 0, 0, width, height)
        uvCtx.setTransform(1, 0, 0, 1, 0, 0)
        uvCtx.restore()
      })

      const base64 = canvas.toDataURL()
      matsInfo[name].map = base64
      if (designId != 0) {
        base64ToPng(base64, `${imgDir}/${productTypeModelId}/${name}/${colorId}/${designId}.png`, false)
      }
    })
    window.console.log('uvTime: ', new Date() - uvTime, 'ms')

    let p = new Zw_previewer.Previewer({
      renderer,
      partInfos,
      width: size,
      height: size,
      stopAnimate: true,
      GLTFBuffer: toAB(GLTFBuffer),
      lightLock: true,
      matsInfo,
      rotation,
      newLightModel,
      mainPointLight: {
        intensity: mainPointIntensity,
        position: mainPointPosition
      },
      zoom,
      ambientLight: {
        intensity: ambientLightIntensity
      },
      aroundPointLight: {
        intensity: aroundPointIntensity
      },
      customLights,
      cameraPosition
    })
    await p.init()
    let base64Str = p.getImg()
    p.destroy()
    return base64Str
  }, previewer, data)

  if (!base64) {
    return false
  } else {
    base64ToPng(base64, data.outputPath)
    return true
  }
}

export {
  initContext, closeBrowser, evaluate
}



