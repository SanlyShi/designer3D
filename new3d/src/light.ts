import {
  AmbientLight, PointLight, DirectionalLight, Color
} from "three/build/three.module"
import {LIGHT_FOLLOW_CAM_EVENT, LightParams} from "./type"
import {Base} from "./base"
import {isDef} from "./utils";

export class LightBase extends Base {

  private ambientLight
  private aroundPointLights = []
  private isAroundLightEmpty: boolean = true
  protected mainPointLight
  protected customLights = []

  protected initLights() {
    let {
      mainPointLight,
      ambientLight,
      customLights,

    } = this.options

    this.on(LIGHT_FOLLOW_CAM_EVENT, () => {
      this.mainPointLight.position.copy(this.camera.position)
    })

    this.setLight(mainPointLight)
    this.ambientLight = new AmbientLight(ambientLight.color, ambientLight.intensity)
    this.camera.add(this.ambientLight)
    customLights && customLights.forEach(lightObj => this.addLight(lightObj, this.customLights))
  }

  public setLight(light: LightParams) {
    const {
      intensity,
      position,
      color,
    } = light

    const {
      newLightModel,
      aroundPointLight
    } = this.options

    const isMainLightDirect = newLightModel

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
            ...aroundPointLight
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
    this.renderScene()
  }

  public addLight({
                    position,
                    color,
                    intensity,
                    distance,
                    closed,
                    decay
                  }: LightParams, target = this.customLights) {
    const {x, y, z} = position
    const light = new PointLight(color, closed ? 0 : intensity, distance, decay)
    light.position.set(x, y, z)
    target.push(light)
    this.scene.add(light)
    this.renderScene()
  }

  public updateLightIntensity({main, ambient, around}) {
    const {
      aroundPointLight,
      mainPointLight,
      ambientLight
    } = this.options
    if (isDef(main)) {
      this.mainPointLight.intensity = main
      mainPointLight.intensity = main
    }
    if (isDef(ambient)) {
      this.ambientLight.intensity = ambient
      ambientLight.intensity = ambient
    }
    if (isDef(around)) {
      aroundPointLight.intensity = around
      this.aroundPointLights.forEach(light => light.intensity = around)
    }
    this.renderScene()
  }

  public updateLightPosition(position) {
    const {x, y, z} = position || {}
    this.mainPointLight.position.set(x, y, z)
    this.renderScene()
  }

  public updateDefaultLightSetting(val) {
    this.options.newLightModel = val
    this.mainPointLight.type = val ? "direct" : "point"
    this.setLight(this.mainPointLight)
  }

  public removeLight(index) {
    this.scene.remove(this.customLights.splice(index, 1)[0])
    this.renderScene()
  }

  public updateCustomLight(index, params) {
    const light = this.customLights[index]
    const {position: {x, y, z}, intensity, decay, color, distance, closed} = params
    light.position.set(x, y, z)
    light.intensity = closed ? 0 : intensity
    light.decay = decay
    light.color = new Color(color)
    light.distance = distance
    this.renderScene()
  }
}