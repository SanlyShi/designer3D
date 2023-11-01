import {Options} from "./type"
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader"
import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader"
import {MaterialBase} from "./material"

const gltfLoader = new GLTFLoader()

export function loadDecoder() {
  const draLoader = new DRACOLoader()
  draLoader.setDecoderPath(`https://zwstatic.hicustom.com/r_designer_static/static/draco/`)
  draLoader.preload()
  gltfLoader.setDRACOLoader(draLoader)
}

export class Model extends MaterialBase {

  constructor(options: Options) {
    super()
    this.options = options
  }

  public async init() {
    const {
      options: {
        GLTFPath,
        zoom,
        cameraPosition,
        clickModel,
        enableControl,
      }
    } = this

    this.setRenderer()
    clickModel && this.renderer.setClearColor(0xf6f6f6)
    this.initLights()
    this.setCameraPosition(cameraPosition)
    zoom && this.updateZoom(zoom)

    await Promise.all([
      this.preloadTexture(),
      this.loadGLTF(GLTFPath)
    ])

    if (this.destroyed) return

    await this.updateMeshGroup(GLTFPath, false)

    if (this.destroyed) return

    if (enableControl) {
      this.initOrbitControls()
      this.initTransformControl()
      clickModel && this.initPartClickRotate()
    }
  }

  async loadGLTF(GLTFPath) {
    const GLTFData = await new Promise(resolve => {
      gltfLoader.load(GLTFPath, GLTFData => resolve(GLTFData))
    })
    // @ts-ignore
    this.object = GLTFData.scene
  }

  public async updateMeshGroup(GLTFPath: string, fetchGLTF = true) {
    const {
      object,
      scene,
      colorMapQueue,
      renderer,
      camera,
      options: {
        rotation,
        partInfos,
      }
    } = this
    if (!GLTFPath) return

    object && scene.remove(this.object)
    this.disposeMeshGroup()
    if (fetchGLTF) {
      await this.loadGLTF(GLTFPath)
    }

    this.processMaterial()

    scene.add(this.object)
    rotation && this.setRotation(rotation)

    let needRender = true

    if (partInfos) {
      partInfos.forEach(partInfo => {
        const {type, grandChildParts, parentMeshName, childMeshName} = partInfo
        this.object.traverse(object3D => {
          if (object3D.name === parentMeshName) {
            object3D.traverse(child => {
              if (child.name === childMeshName) {
                if (grandChildParts) {
                  grandChildParts.forEach(i => {
                    child.traverse(grandChild => {
                      if (grandChild.name === i.name) {
                        i.type === 2 && (needRender = false)
                      }
                    })
                  })
                } else {
                  type === 2 && (needRender = false)
                }
              }
            })
          }
        })
        this.updatePart(partInfo, true)
      })
    }

    this.loaded = true
    this.emit('loaded')

    if (needRender) {
      renderer.render(scene, camera)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const onRendered = this.options.onRendered
          colorMapQueue.every(i => i.resolved)
          && onRendered
          && onRendered(this.getImg())
        })
      })
    }
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

  public updateSyncInfo({
                          zoom,
                          position,
                          main,
                          ambient,
                          around,
                          rotation,
                          custom = []
                        }) {
    rotation && this.setRotation(rotation)
    position && this.setCameraPosition(position)
    zoom && this.updateZoom(zoom)
    this.setLight(main)
    this.updateLightIntensity({main: main && main.intensity, ambient, around})
    while (this.customLights.length) {
      this.removeLight(0)
    }
    custom.forEach(lightObj => this.addLight(lightObj, this.customLights))
  }

  public destroy() {
    const {
      control,
      scene,
      object,
      renderer,
      loaded
    } = this

    if (!loaded) {
      this.on('loaded', () => {
        this.destroy()
      })
      return
    }

    control && control.dispose()
    if (object) {
      object.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.map && mat.map.dispose()
              mat.normalMap && mat.normalMap.dispose()
              mat.dispose()
            })
          } else {
            child.material.map && child.material.map.dispose()
            child.material.normalMap && child.material.normalMap.dispose()
            child.material.dispose()
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
      renderer.forceContextLoss()
      renderer.renderLists.dispose()
      renderer.dispose()
      this.renderer = null
    }
    this.destroyed = true
  }
}