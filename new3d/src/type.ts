export const Map = 'map'
export const NormalMap = 'normalMap'
export const LIGHT_FOLLOW_CAM_EVENT = 'LIGHT_FOLLOW_CAM_EVENT'

export interface Position {
  x: number,
  y: number,
  z: number
}

export interface LightParams {
  type?: 'point' | 'direct'
  position?: Position,
  color?: string,
  intensity?: number,
  distance?: number,
  closed?: boolean,
  decay?: number
}

export interface Options {
  partInfos: {
    parentMeshName: string
    childMeshName: string
    color: string
  }[]
  rotation?: { x, y, z }
  enableControl?: boolean
  newLightModel?: boolean
  disableTransformAnimate?:boolean
  modelControlDomId?: string
  GLTFBuffer?: ArrayBuffer | string
  GLTFPath?: string
  normalScale?: number
  normalRepeat?: number
  roughness?: number
  metalness?: number
  mainPointLight?: LightParams
  ambientLight?: LightParams
  aroundPointLight?: LightParams
  customLights?: LightParams[]
  cameraPosition: Position
  transparentBackground?: boolean
  lightLock?: boolean
  matsInfo?: {
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
  zoom?: number

  clickModel?(selectObject?): void

  onRendered?(img?): void
}

export interface PreviewerInterface {
  lightLock: boolean

  updateMeshGroup(GLTFPath?: string, GLTFBuffer?: Buffer): void

  updateMap(path: string, material: string | any, loaded?: boolean): void

  setSelectObject(materialName?: string, cameraPositon?: any, updateWhat?: string, callback?: Function): void

  updateColor(material: string | any, color?: object): void

  getImg()

  updateLightIntensity({main, ambient, around}): void

  setEnvMap(envMap): void

  addLight(light: LightParams, target?): void

  updateCustomLight(index, params: LightParams): void

  removeLight(index): void

  resize(width, height): void

  destroy(): void

  updateZoom(zoom): void
}

