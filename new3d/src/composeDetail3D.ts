import {Model, loadDecoder} from "./p"
import {
  findMaterial,
  getHDRPath,
  json3DTransform,
  fullColorHex
} from './utils'
import axios from 'axios'

function formatFaces(uv, faces) {
  return uv.faceList.reduce((acc, face) => {
    if (!faces[face.view_id] || !face.params.visible) {
      return acc
    }
    face.url = faces[face.view_id]
    acc.push(face)
    return acc
  }, [])
}

async function createMatMaps(detail3D, baseWidth, faces) {
  const {
    uvList,
    renderParams: {allowAlpha},
  } = detail3D

  const maps = await Promise.all(uvList.map(async uv => {
    if (uv.notChanged) {
      return false
    }
    let maps
    if (faces) {
      maps = formatFaces(uv, faces)
    } else {
      maps = await Promise.all(uv.faceList.map(face => {
        return new Promise(resolve => {
          const img = new Image()
          img.width = img.height = baseWidth
          img.setAttribute('crossOrigin', 'anonymous')
          img.src = face.url
          img.onload = () => {
            face.url = img
            resolve(face)
          }
        })
      }))
    }
    return await createColorMap(maps, uv.customBase, allowAlpha, baseWidth)
  }))
  return uvList.map((i, index) => ({
    name: i.name,
    map: maps[index]
  }))
}

async function createColorMap(faceList, customBase, allowAlpha, baseWidth) {
  const uvCanvas = document.createElement('canvas')
  const {designColorType, designColorCode, designColorUrl} = customBase

  if (designColorType === 2 && designColorUrl) {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = designColorUrl
    let baseImg = await new Promise(resolve => img.onload = () => resolve(img))
    faceList.unshift({
      width: baseWidth,
      height: baseWidth,
      url: baseImg,
      params: {
        scaleX: 1,
        scaleY: 1,
        visible: true
      }
    })
  }

  let maxScale = faceList.reduce((acc, cur) => {
    let scale
    if (cur.url.tagName && cur.url.tagName === 'CANVAS') {
      scale = Math.max(
        1 / cur.params.scaleX,
          parseInt(cur.url.width) / baseWidth
        )
    }else {
      scale = 1 / cur.params.scaleX
    }
    return scale > acc ? scale : acc
  }, 1)

  const size = baseWidth * maxScale

  uvCanvas.width = uvCanvas.height = size
  const uvCtx = uvCanvas.getContext('2d')

  uvCtx.clearRect(0, 0, size, size)
  // @ts-ignore
  if (designColorType === 1) {
    // @ts-ignore
    uvCtx.fillStyle = fullColorHex(...designColorCode)
  } else {
    if (allowAlpha != 1) {
      uvCtx.fillStyle = '#fff'
    } else {
      uvCtx.fillStyle = 'rgba(0,0,0,0)'
    }
  }
  uvCtx.fillRect(0, 0, size, size);
  uvCtx.globalCompositeOperation = "source-over";

  faceList.forEach((imgObj) => {
    const {params} = imgObj
    const width = imgObj.width * params.scaleX * maxScale;
    const height = imgObj.height * params.scaleX * maxScale;

    const flipX = params.flipX ? -1 : 1;
    const flipY = params.flipY ? -1 : 1;

    const angle = params.angle * Math.PI / 180;
    const centerX = params.centerX;
    const centerY = params.centerY;

    uvCtx.save();
    uvCtx.scale(flipX, flipY);
    uvCtx.rotate(angle * flipX * flipY);
    if (centerX !== undefined && centerY !== undefined) {
      uvCtx.translate(Math.round(centerX * maxScale), Math.round(centerY * maxScale))
      uvCtx.translate(-width / 2, -height / 2)
    }
    uvCtx.drawImage(imgObj.url, 0, 0, width, height)
    uvCtx.setTransform(1, 0, 0, 1, 0, 0);
    uvCtx.restore();
  })
  return uvCanvas
}

function getCenter({p1, p2, p3, p4}, baseWidth) {
  const convertArr = ([a, b]) => {
    const factor = baseWidth / 1200
    return [a / factor, b / factor]
  }

  p1 = convertArr(p1.split(','));
  p2 = convertArr(p2.split(','));
  p3 = convertArr(p3.split(','));
  p4 = convertArr(p4.split(','));
  const minX = Math.min(p1[0], p2[0], p3[0], p4[0])
  const minY = Math.min(p1[1], p2[1], p3[1], p4[1])
  const maxX = Math.max(p1[0], p2[0], p3[0], p4[0])
  const maxY = Math.max(p1[1], p2[1], p3[1], p4[1])
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  return {
    centerX,
    centerY
  }
}

let decoderLoaded = false

class composeDetail3D {
  canvas
  _ctx
  modelPreviewers
  modelImgMaps
  baseMats
  destroyed
  mapQueue
  modelOptions
  faceListMap
  mapLength
  callback
  canvasSize
  modelControlDomId
  baseWidth
  maps
  container
  isFlushing
  ratio
  renderImgScale
  type
  partPosition
  disableTransformAnimate
  partIds: {
    partId: number,
    childPartId: number,
    colorId: number,
  }[]

  constructor(options) {
    this.canvas = document.createElement('canvas')
    this._ctx = this.canvas.getContext('2d')
    this.modelPreviewers = []

    this.modelImgMaps = []
    this.renderImgScale = 2
    this.canvasSize = 600 * this.renderImgScale

    this.baseMats = []
    this.destroyed = false
    this.mapQueue = [];
    this.type = options.type
    this.modelControlDomId = options.modelControlDomId
    this.partIds = options.partIds || []
    this.modelOptions = options.modelOptions
    this.partPosition = options.partPosition
    this.disableTransformAnimate = options.disableTransformAnimate
    this.faceListMap = options.faceListMap
    this.mapLength = options.modelOptions.length
    this.callback = options.callBack
    this.baseWidth = options.baseWidth
    this.canvas.height = this.canvas.width = this.canvasSize
    this.container = options.container
    this.isFlushing = true
    if (!decoderLoaded) {
      loadDecoder()
      decoderLoaded = true
    }
    if (this.modelOptions.find(i => !i.detail3D)) return
    this.startDraw()
  }

  async updateFaceListMap(faceListMap, callback) {
    if (
      this.destroyed
      || this.modelOptions.find(i => !i.detail3D)
    ) return
    this.mapQueue.push({
      baseMaps: this.modelOptions.map(i => i.detail3D.textureMap),
      faceListMap,
      callback,
      modelOptions: this.modelOptions
    })

    if (
      (this.type === 5) &&
      this.isFlushing
    ) {
      return
    }

    this.flushQueue()
  }

  setUvUpdateState(modelOption, faceListMap) {
    const {uvList} = modelOption.detail3D
    uvList.forEach(uv => {
      const {faceList} = uv
      if (this.type === 1) {
        uv.notChanged = false
      } else {
        uv.notChanged = !faceList.find(face => faceListMap[face.view_id]);
      }
    })
  }

  async flushQueue() {
    if (!this.mapQueue.length) return

    const firstQueue = this.mapQueue.shift()
    const {
      faceListMap,
      callback,
      modelOptions
    } = firstQueue

    modelOptions.forEach(modelOption => {
      this.setUvUpdateState(modelOption, faceListMap)
    })

    this.callback = callback
    this.mapLength = modelOptions.reduce((total, modelOption) => {
      const {uvList} = modelOption.detail3D

      if (uvList.find(uv => {
        const {faceList} = uv
        return faceList.find(face => faceListMap[face.view_id])
      })) {
        total++
      }
      return total
    }, 0)

    firstQueue.maps = await Promise.all(
      modelOptions.map(modelOption => {
        this.setUvUpdateState(modelOption, faceListMap)
        return createMatMaps(modelOption.detail3D, this.baseWidth, faceListMap)
      })
    )
    if (this.destroyed) return
    this._createModelImgMap(firstQueue)
  }

  async startDraw() {
    this.maps = await Promise.all(
      this.modelOptions.map(modelOption => {
        this.setUvUpdateState(modelOption, this.faceListMap)
        return createMatMaps(modelOption.detail3D, this.baseWidth, this.faceListMap)
      })
    )
    this.modelOptions.map((modelOption, index) => {
      return this._createModelPreview(modelOption, index)
        .then(MPer => this.modelPreviewers[index] = MPer);
    })
  }

  _createModelPreview(modelOption, index) {
    let {
      detail3D: {
        width,
        height,
        angle,
        baseFiles,
        textureMap,
        renderParams: {
          lightLock,
          mainPointIntensity,
          mainPointPosition,
          aroundPointIntensity,
          ambientLightIntensity,
          lights,
          zoom,
          mainPointType,
          newLightModel,
          rotation,
          useSourceModel,
        },
        position,
        enable_hdr
      },
      distortParams,
    } = modelOption;
    const canvas = document.createElement('canvas');

    if ([4, 5, 6].includes(this.type)) {
      canvas.width = width * this.renderImgScale;
      canvas.height = height * this.renderImgScale;
    }

    if ([1, 2].includes(this.type)) {
      const size = +getComputedStyle(this.container).width.slice(0, -2)
      canvas.width = size
      canvas.height = size
    }

    if (this.type === 3) {
      const size = +getComputedStyle(this.container).width.slice(0, -2)
      const {centerX, centerY} = getCenter(distortParams, this.baseWidth)
      canvas.width = width
      canvas.height = height

      this.ratio = size / 600
      canvas.style.left = `${(centerX - width / 2) * this.ratio}px`
      canvas.style.top = `${(centerY - height / 2) * this.ratio}px`
      canvas.style.transform = `rotate(${angle}deg)`
    }

    if ([1, 2, 3].includes(this.type)) {
      canvas.style.position = 'absolute'
      this.container.appendChild(canvas)
    }

    const glbPath = baseFiles
      .find(i => i.file_url.endsWith('glb') && (
        useSourceModel
          ? i.file_name.includes('source')
          : (!i.file_name.includes('source'))
      ))
      .file_url
    const jsonPath = baseFiles.find(i => i.file_url.endsWith('json')).file_url

    const getJson = (jsonPath) => {
      return new Promise(resolve => {
        axios
          .get(jsonPath)
          .then(data => {
            if (this.destroyed) return

            data = data.data
            // @ts-ignore
            data.images
            // @ts-ignore
            && (data.images = data.images.map(image => ({
              uri: baseFiles.find(file => image.name === file.file_name).file_url
            })))
            resolve(data)
          })
      })
    }

    return new Promise(resolve => {
      getJson(jsonPath).then(json => {
        if (this.destroyed) return

        const baseMaterial = this.baseMats[index] = findMaterial('base', json)
        const matsInfo = json3DTransform(json)

        baseMaterial.forEach(mat => {
          if (!matsInfo[mat]) {
            matsInfo[mat] = {}
          }
          matsInfo[mat].map = textureMap
        })

        enable_hdr == 1 && (matsInfo.env = {envMap: getHDRPath(mainPointType)})
        this.maps[index] && this.maps[index].forEach(i => {
          const {name, map} = i
          if (!matsInfo[name]) {
            matsInfo[name] = {}
          }
          matsInfo[name].map = map
        })

        let options = {
          el: canvas,
          enableControl: [1, 2].includes(this.type),
          GLTFPath: glbPath,
          customLights: lights,
          modelControlDomId: this.modelControlDomId,
          rotation,
          zoom,
          lightLock,
          onRendered: [4, 6].includes(this.type)
            ? img => this.callback(img.toDataURL())
            : this.type === 5
              ? img => {
                if (this.destroyed) return
                this.modelImgMaps[index] = img
                if (--this.mapLength === 0) {
                  this._drawImg();
                  this.isFlushing = false;
                  this.flushQueue();
                }
              }
              : (img) => this.callback && this.callback(img),
          matsInfo,
          newLightModel,
          mainPointLight: {
            type: mainPointType,
            intensity: mainPointIntensity,
            position: mainPointPosition && mainPointPosition || undefined
          },
          aroundPointLight: {
            intensity: aroundPointIntensity
          },
          ambientLight: {
            intensity: ambientLightIntensity
          },
          cameraPosition: this.partPosition || position || undefined,
          partInfos: [],
          disableTransformAnimate: this.disableTransformAnimate
        }

        this.partIds.forEach(idObj => {
          const {
            partId,
            childPartId,
            colorId,
          } = idObj
          const partInfo = this.getPartInfo(modelOption, partId, childPartId, colorId)
          if (partInfo) {
            options.partInfos.push(partInfo)
          }
        })

        let previewer = new Model(options)
        previewer.init()
        if (this.type === 3) {
          canvas.style.height = `${height * this.ratio}px`
          canvas.style.width = `${width * this.ratio}px`
        }
        resolve(previewer)
      })
    })
  }

  _createModelImgMap(queueObj) {
    const {
      baseMats,
      modelPreviewers
    } = this

    queueObj.maps
      .forEach((mats, index) => {
        mats.forEach(i => {
          const {name, map} = i
          if (map && modelPreviewers[index]) {
            modelPreviewers[index].updateMap(map, name)
          }
        })
      })

    queueObj.baseMaps.forEach((baseMap, index) => {
      if (baseMap) {
        baseMats[index].forEach(mat => {
          modelPreviewers[index].updateMap(baseMap, mat)
        })
      }
    })
  }

  _drawImg() {
    const {
      modelImgMaps,
      callback,
      canvasSize,
      _ctx,
      canvas,
      baseWidth,
    } = this;

    if (this.modelOptions.length > 0) {
      this.modelOptions.forEach((ele, index) => {
        const img = modelImgMaps[index];
        let {detail3D: {width, height, angle}, distortParams} = ele
        const {centerX, centerY} = getCenter(distortParams, baseWidth)
        angle = angle * Math.PI / 180;

        _ctx.save();

        _ctx.translate(centerX * this.renderImgScale, centerY * this.renderImgScale);
        _ctx.rotate(angle);
        _ctx.translate(-width * this.renderImgScale / 2, -height * this.renderImgScale / 2);
        // putImageData(_ctx, img, 0, 0)
        _ctx.drawImage(img, 0, 0, width * this.renderImgScale, height * this.renderImgScale);

        _ctx.setTransform(1, 0, 0, 1, 0, 0)
        _ctx.restore();
      });
    }
    callback && callback(canvas.toDataURL('img/png'))
    this._ctx.clearRect(0, 0, canvasSize, canvasSize)
  }

  destroy() {
    this.destroyed = true
    if (this.modelPreviewers && this.modelPreviewers.length > 0) {
      this.modelPreviewers.forEach(MPer => MPer.destroy())
    }
    if (this.container) {
      let child = this.container.lastElementChild;
      while (child) {
        this.container.removeChild(child);
        child = this.container.lastElementChild;
      }
    }
    this.maps = null
    this.faceListMap = null
    this.modelPreviewers = null
    this._ctx = null
  }

  resize(width, height) {
    if (this.modelPreviewers && this.modelPreviewers.length > 0) {
      this.modelPreviewers.forEach(MPer => MPer.resize(width, height))
    }
  }

  setCameraPosition({x = 0, y = 0, z = 0, needRender = true} = {}) {
    if (this.destroyed) return
    this.modelPreviewers[0].setCameraPosition({x, y, z, needRender})
  }

  setActive(bool) {
    if (this.modelPreviewers && this.modelPreviewers.length > 0) {
      this.modelPreviewers[0].control.enabled = bool
    }
  }

  getImg(size) {
    if (this.destroyed) return

    if (this.type == 2) {
      const containerSize = +getComputedStyle(this.container).width.slice(0, -2)
      const img = this.modelPreviewers[0].resize(size, size).getImg().toDataURL()
      this.modelPreviewers[0].resize(containerSize, containerSize)
      return img
    }

    return this.modelPreviewers[0].getImg().toDataURL()
  }

  getPosition() {
    if (this.destroyed) return
    return this.modelPreviewers[0].getCameraPosition()
  }

  getRotate() {
    if (this.destroyed) return
    return this.modelPreviewers[0].getModelRotate()
  }

  getMainLightPos() {
    if (this.destroyed) return
    return this.modelPreviewers[0].mainPointLight.position
  }

  getPartInfo(modelOption, partId, childPartId, colorId): {
    parentMeshName: string,
    childMeshName: string,
    type: number,
    colorValue: string,
    colorMap: string,
    grandChildParts: {
      colorValue: string,
      colorMap: string,
      type: number
    }[] | undefined
  } | void {
    const detail3d = modelOption.detail3D
    if (!detail3d || !detail3d.parts) return
    const part = detail3d.parts.find(i => i.part_id === partId)
    if (!part) {
      console.log('模型未匹配到部件')
      return
    }

    const {
      spu_part_name,
      detail_parts
    } = part

    const childPart = detail_parts.find(i => i.part_detail_id === childPartId)
    if (!childPart) {
      console.log('模型未匹配到部件')
      return
    }
    const childMeshName = childPart.spu_part_detail_name
    const defaultColorPart = childPart.colors.find(i => i.color_id == 0).parts
    let grandChildParts = childPart.colors.find(i => i.color_id === colorId).parts

    const firstPart = grandChildParts[0]
    const noGrandChildParts = grandChildParts.length === 1 && !firstPart.part_name

    let type = undefined, colorValue = undefined, colorMap = undefined

    if (noGrandChildParts) {
      grandChildParts = false
      type = firstPart.type
      colorValue = firstPart.color_code
      colorMap = firstPart.part_color_file
    } else {
      grandChildParts = grandChildParts.map(color => ({
        colorValue: color.color_code || defaultColorPart.color_code,
        colorMap: color.part_color_file || defaultColorPart.part_color_file,
        type: color.type,
        name: color.part_name
      }))
    }

    return {
      parentMeshName: spu_part_name,
      childMeshName,
      type,
      colorValue,
      colorMap,
      grandChildParts
    }
  }

  updatePart(partId: number, childPartId: number, colorId: number, cb: () => {}): void {
    this.modelPreviewers.forEach((model, index) => {
      const partInfo = this.getPartInfo(this.modelOptions[index], partId, childPartId, colorId)
      if (partInfo) {
        model.updatePart(partInfo)
        this.modelImgMaps[index] = model.getImg()
      }
    })

    if ([4, 5, 6].includes(this.type)) {
      this.callback = cb
      this._drawImg()
    }
  }

  updateAngle(viewId: number, angleParam: any, partId: number, childPartId: number): void {
    let materialName = ''
    let getMaterialNameFromViewId = (viewIdMap) => {
      this.modelOptions.map(item => {
        item.detail3D.uvList.map(itemDetail => {
          itemDetail.faceList.map(detail => {
            if (viewIdMap == detail.id) {
              materialName = itemDetail.name
            }
          })
        })
      })
    }
    angleParam = JSON.parse(angleParam)
    angleParam.x = parseFloat(angleParam.x)
    angleParam.y = parseFloat(angleParam.y)
    angleParam.z = parseFloat(angleParam.z)


    if (!partId) {
      getMaterialNameFromViewId(viewId)
      this.modelPreviewers.forEach((model, index) => {
        model.setSelectObject(materialName, angleParam)
      })
    } else {
      this.modelPreviewers.forEach((model, index) => {
        model.setSelectObject(materialName, angleParam, partId, childPartId)
      })
    }
  }
}

async function preloadModelData(detail3d) {

  if (!detail3d) return

  const {
    baseFiles,
    textureMap
  } = detail3d

  const glbPath = baseFiles
    .find(i => i.file_url.endsWith('glb') && !i.file_name.includes('source'))
    .file_url
  const jsonPath = baseFiles.find(i => i.file_url.endsWith('json')).file_url

  let data = await axios.get(jsonPath)
  data = data.data
  let imagePromises
  // @ts-ignore
  if (data.images) {
    // @ts-ignore
    imagePromises = data.images.map(image => {
      return axios.get(baseFiles.find(file => image.name === file.file_name).file_url)
    })
  }

  await Promise.all([
    axios.get(glbPath),
    textureMap && axios.get(textureMap),
    imagePromises
  ])
}

export {
  composeDetail3D,
  createMatMaps,
  preloadModelData
}



