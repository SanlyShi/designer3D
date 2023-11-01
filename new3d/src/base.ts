import {
  Euler, WebGLRenderer, sRGBEncoding, Scene, PerspectiveCamera,
  Vector2, Matrix3, Color,
  TextureLoader, CanvasTexture, UVMapping, LinearFilter, RepeatWrapping
} from "three/build/three.module"
import {Map, NormalMap, LIGHT_FOLLOW_CAM_EVENT} from "./type";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {TransformControls} from "three/examples/jsm/controls/TransformControls";
import {Raycaster} from "three/build/three.module"

const textureLoader = new TextureLoader()

export class Base {
  public control
  private waiting: boolean = false
  protected options
  protected events = []
  protected loaded: boolean
  protected destroyed: boolean = false
  protected object
  protected scene
  protected renderer
  public camera

  public updateZoom(zoom) {
    this.camera.zoom = zoom
    this.camera.updateProjectionMatrix()
    this.renderScene()
  }

  public setCameraPosition({x = 0, y = 0, z = 0, needRender = true} = {}) {
    this.camera.position.set(x, y, z)
    this.camera.lookAt(0, 0, 0)
    needRender && this.renderScene()
  }

  public setRotation(rotation) {
    const {x, y, z} = rotation
    this.object.setRotationFromEuler(new Euler(x, y, z))
    this.renderScene()
  }

  public on(type, cb) {
    if (!this.events[type]) {
      this.events[type] = []
    }
    this.events[type].push(cb)
  }

  public emit(type) {
    const cbs = this.events[type]
    if (cbs) {
      cbs.forEach(cb => {
        cb(this)
      })
    }
  }

  public getImg() {
    const {renderer} = this
    if (!renderer) return
    return renderer.domElement
  }

  private async loadPartTexture(fileInfo) {
    if (typeof fileInfo === 'string') {
      return await new Promise(resolve => {
        textureLoader.load(fileInfo, resolve)
      })
    } else {
      return new CanvasTexture(fileInfo, UVMapping)
    }
  }

  protected initOrbitControls() {
    const {
      camera,
      renderer,
      options: {
        modelControlDomId
      }
    } = this

    let controlDom = modelControlDomId
      ? document.getElementById(modelControlDomId)
      : renderer.domElement
    const control = this.control = new OrbitControls(camera, controlDom)

    if (modelControlDomId) {
      control.enableZoom = true
      control.enableRotate = true;
      control.rotateSpeed = 0.05;
    }
    control.enablePan = false
    !this.options.lightLock && this.emit(LIGHT_FOLLOW_CAM_EVENT)
    control.addEventListener('change', () => {
      !this.options.lightLock && this.emit(LIGHT_FOLLOW_CAM_EVENT)
      this.renderScene()
    })
  }

  protected initTransformControl() {
    const {
      camera,
      renderer,
      scene,
      object,
      options: {
        modelControlDomId
      }
    } = this
    const transformControl = new TransformControls(camera, renderer.domElement)

    transformControl.attach(object)
    transformControl.addEventListener('change', () => this.renderScene())
    transformControl.addEventListener('objectChange', () => this.emit('objectChange'))
    transformControl.setSpace("local")
    transformControl.addEventListener('dragging-changed', event => this.control.enabled = !event.value)
    scene.add(transformControl)
    transformControl.setMode("rotate")
    transformControl.showX = false
    transformControl.showY = false
    transformControl.showZ = false
    window.addEventListener('keydown', event => {
      switch (event.keyCode) {
        case 187:
        case 107: // +, =, num+
          transformControl.setSize(transformControl.size + 0.1)
          break
        case 189:
        case 109: // -, _, num-
          transformControl.setSize(Math.max(transformControl.size - 0.1, 0.1))
          break
        case 69: // E
          transformControl.setMode("rotate")
          break
        case 81: // Q
          transformControl.setSpace(transformControl.space === "local" ? "world" : "local");
          break;
        case 88: // X
          transformControl.showX = (modelControlDomId || this.options.clickModel) ? false : !transformControl.showX
          break
        case 89: // Y
          transformControl.showY = (modelControlDomId || this.options.clickModel) ? false : !transformControl.showY
          break
        case 90: // Z
          transformControl.showZ = (modelControlDomId || this.options.clickModel) ? false : !transformControl.showZ
          break
      }
    })
  }

  protected initPartClickRotate() {
    let selectedObjects = [];
    const {width, height} = this.options.el;
    let onPointerMove1 = (event) => {
      mouse1.x = (event.clientX / width) * 2 - 1;
      mouse1.y = -(event.clientY / height) * 2 + 1;
    };
    let onPointerMove2 = (event) => {
      mouse2.x = (event.clientX / width) * 2 - 1;
      mouse2.y = -(event.clientY / height) * 2 + 1;
      if (mouse1.x === mouse2.x && mouse1.y === mouse2.y) {
        checkIntersection();
      }
    };
    this.renderer.domElement.addEventListener("mousedown", onPointerMove1, true);
    this.renderer.domElement.addEventListener("mouseup", onPointerMove2, true);
    const raycaster = new Raycaster();
    let mouse1 = new Vector2();
    let mouse2 = new Vector2();
    let addSelectedObject = (object) => {
      selectedObjects = [];
      selectedObjects.push(object);
    };
    let checkIntersection = () => {
      raycaster.setFromCamera(mouse2, this.camera);
      let intersects = raycaster.intersectObject(this.scene, true);
      intersects = intersects.filter((o) => {
        if (o.object.visible == true && o.object.type == "Mesh") {
          return o;
        }
      });
      if (intersects.length > 0) {
        const selectedObject = intersects[0].object;
        addSelectedObject(selectedObject);
        this.options.clickModel(selectedObjects);
      } else {
      }
    }
  }

  protected setRenderer(): void {
    const {el} = this.options
    const renderer = this.renderer = new WebGLRenderer({
      canvas: el,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true
    })
    renderer.outputEncoding = sRGBEncoding
    const {width, height} = el
    renderer.setSize(width, height)
    const scene = this.scene = new Scene()
    const camera = this.camera = new PerspectiveCamera(45, width / height, 0.1, 10000)
    scene.add(camera)
  }

  public getCameraPosition() {
    return this.camera.position
  }

  public getModelRotate() {
    return this.object.rotation
  }

  public resize(width, height) {
    this.camera.aspect = width / height
    // if (width <= 700) {
    //   this.camera.fov = height / width * 50;
    // }
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.renderScene(true)
    return this
  }

  public renderScene(now?) {
    if (this.destroyed) return
    const {
      renderer,
      scene,
      camera,
    } = this

    if (now && this.loaded) {
      renderer.render(scene, camera)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.options.onRendered && this.options.onRendered(this.getImg())
        })
      })
      return
    }

    if (this.waiting) {
      return
    } else if (this.loaded) {
      this.waiting = true
      requestAnimationFrame(() => {
        renderer.render(scene, camera)
        this.options.onRendered && this.options.onRendered(this.getImg())
        this.waiting = false
      })
    }
  }
}