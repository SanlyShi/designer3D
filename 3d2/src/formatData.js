import fs from "fs"
import path from "path"

import {
  mkdir,
  file2base64
} from "./utils"

function createCacheDir (imgDir, productTypeModelId, colorId, designId, uvName) {
  const modelPath = path.join(imgDir, productTypeModelId)
  const matPath = path.join(modelPath, uvName)
  const colorPath = path.join(matPath, colorId)
  ;[modelPath, matPath, colorPath].forEach(path => mkdir(path))
  return colorPath
}

function getHDRPath (mainPointType) {
  return mainPointType === 'direct'
    ? 'Studio_fan.png'
    : 'Studio.png'
}

async function loadImageToBase64 ({
  uvPaths,
  useCache,
  images,
  enableHDR,
  basePng,
  mainPointType,
  partInfos,
}) {

  function initHdrPromise (enableHDR) {
    return enableHDR == 1
      ? file2base64(path.resolve(__dirname, getHDRPath(mainPointType)))
      : null
  }

  const partPromises = []

  async function getPartImage(name, url) {
    const baseStr = await file2base64(url)
    return {name, baseStr}
  }

  partInfos.forEach(part => {

    const {
      type,
      childMeshName,
      colorMap,
      grandChildParts
    } = part

    if (type == 2) {
      partPromises.push(getPartImage(childMeshName, colorMap))
    }else {
      if (grandChildParts) {
        grandChildParts.forEach(grandChildPart => {
          if (grandChildPart.type == 2) {
            partPromises.push(getPartImage(grandChildPart.name, grandChildPart.colorMap))
          }
        })
      }
    }
  })

  let imagePromises = [
    useCache ? Promise.all(uvPaths.map(i => file2base64(i, {isUv: true}))) : null,
    basePng ? file2base64(basePng) : null,
    initHdrPromise(enableHDR),
    Promise.all(images && images.map(i => file2base64(i.uri)) || []),
    Promise.all(partPromises),
  ]

  return (await Promise.all(imagePromises))
}

async function formatUvList (uvList, baseWidth) {
  const uvPromises = []

  uvList.forEach(uv => {
    let {
      faceList,
      customBase: {
        customBaseType,
        customBaseImg
      }
    } = uv

    if (customBaseType === 2) {
      faceList.unshift({
        width: baseWidth,
        height: baseWidth,
        url: customBaseImg,
        params: {
          scaleX: 1,
          scaleY: 1,
          visible: true
        }
      })
    }

    uvPromises.push(
      Promise.all(
        faceList.map(face => file2base64(face.url))
      )
    )
  })
  const uvBase64s = await Promise.all(uvPromises)
  uvList.forEach((uv, uvIndex) => {
    uv.faceList.forEach((face, faceIndex) => {
      face.url = uvBase64s[uvIndex][faceIndex]
    })
  })
  return uvList
}

async function json3DTransform ({
  materials,
  uvList,
  uvImages,
  baseImage,
  hdrImage,
  modelImages,
}) {

  function getPropInMatName (matName, prop) {
    const propStr = matName
      .split('_')
      .find(i => i.startsWith(prop))
    return propStr
      ? propStr.slice(prop.length)
      : null
  }

  function getRepeat (matName) {
    const repeatValue = getPropInMatName(matName, 'scale')
    return repeatValue
      ? repeatValue.split('&')
      : null
  }

  function addBaseColorTexture (matInfo, pbrMetallicRoughness) {
    const baseColorTexture = pbrMetallicRoughness.baseColorTexture
    if (baseColorTexture) {
      matInfo.map = modelImages[baseColorTexture.index]
      if (
        baseColorTexture.extensions &&
        baseColorTexture.extensions.KHR_texture_transform &&
        baseColorTexture.extensions.KHR_texture_transform.scale
      ) {
        matInfo.repeat = baseColorTexture.extensions.KHR_texture_transform.scale
      }
    }
  }

  function addNormalTexture (matInfo, normalTexture, matName) {
    if (normalTexture) {
      matInfo.normalMap = modelImages[normalTexture.index]
      matInfo.normalScale = normalTexture.scale

      const repeat = getRepeat(matName)
      repeat && (matInfo.normalRepeat = repeat)
    }
  }

  function addUvImages (matInfo, uvImages, matName) {
    if (uvImages) {
      const customMapIndex = uvList.findIndex(i => i.name === matName)
      if (customMapIndex > -1 && uvImages[customMapIndex]) {
        matInfo.map = uvImages[customMapIndex]
      }
    }
  }

  function addBaseImages (matInfo, matName) {
    if (baseImage && matName.includes('base')) {
      matInfo.map = baseImage
    }
  }

  function addMetalImages (matInfo, metalTexture) {
    metalTexture && (matInfo.metalMap = modelImages[metalTexture.index])
  }

  return materials.reduce((acc, cur) => {
    const matName = cur.name

    if (!acc[matName]) {
      acc[matName] = {}
    }
    const matInfo = acc[matName]
    const pbrMetallicRoughness = cur.pbrMetallicRoughness
    const metalTexture = pbrMetallicRoughness.metallicRoughnessTexture

    addBaseColorTexture(matInfo, pbrMetallicRoughness)
    addNormalTexture(matInfo, cur.normalTexture, matName)
    addUvImages(matInfo, uvImages, matName)
    addBaseImages(matInfo, matName)
    addMetalImages(matInfo, metalTexture)

    acc[matName].metalness = pbrMetallicRoughness.metallicFactor
    acc[matName].roughness = pbrMetallicRoughness.roughnessFactor
    return acc
  }, {
    ...hdrImage ? {env: {envMap: hdrImage}} : {},
  })
}

async function formatData ({
  jsonPath,
  designId,
  productTypeModelId,
  colorId,
  imgDir,
  baseWidth
}) {
  const buffer = fs.readFileSync(jsonPath)
  const data = JSON.parse(buffer)
  const {
    spuPartList,
    glbPath,
    enableHDR,
    position,
    uvList,
    basePng,
    json,
    outputPath,
    renderParams: {
      mainPointIntensity, ambientLightIntensity, aroundPointIntensity,
      mainPointPosition,
      mainPointType = 'point',
      newLightModel = false,
      zoom,
      lights,
      allowAlpha,
      rotation
    }
  } = data

  if (!uvList.every(uv => uv.faceList.every(face => face.url))) {
    return false
  }

  const cacheDirs = designId
    ? uvList.map(uv => createCacheDir(imgDir, productTypeModelId, colorId, designId, uv.name))
    : []
  const uvPaths = designId
    ? cacheDirs.map(dirPath => `${path.join(dirPath, `${designId}`)}.png`)
    : []

  const partInfos = formatPartInfos(spuPartList)

  const {
    materials,
    images
  } = json

  const [
    uvImages,
    baseImage,
    hdrImage,
    modelImages,
    partObjs
  ] = await loadImageToBase64({
    uvPaths,
    useCache: designId != 0,
    images,
    enableHDR,
    mainPointType,
    basePng,
    partInfos,
  })

  partInfos.forEach(part => {
    const matchedPart = partObjs.find(i => i.name === part.childMeshName)
    if (matchedPart) {
      part.colorMap = matchedPart.baseStr
    }else {
      partObjs.forEach(obj => {
        if (part.grandChildParts) {
          part.grandChildParts.forEach(part => {
            if (obj.name === part.name) {
              part.colorMap = obj.baseStr
            }
          })
        }
      })
    }
  })

  const matsInfo = await json3DTransform({
    materials,
    uvList,
    uvImages,
    baseImage,
    hdrImage,
    modelImages,
  })

  return {
    partInfos,
    allowAlpha,
    imgDir,
    designId,
    colorId,
    productTypeModelId,
    uvList: await formatUvList(uvList, baseWidth),
    outputPath,
    rotation,
    matsInfo,
    GLTFPath: '',
    GLTFBuffer: await file2base64(glbPath, {notImage: true}),
    newLightModel,
    mainPointLight: {
      position: mainPointPosition,
      intensity: mainPointIntensity,
      type: mainPointType
    },
    ambientLight: {
      intensity: ambientLightIntensity
    },
    aroundPointLight: {
      intensity: aroundPointIntensity
    },
    zoom,
    customLights: lights,
    cameraPosition: position
  }
}

function formatPartInfos (partList) {

  return partList.map(part => {

    const {
      part_name,
      part_detail_name,
      parts: grandParts
    } = part

    const firstGrandPart = grandParts[0]
    const noGrandChildParts = grandParts.length === 1 && !firstGrandPart.part_name

    let grandChildParts = undefined, type = undefined, colorValue = undefined, colorMap = undefined

    if (noGrandChildParts) {
      type = firstGrandPart.type
      colorValue = firstGrandPart.color_code
      colorMap = firstGrandPart.partColorUrl
    } else {
      grandChildParts = grandParts.map(grandPart => ({
        colorValue: grandPart.color_code,
        colorMap: grandPart.partColorUrl,
        type: grandPart.type,
        name: grandPart.part_name
      }))
    }

    return {
      parentMeshName: part_name,
      childMeshName: part_detail_name,
      type,
      colorValue,
      colorMap,
      grandChildParts
    }
  })
}

export default formatData