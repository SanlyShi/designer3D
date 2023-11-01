function isDef(val) {
  return ![undefined, null].includes(val)
}

function json3DTransform(json, modelImageData?) {

  function getPropInMatName(matName, prop) {
    const propStr = matName
      .split('_')
      .find(i => i.startsWith(prop))
    return propStr
      ? propStr.slice(prop.length)
      : null
  }

  function getRepeat(matName) {
    const repeatValue = getPropInMatName(matName, 'scale')
    return repeatValue
      ? repeatValue.split('&')
      : null
  }

  function getImg(images, index) {
    return images[index].uri
  }

  const copyJson = JSON.parse(JSON.stringify(json))

  return copyJson.materials.reduce((acc, mat) => {

      const {
        pbrMetallicRoughness,
        normalTexture,
        name
      } = mat

      const {
        baseColorTexture,
        metallicRoughnessTexture: metalTexture,
        metallicFactor,
        roughnessFactor
      } = pbrMetallicRoughness

      if (!acc[name]) {
        acc[name] = {}
      }
      const matInfo = acc[name]
      const images = json.images

      if (name.includes('base')) {
        const repeat = getRepeat(name)
        repeat && (matInfo.repeat = repeat)
      }

      if (baseColorTexture) {
        const {
          index,
          extensions
        } = baseColorTexture
        matInfo.map = getImg(images, index)
        const repeat = extensions?.KHR_texture_transform?.scale
        if (repeat) {
          matInfo.repeat = repeat
        }
      }

      if (normalTexture) {
        matInfo.normalMap = getImg(images, normalTexture.index)
        matInfo.normalScale = normalTexture.scale

        const repeat = getRepeat(name)
        repeat && (matInfo.normalRepeat = repeat)
      }

      if (metalTexture) {
        matInfo.metalMap = getImg(images, metalTexture.index)
      }

      matInfo.metalness = metallicFactor
      matInfo.roughness = roughnessFactor

      return acc
    }, {}
  )
}

function fullColorHex(r, g, b) {
  const red = rgbToHex(r)
  const green = rgbToHex(g)
  const blue = rgbToHex(b)
  return `#${red}${green}${blue}`
}

function rgbToHex(rgb) {
  let hex = Number(rgb).toString(16);
  if (hex.length < 2) {
    hex = "0" + hex
  }
  return hex
}

function findMaterial(type, json) {
  return json.materials
    .filter(i => i.name.includes(type))
    .map(i => i.name)
}

function getHDRPath(type) {
  const basePath = `https://zwstatic.hicustom.com/r_designer_static/static/images/`
  return type === 'direct'
    ? `${basePath}Studio_fan.png`
    : `${basePath}Studio.png`
}

export {
  getHDRPath,
  isDef,
  json3DTransform,
  fullColorHex,
  findMaterial
}