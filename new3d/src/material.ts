import {
  TextureLoader, PMREMGenerator, CanvasTexture,
  sRGBEncoding, UVMapping, LinearFilter, RepeatWrapping, ShaderChunk, Vector2, Matrix3
} from "three/build/three.module"
import {LightBase} from "./light"
import {Map, NormalMap} from "./type"
import {isDef} from "./utils"
import TWEEN from "@tweenjs/tween.js";

const textureLoader = new TextureLoader()

export class MaterialBase extends LightBase {
  private selectChildColor

  protected colorMapQueue = []
  protected preloadTextures

  protected async preloadTexture() {
    const {
      matsInfo
    } = this.options

    const initTexture = async (matName, type, fileInfo) => {
      const map = await this.loadTexture(fileInfo)
      return {
        matName,
        type,
        map
      }
    }

    const texturePromises = [...Object.entries(matsInfo).reduce((acc, cur) => {
      const [matName, mapInfo] = cur
      // @ts-ignore
      mapInfo.map && acc.push(initTexture(matName, 'map', mapInfo.map))
      // @ts-ignore
      mapInfo.normalMap && acc.push(initTexture(matName, 'normalMap', mapInfo.normalMap))
      // @ts-ignore
      mapInfo.metalMap && acc.push(initTexture(matName, 'metalMap', mapInfo.metalMap))
      return acc
    }, [])]

    const env = matsInfo.env
    // @ts-ignore
    env && texturePromises.push(initTexture('env', 'envMap', env.envMap))
    const maps = await Promise.all(texturePromises)
    this.preloadTextures = maps.reduce((acc, cur) => {
      const mat = acc[cur.matName]
      if (acc[cur.matName]) {
        mat[cur.type] = cur.map
      } else {
        acc[cur.matName] = {}
        acc[cur.matName][cur.type] = cur.map
      }
      return acc
    }, {})
    env && (this.preloadTextures.env.envMap = this.convertEnvMap(this.preloadTextures.env.envMap))
  }

  private async loadTexture(fileInfo) {
    if (typeof fileInfo === 'string') {
      return await new Promise(resolve => {
        textureLoader.load(fileInfo, resolve)
      })
    } else {
      return new CanvasTexture(fileInfo, UVMapping)
    }
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

  protected async setEnvMap(envMap, mapLoaded?) {
    if (!this.object) return
    if (envMap && !mapLoaded) {
      envMap = await this.loadTexture(envMap)
      envMap = this.convertEnvMap(envMap)
    }
    this.object.traverse(async child => {
      if (!child.isMesh) return
      const material = child.material
      material.envMap && material.envMap.dispose()
      envMap
        ? material.envMap = envMap
        : material.envMap = null
      material.needsUpdate = true
    })
    this.renderScene()
  }

  private setLoadedMap(map, material, flipY) {
    if (!map) return
    if (this.destroyed) {
      map.dispose()
      return
    }
    if (material.map) {
      material.map.dispose()
      material.map = null
    }

    map.encoding = sRGBEncoding
    map.minFilter = LinearFilter
    const matName = material.name
    map.wrapS = map.wrapT = RepeatWrapping
    map.flipY = !!['custom', 'base'].find(i => matName.includes(i)) || flipY
    material.needsUpdate = true
    material.map = map
  }

  public updateMap(map, material, {mapLoaded, flipY}: {mapLoaded?: boolean, flipY?: boolean} = {}) {
    if (this.destroyed) {
      console.log('update after destroyed')
      return
    }

    if (!mapLoaded) {
      const setMapPromise = (obj) => {
        obj.mapPromise = new Promise(async (resolve, reject) => {
          obj.rejectFn = reject
          if (map) {
            const colorMap = await this.loadTexture(map)
            resolve(colorMap)
          } else {
            resolve(null)
          }
        }).then(colorMap => {
          obj.map = colorMap
          obj.resolved = true
          if (this.colorMapQueue.every(i => i.resolved) && this.object) {
            this.object.traverse(async child => {
              if (!child.isMesh) return
              const childMat = child.material
              const matName = childMat.name
              this.colorMapQueue.forEach(queueObj => {
                if (queueObj.material === matName && child.visible) {
                  this.setLoadedMap(queueObj.map, childMat, flipY)
                }
              })
            })
            this.renderScene()
            this.colorMapQueue = []
          }
        }).catch(() => obj.resolved = false)
      }

      const matchObj = this.colorMapQueue.find(i => i.material === material)
      if (matchObj) {
        if (matchObj.resolved && matchObj.map) {
          matchObj.resolved = false
          matchObj.map.dispose()
        } else {
          matchObj.rejectFn()
        }
        setMapPromise(matchObj)
      } else {
        let queueObj = {
          map: null,
          mapPromise: null,
          rejectFn: null,
          resolved: false,
          material
        }
        setMapPromise(queueObj)
        this.colorMapQueue.push(queueObj)
      }
    } else {
      this.setLoadedMap(map, material, flipY)
    }
    return this
  }

  public async updatePart({
                            parentMeshName,
                            childMeshName,
                            type,
                            colorValue,
                            colorMap,
                            grandChildParts
                          }, isInit: boolean): Promise<void> {
    const {
      object
    } = this
    if (!object) return

    object.traverse(mesh => {
      if (mesh.name === parentMeshName) {
        mesh.children.forEach(child => {
          if (child.name === childMeshName) {
            child.visible = true
            child.traverse(i => i.visible = true)
            if (grandChildParts) {
              child.traverse(grandChild => {
                if (!grandChild.isMesh) return
                const matchedPart = grandChildParts.find(i => i.name === grandChild.name)
                if (matchedPart) {
                  this.updateMatByType({
                    colorMap: matchedPart.colorMap,
                    colorValue: matchedPart.colorValue,
                    type: matchedPart.type,
                    mesh: grandChild
                  })
                }

              })
            }else {
              this.updateMatByType({colorMap, colorValue, type, mesh: child})
            }
          } else {
            child.visible = false
            child.traverse(i => i.visible = false)
          }
        })
      }
    })

    if (!isInit
      && (type !== 2
      || (grandChildParts && grandChildParts.every(i => i.type !== 2)))) {
      this.renderScene()
    }
  }

  private updateMatByType({
                            colorValue,
                            colorMap,
                            type,
                            mesh
                          }) {
    if (type === 1) {
      const [r, g, b] = JSON.parse(colorValue)
      mesh.material.needsUpdate = true
      mesh.material.map = null
      let updateColor = { r: parseInt(r) / 255, g: parseInt(g) / 255, b: parseInt(b) / 255 };
      mesh.material.color = updateColor
    } else if (type === 2) {
      if(mesh.material.userData && mesh.material.userData['initColor']){
        mesh.material.color = mesh.material.userData['initColor']
      }
      this.updateMap(colorMap, mesh.material.name, {mapLoaded: false, flipY: true})
    }
  }

  public updateColor(material, color = {r: "", g: "", b: ""}) {
    const setColor = (colorM, colorMaterial) => {
      colorMaterial.needsUpdate = true
      colorMaterial.map = null
      colorMaterial.color = colorM
    }
    this.object.traverse(async child => {
      if (!child.isMesh) return
      const childMat = child.material
      const matName = childMat.name
      material === matName && setColor(color, childMat)
    })
  }

  public setSelectObject(materialName, cameraPositon, pname, cname, callback) {
    const { disableTransformAnimate } = this.options
    let callbackTime = 0
    let colorTime = 0
    if (!pname) {
      this.object.traverse(async (child) => {
        if (!child.isMesh) return;
        const childMat = child.material;
        const matName = childMat.name;
        if (matName === materialName && colorTime == 0) {
          this.selectChildColor = childMat.color;
          childMat.color = {r: 24 / 255, g: 144 / 255, b: 1};
          this.renderScene();
          colorTime += 1
        }
      });
    } else {
      this.object.traverse((child) => {
        if (child.name === pname) {
          child.children.forEach((c) => {
            if (c.name === cname) {
              c.traverse((sc) => {
                if (sc.isMesh && colorTime == 0) {
                  this.selectChildColor = sc.material.color;
                  sc.material.color = {r: 24 / 255, g: 144 / 255, b: 1};
                  this.renderScene();
                  colorTime += 1
                }
              });
            }
          });
        }
      });
    }
    let animateCamera = (current1, target1) => {
      var tween = new TWEEN.Tween({
        x1: current1.x,
        y1: current1.y,
        z1: current1.z,
      });
      tween.stop();
      tween.to(
        {
          x1: target1.x,
          y1: target1.y,
          z1: target1.z,
        },
        1500
      );
      tween.onUpdate((object) => {
        this.camera.position.x = object.x1;
        this.camera.position.y = object.y1;
        this.camera.position.z = object.z1;
        this.control.update();
        requestAnimationFrame(() => {
          tween.update();
        });
      });
      tween.onComplete(() => {
        this.control.enabled = true;
      });
      tween.easing(TWEEN.Easing.Cubic.InOut);
      tween.start();
      tween.update();
      setTimeout(() => {
        if (!pname) {
          this.object.traverse(async (child) => {
            if (!child.isMesh) return;
            const childMat = child.material;
            const matName = childMat.name;
            if (matName === materialName && callbackTime == 0) {
              childMat.color = this.selectChildColor;
              this.renderScene();
              callback && callback(true)
              callbackTime += 1
            }
          });
        } else {
          this.object.traverse((child) => {
            if (child.name === pname) {
              child.children.forEach((c) => {
                if (c.name === cname) {
                  c.traverse((sc) => {
                    if (sc.isMesh && callbackTime == 0) {
                      sc.material.color = this.selectChildColor;
                      this.renderScene();
                      callback && callback(true)
                      callbackTime += 1
                    }
                  });
                }
              });
            }
          });
        }
      }, 500);
    };
    if(!disableTransformAnimate){
      animateCamera(this.camera.position, cameraPositon);
    }else{
      this.setCameraPosition(cameraPositon)
    }
  }

  protected addUvSet(material, info) {
    const validMaps = [Map, NormalMap]
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

  protected async processMaterial() {
    const {
      preloadTextures,
      colorMapQueue,
      options: {
        matsInfo
      }
    } = this

    this.object.traverse(async child => {
      if (!child.isMesh) return
      const material = child.material
      const matName = material.name
      material.userData['initColor'] = material.color

      const {
        repeat,
        normalRepeat = [1, 1],
        normalScale,
        metalness,
        roughness
      } = matsInfo[matName] || {}

      const matched = colorMapQueue.find(i => i.material === matName)

      if (matched && matched.resolved) {
        this.updateMap(matched.map, material, {mapLoaded: true})
      }

      let mapInfo = preloadTextures[matName]

      const [x, y] = normalRepeat
      this.addUvSet(material, {
        [Map]: repeat || [1, 1],
        [NormalMap]: [x, -y]
      })

      if (mapInfo) {
        const {
          map,
          normalMap,
          metalMap
        } = mapInfo

        if (map) {
          this.updateMap(map, material, {mapLoaded: true})
        }

        if (normalMap) {
          material.normalMap && material.normalMap.dispose()
          isDef(normalScale) && material.normalScale.set(normalScale, -normalScale)
          normalMap.wrapS = normalMap.wrapT = RepeatWrapping
          material[NormalMap] = normalMap
        }

        if (metalMap) {
          metalMap.flipY = false
          material.metalnessMap && material.metalnessMap.dispose()
          material.roughnessMap && material.roughnessMap.dispose()
          material.metalnessMap = metalMap
          material.roughnessMap = metalMap
        }
      }

      isDef(metalness) && (material.metalness = metalness)
      isDef(roughness) && (material.roughness = roughness)
    })
    if (preloadTextures.env) {
      await this.setEnvMap(preloadTextures.env.envMap, true)
    }
  }
}