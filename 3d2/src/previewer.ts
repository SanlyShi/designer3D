import {
  TextureLoader, PMREMGenerator,
  Scene, PerspectiveCamera, WebGLRenderer,
  AmbientLight, PointLight, DirectionalLight,
  Vector2, Matrix3, Texture, Material, Euler,
  Color,
  RepeatWrapping, ShaderChunk, LinearFilter,
  sRGBEncoding, RGBAFormat
} from "three/build/three.module"
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader'

function notNullOrUndef(val) {
  return ![undefined, null].includes(val)
}

function getRenderer(el, transparentBackground) {
  return new WebGLRenderer({
    canvas: el,
    antialias: true,
    alpha: transparentBackground
  })
}

const gltfLoader = new GLTFLoader()
const textureLoader = new TextureLoader()

enum mapType {
  map = 'map',
  normalMap = 'normalMap',
}

interface position {
  x: number,
  y: number,
  z: number
}

interface lightParams {
  type?: 'point' | 'direct'
  position?: position,
  color?: string,
  intensity?: number,
  distance?: number,
  closed?: boolean,
  decay?: number
}

interface PreviewerInterface {
  updateMap(path: string, material: string | Material, mutable?: boolean): void

  getImg(): string

  updateLightIntensity({main, ambient, around}): void

  addLight(light: lightParams, target?): void

  updateCustomLight(index, params: lightParams): void

  removeLight(index): void

  resize(width, height): void

  destroy(destroyRenderer: boolean): void

  updateZoom(zoom): void
}

class Previewer implements PreviewerInterface {
  private isAroundLightEmpty: boolean = true
  private preloadTextures: {
    [matName: string]: {
      map?, normalMap?, metalMap?, envMap?
    }
  } = {}
  private animateID: number
  private scene: Scene
  private object
  private aroundPointLights: PointLight[] = []
  private ambientLight: AmbientLight
  private renderer: WebGLRenderer
  private envMap: string | Texture
  private width: number
  private height: number
  private rotation?: { x, y, z }
  private partInfos
  private GLTFBuffer?: string
  private GLTFPath?: string
  readonly aroundPointLight?: lightParams
  private cameraPosition?: position
  private transparentBackground?: boolean
  private zoom?: number
  private matsInfo?: {
    [matName: string]: {
      map?,
      normalMap?,
      metalMap?,
      normalScale?,
      normalRepeat?,
      repeat?,
      metalness: number,
      roughness: number
    }
  }
  public control
  public onRendered: (img) => void
  public mainPointLight: PointLight
  public newLightModel: boolean
  public customLights: PointLight[] = []
  public lightLock: boolean
  public camera: PerspectiveCamera

  constructor({
                width,
                height,
                renderer,
                rotation,
                GLTFBuffer,
                newLightModel = false,
                mainPointLight = {
                  position: {x: 32, y: 23, z: 0},
                  intensity: 4,
                  color: '#fff'
                },
                ambientLight = {
                  intensity: 0,
                  color: '#fff'
                },
                aroundPointLight = {
                  intensity: 0,
                  color: '#fff'
                },
                customLights = [],
                cameraPosition = {x: 32, y: 23, z: -4,},
                lightLock = false,
                transparentBackground = false,
                matsInfo = {},
                zoom = 1,
                partInfos
              }
  ) {
    this.partInfos = partInfos
    this.width = width
    this.height = height
    this.renderer = renderer
    this.rotation = rotation
    this.GLTFBuffer = GLTFBuffer
    this.mainPointLight = mainPointLight
    this.newLightModel = newLightModel
    this.ambientLight = ambientLight
    this.aroundPointLight = aroundPointLight
    this.cameraPosition = cameraPosition
    this.customLights = customLights
    this.transparentBackground = transparentBackground
    this.matsInfo = matsInfo
    this.zoom = zoom
    this.lightLock = lightLock
  }

  public async init() {
    const {
      cameraPosition,
      transparentBackground,
      GLTFPath,
      GLTFBuffer,
      zoom,
      width,
      height,
      renderer,
    } = this
    renderer.outputEncoding = sRGBEncoding
    transparentBackground && renderer.setClearColor(0x000000, 0)
    renderer.setSize(width, height)
    const scene = this.scene = new Scene()
    const camera = this.camera = new PerspectiveCamera(45, width / height, 0.1, 10000)

    zoom && this.updateZoom(zoom)
    this.setCameraPosition(cameraPosition)
    scene.add(camera)

    this.initLights()
    await this.preloadTexture()
    await this.updateMeshGroup(GLTFPath, GLTFBuffer)
  }

  private async loadTexture(fileInfo) {
    return await new Promise(resolve => {
      textureLoader.load(fileInfo, resolve)
    })
  }

  public updateMap(map, material, mutable?) {
    if (material.map) {
      material.map && material.map.dispose()
      material.map = null
    }
    if (!map) return
    map.encoding = sRGBEncoding
    map.minFilter = LinearFilter
    const matName = material.name
    map.wrapS = map.wrapT = RepeatWrapping
    map.flipY = !!['custom', 'base'].find(i => matName.includes(i)) || mutable
    material.needsUpdate = true
    material.map = map
  }

  private async preloadTexture() {
    const {matsInfo, partInfos} = this

    const initTexture = async (
      {meshName, matName, type, fileInfo}: { meshName?, matName?, type?, fileInfo }
    ) => {
      const map = await this.loadTexture(fileInfo)
      return {
        meshName,
        matName,
        type,
        map
      }
    }

    const texturePromises = [...Object.entries(matsInfo).reduce((acc, cur) => {
      const [matName, mapInfo] = cur
      mapInfo.map && acc.push(initTexture({matName, type: 'map', fileInfo: mapInfo.map}))
      mapInfo.normalMap && acc.push(initTexture({matName, type: 'normalMap', fileInfo: mapInfo.normalMap}))
      mapInfo.metalMap && acc.push(initTexture({matName, type: 'metalMap', fileInfo: mapInfo.metalMap}))
      return acc
    }, [])]

    partInfos.forEach(part => {
      if (!part.grandChildParts && part.type === 2) {
        texturePromises.push(initTexture({meshName: part.childMeshName, fileInfo: part.colorMap}))
      }
      if (part.grandChildParts) {
        part.grandChildParts.forEach(grandPart => {
          if (grandPart.type === 2) {
            texturePromises.push(initTexture({meshName: grandPart.name, fileInfo: grandPart.colorMap}))
          }
        })
      }
    })

    const env = matsInfo.env
    // @ts-ignore
    env && texturePromises.push(initTexture({type: 'env', fileInfo: env.envMap}))
    const maps = await Promise.all(texturePromises)
    this.preloadTextures = maps.reduce((acc, cur) => {

      const {map, type, matName, meshName} = cur

      if (type === 'env') {
        acc.env = map
      }

      if (matName) {
        const mat = acc.mat[matName]
        if (mat) {
          mat[type] = map
        } else {
          acc.mat[matName] = {}
          acc.mat[matName][type] = map
        }
      }
      if (meshName) {
        acc.mesh[meshName] = map
      }
      return acc
    }, {
      mesh: {},
      mat: {}
    })
    env && (this.preloadTextures.env = this.convertEnvMap(this.preloadTextures.env))
  }

  private convertEnvMap(envMap) {
    const pmremGenerator = new PMREMGenerator(this.renderer)
    pmremGenerator.compileEquirectangularShader()
    envMap.flipY = false
    envMap.encoding = sRGBEncoding
    envMap = pmremGenerator
      .fromEquirectangular(envMap)
      .texture
    pmremGenerator.dispose()
    return envMap
  }

  private addUvSet(material, info) {
    const {map, normalMap} = mapType
    const validMaps = [map, normalMap]
    const pattern = /#include <(.*)>/gm

    function parseIncludes(string) {

      function replace(match, include) {

        const replace = ShaderChunk[include]
        return parseIncludes(replace)
      }

      return string.replace(pattern, replace)
    }

    const mapRegex = /texture2D\( (.*Map|map), vUv \)/gm

    const onBeforeCompile = function (shader) {
      let prependUniforms = ''

      function replaceMaps(string) {

        function replace(match, mapName) {
          if (!validMaps.includes(mapName)) return match

          let uniformName = `u_${mapName}Transform`
          prependUniforms = prependUniforms.includes(uniformName)
            ? prependUniforms
            : `${prependUniforms} uniform mat3 ${uniformName};\n`
          shader.uniforms[uniformName] = extraUniforms[uniformName]
          shader.uniforms[uniformName].name = uniformName

          const replace = `texture2D( ${mapName}, ( ${uniformName} * vec3( vUv, 1. ) ).xy )`

          return replaceMaps(replace)
        }

        return string.replace(mapRegex, replace)
      }

      shader.fragmentShader = parseIncludes(shader.fragmentShader)
      shader.fragmentShader = replaceMaps(shader.fragmentShader)
      shader.fragmentShader = prependUniforms + shader.fragmentShader
    }

    const extraUniforms = {}
    material.userData.extraUniforms = extraUniforms

    validMaps.forEach(mapType => {
      const repeatProp = `${mapType}Repeat`
      const repeat = info[mapType] || [1, 1]
      const [x, y] = repeat
      material[repeatProp] = new Vector2(x, y)

      const uniformName = `u_${mapType}Transform`

      const setUvTransform = function (tx, ty, sx, sy, rotation, cx, cy) {
        const c = Math.cos(rotation)
        const s = Math.sin(rotation)

        this.set(
          sx * c, sx * s, -sx * (c * cx + s * cy) + cx + tx,
          -sy * s, sy * c, -sy * (-s * cx + c * cy) + cy + ty,
          0, 0, 0
        )
      }

      const uniform = {value: new Matrix3(), name: mapType}
      uniform.value.name = mapType
      uniform.value.setUvTransform = setUvTransform.bind(uniform.value)
      extraUniforms[uniformName] = uniform

      const updateMethod = `${mapType}UpdateMatrix`

      material[updateMethod] = function () {
        const {x, y} = this[repeatProp]
        extraUniforms[uniformName].value.setUvTransform(0, 0, x, y, 0, 0, 0)
      }.bind(material)

      material[updateMethod]()
    })
    material.onBeforeCompile = onBeforeCompile.bind(material)
  }

  public setLight(light: lightParams) {
    const {
      intensity,
      position,
      color,
    } = light

    const isMainLightDirect = this.newLightModel

    if (isMainLightDirect) {
      if (!this.isAroundLightEmpty) {
        this.aroundPointLights.forEach(light => this.scene.remove(light))
        this.isAroundLightEmpty = true
      }
    } else {
      if (this.isAroundLightEmpty) {
        [
          [0, 200, 0],
          [0, -200, 0],
          [200, 0, 0],
          [-200, 0, 0],
          [0, 0, 200],
          [0, 0, -200]
        ].forEach(position => {
          let [x, y, z] = position
          this.addLight({
            position: {x, y, z},
            ...this.aroundPointLight
          }, this.aroundPointLights)
        })
        this.isAroundLightEmpty = false
      }
    }

    if (this.mainPointLight) {
      this.scene.remove(this.mainPointLight)
    }

    const mainLight = isMainLightDirect
      ? DirectionalLight
      : PointLight
    this.renderer.physicallyCorrectLights = isMainLightDirect
    this.mainPointLight = new mainLight(color, intensity)
    const {x = 32, y = 23, z = -4} = position || {}
    this.mainPointLight.position.set(x, y, z)
    this.scene.add(this.mainPointLight)
  }

  private initLights() {
    let {
      mainPointLight,
      ambientLight,
      customLights,
      newLightModel,
      aroundPointLight
    } = this

    this.setLight(mainPointLight)
    this.ambientLight = new AmbientLight(ambientLight.color, ambientLight.intensity)
    this.camera.add(this.ambientLight)
    customLights.forEach(lightObj => this.addLight(lightObj, this.customLights))
  }

  public updateLightIntensity({main, ambient, around}) {
    const {
      aroundPointLight,
      mainPointLight,
      ambientLight
    } = this

    if (notNullOrUndef(main)) {
      this.mainPointLight.intensity = main
      mainPointLight.intensity = main
    }

    if (notNullOrUndef(ambient)) {
      this.ambientLight.intensity = ambient
      ambientLight.intensity = ambient
    }

    if (notNullOrUndef(around)) {
      aroundPointLight.intensity = around
      this.aroundPointLights.forEach(light => light.intensity = around)
    }
  }

  public updateLightPosition(position) {
    const {x, y, z} = position || {}
    this.mainPointLight.position.set(x, y, z)
  }

  public updateDefaultLightSetting(val) {
    this.newLightModel = val
    this.mainPointLight.type = val ? "direct" : "point"
    this.setLight(this.mainPointLight)
  }

  public setCameraPosition({x = 0, y = 0, z = 0} = {}) {
    this.camera.position.set(x, y, z)
    this.camera.lookAt(0, 0, 0)
  }

  private disposeMeshGroup() {
    if (this.object) {
      this.object.traverse(child => {
        if (!child.isMesh) return
        child.geometry.dispose()
        const material = child.material
        Array.isArray(material)
          ? material.forEach(material => material.dispose())
          : material.dispose()
      })
    }
  }

  private async updateMeshGroup(GLTFPath, GLTFBuffer) {
    const {
      scene,
      preloadTextures,
      onRendered,
      matsInfo,
      rotation,
      partInfos
    } = this

    scene.remove(this.object)
    this.disposeMeshGroup()
    const GLTFData = await new Promise((resolve) => {
      gltfLoader.parse(GLTFBuffer, GLTFPath, buffer => resolve(buffer))
    })
    // @ts-ignore
    this.object = GLTFData.scene
    if (this.envMap) {
      this.envMap = await this.loadTexture(this.envMap)
      this.envMap = this.convertEnvMap(this.envMap)
    }
    this.object.traverse(async child => {
      if (!child.isMesh) return
      const material = child.material
      const matName = material.name
      const meshName = child.name

      if (matName.includes('custom')) {
        material.polygonOffsetUnits = 1
      }

      const {
        repeat,
        normalRepeat = [1, 1],
        normalScale,
        metalness,
        roughness
      } = matsInfo[matName]

      if (preloadTextures.env) {
        material.envMap = preloadTextures.env
      }

      let mapInfo = preloadTextures.mat[matName]

      const {map, normalMap} = mapType

      const [x, y] = normalRepeat
      this.addUvSet(material, {
        [map]: repeat || [1, 1],
        [normalMap]: [x, -y]
      })

      if (mapInfo) {
        const {
          map,
          normalMap,
          metalMap
        } = mapInfo

        if (map) {
          this.updateMap(map, material)
        }

        if (normalMap) {
          material.normalMap && material.normalMap.dispose()
          notNullOrUndef(normalScale) && material.normalScale.set(normalScale, -normalScale)
          normalMap.wrapS = normalMap.wrapT = RepeatWrapping
          material[mapType.normalMap] = normalMap
        }

        if (metalMap) {
          metalMap.flipY = false
          material.metalnessMap && material.metalnessMap.dispose()
          material.roughnessMap && material.roughnessMap.dispose()
          material.metalnessMap = metalMap
          material.roughnessMap = metalMap
        }
      }

      const partMap = preloadTextures.mesh[meshName]
      if (partMap) {
        this.updateMap(partMap, material, true)
      }

      notNullOrUndef(metalness) && (material.metalness = metalness)
      notNullOrUndef(roughness) && (material.roughness = roughness)
    })
    scene.add(this.object)
    rotation && this.setRotation(rotation)

    if (partInfos) {
      partInfos.forEach(partInfo => {
        this.updatePart(partInfo)
      })
    }

    onRendered && onRendered(this.getImg())
  }

  public setRotation(rotation) {
    const {x, y, z} = rotation
    this.object.setRotationFromEuler(new Euler(x, y, z))
  }

  public addLight({
                    position,
                    color,
                    intensity,
                    distance,
                    closed,
                    decay
                  }: lightParams, target = this.customLights) {
    const {x, y, z} = position
    const light = new PointLight(color, closed ? 0 : intensity, distance, decay)
    light.position.set(x, y, z)
    target.push(light)
    this.scene.add(light)
  }

  public removeLight(index) {
    this.scene.remove(this.customLights.splice(index, 1)[0])
  }

  public updateCustomLight(index, params) {
    const light = this.customLights[index]
    const {position: {x, y, z}, intensity, decay, color, distance, closed} = params
    light.position.set(x, y, z)
    light.intensity = closed ? 0 : intensity
    light.decay = decay
    light.color = new Color(color)
    light.distance = distance
  }

  public resize(width, height) {
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private disposeMat(mat) {
    mat.map && mat.map.dispose()
    mat.metalnessMap && mat.metalnessMap.dispose()
    mat.roughnessMap && mat.roughnessMap.dispose()
    mat.normalMap && mat.normalMap.dispose()
    mat.dispose()
  }

  public destroy(destroyRenderer) {
    const {
      animateID,
      control,
      scene,
      object,
      renderer
    } = this

    this.GLTFBuffer = null
    animateID && cancelAnimationFrame(animateID)
    control && control.dispose()
    if (object) {
      object.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => this.disposeMat(mat))
          } else {
            this.disposeMat(child.material)
          }
        }
      })
      scene.remove(object)
      this.object = null
    }
    if (scene) {
      scene.dispose()
      this.scene = null
    }
    if (renderer) {
      if (destroyRenderer) {
        renderer.renderLists.dispose()
        renderer.dispose()
        this.renderer = null
      } else {
        renderer.clear()
      }
    }
  }

  public updateZoom(zoom) {
    this.camera.zoom = zoom
    this.camera.updateProjectionMatrix()
  }

  public async updatePart({
                            parentMeshName,
                            childMeshName,
                            type,
                            colorValue,
                            grandChildParts
                          }): Promise<void> {
    const {
      object
    } = this
    if (!object) return

    object.traverse(mesh => {
      if (mesh.name === parentMeshName) {
        mesh.children.forEach(child => {
          if (child.name === childMeshName) {
            child.visible = true
            if (grandChildParts) {
              child.traverse(grandChild => {
                if (!grandChild.isMesh) return
                const matchedPart = grandChildParts.find(i => i.name === grandChild.name)
                if (matchedPart && matchedPart.type === 1) {
                  grandChild.material.map = null
                  const [r, g, b] = matchedPart.colorValue
                  grandChild.material.color = {r: parseInt(r) / 255, g: parseInt(g) / 255, b: parseInt(b) / 255}
                }
              })
            } else if (type === 1) {
              child.material.map = null
              const [r, g, b] = colorValue
              child.material.color = {r: parseInt(r) / 255, g: parseInt(g) / 255, b: parseInt(b) / 255}
            }
          } else {
            child.visible = false
          }
        })
      }
    })
  }

  public getImg(): string {
    const {renderer, scene, camera} = this
    if (!renderer) return
    renderer.render(scene, camera)
    return renderer.domElement.toDataURL()
  }
}

export {Previewer, getRenderer}