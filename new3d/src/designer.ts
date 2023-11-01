// @ts-ignore
import Konva from "./utils/konva7.2.1.js";
import { zw_PerspT } from "./utils/perspective-transform.js";
import { zw_Mesh2D } from "./utils/createMesh.js";
import { composeDetail3D } from "./main";
import axios from 'axios'
import Color from './utils/color.js'
import {preloadModelData} from './composeDetail3D'
import { promises } from "dns";
import { resolve } from "../build/base.js";
import { stringify } from "querystring";
import { callbackify } from "util";

//16*16 三角形面片进行拟合
const FISH_DIV = 16;
const FISH_DIV_h = 16;
interface ProductData {
  [propName: string]: any
}

interface View {
  id?: number
  name?: string
  width: number
  height: number
  printArea: {
    id?: number
    width: number
    height: number
    offset_x: number
    offset_y: number
  }
}

interface SaveData {
  dpi?: number
  image?: any
  text?: any
  color?: any
  konvaAttrs: any
  print_area_id: string
  type: string
  view_id: number
  id?: number,
  nodeId?: number
}

interface ImageData {
  width: number
  height: number
  size: {
    width: number
    height: number
  }
  code: string
  designImg: string
  designImg2: string
  designImg3: string
}

interface ConstructorArg {
  container?: Element
  productData: ProductData
  viewId?: number
  saveData: Array<SaveData>
  callBack: ({ src: string }) => {}
}

interface PictureException {
  text: string
  title: string
  bgColor: string
  type: number
}

interface templateData {
  cfg: any,
  views: Array<View>
}

interface Percent {
  left: number,
  top: number
}

type ClipAttr = {
  width: number,
  height: number,
  scaleX: number,
  scaleY: number,
  x: number,
  y: number,
  originImg?: string,
  xFlip?: boolean,
  yFlip?: boolean
}
interface ClipData {
  clipPath: {
    code: string|number,
    image: string
  },
  imgAttrs: ClipAttr,
  pathAttrs: ClipAttr
}

let requestReferer: string = ''
let imgRotate = new Image(), imgZoom = new Image()
let anchorGroup = null, anchorRotate = null, anchorZoom = null
let changeNodeList: Array<{view: View, oldNode: any, oldNodeAttrs: any, oldNodeId: number}> = []
let fontLoaded = false
let startLoadFont = false
let fontList = []

class Design {
  container: Element
  containerWidth: number
  productData: ProductData = []
  viewId: number
  private stageObj: object = {}
  private ratio: number = 0
  saveData: Array<SaveData> = []
  private konvaJson: object = {}
  private cacheProductPrintAreas: Array<{
    id: number, //打印区域id
    defaultViews: number,//默认哪一面
    printArea: object, //打印区域
    config: object
  }> = []
  private viewImgObj: Array<{
    id: number,
    viewDesign?: string,
    viewDesignCanvas?: HTMLCanvasElement,
    name?: string
  }> = []
  private viewNodeObj: {
    childrens: Array<{
      type: string
      node: any,
      id: string
    }>
  } = {
      childrens: []
    }
  private saveProductObj: {
    is_overspread: number
    is_vague: number
  } = {
    is_overspread: 1, //1：铺满  -1: 未铺满
    is_vague: -1 //1: 模糊  -1: 清晰
  }
  private threeDApp = []
  private associateProductView: View = null
  // private currentProductView: View = null
  // private currentTemplateData: templateData = null
  private cloneViewLength: number = 0
  private needDetailImg: boolean = false
  private useType: number = 1
  private detailImgList = null
  //简版编辑图片画布
  private editImgConteiner: HTMLDivElement = null
  private indexList = ["master"]
  private curColorId = 0
  private isDestroy = false
  private partCheckedList = []
  constructor({
    container = null,
    productData,
    saveData,
    viewId = null,
    requestTarget = '',
    associateProductView = null,
    templateData = null,
    type = 1,
    staticImagePath = '',
    callBack
  }) {
    if (container) {
      this.container = container
    } else {
      let div = document.createElement('div')
      div.style.width = '600px'
      div.style.height = '600px'
      div.style.position = "fixed"
      div.style.left = "10000px"
      document.body.appendChild(div)
      this.container = div
    }
    this.productData = JSON.parse(JSON.stringify(productData))
    this.useType = type
    if(staticImagePath) {
      imgRotate.src = `${staticImagePath}rotate.png`
      imgZoom.src = `${staticImagePath}zoom.png`
    }
    /**
     * type
     * 1 => 简版设计器
     * 2 => 官网商品切换模板
    */
    if(type == 1) {
      // if (viewId != null) {
      //   for (let view of productData.views) {
      //     if (view.id == viewId) {
      //       this.productData.views = [view]
      //     }
      //   }
      // }
      // this.associateProductView = associateProductView
      // this.viewId = viewId
      // this.saveData = JSON.parse(JSON.stringify(saveData))
    } else {
      // this.currentTemplateData = templateData
      this.needDetailImg = true
    }
    this.containerWidth = this.container.clientWidth
    requestReferer = requestTarget
    this.init(callBack)
  }
  private async init(callBack) {
    let partCheckedList = []
    for(let item of this.productData.spu_details) {
      for(let det of item.detail_parts) {
        if(det.is_default === 1) {
          for(let it of det.items) {
            if(it.is_default == 1) { //默认颜色尺码
              partCheckedList.push({
                partId: item.part_id,
                childPartId: det.part_detail_id,
                colorId: it.color_id,
                sizeId: it.size_id
              })
              break
            }
          }
        }
      }
    }
    changeNodeList = []
    this.partCheckedList = partCheckedList
    // this.destroy()
    // let promises = []
    // await this.reCombinKonvaJson(this.saveData, null)
    for (let item of this.productData.views) {
      // if(this.viewId != null) {
      //   if(this.viewId == item.id) {
      //     await this.createStage(item)
      //     promises.push(this.addElement())
      //   }
      // } else {
      //   await this.createStage(item)
      //   promises.push(this.addElement())
      // }
      await this.createStage(item)
    }
    // promises.push(this.addElement())
    // Promise.all(promises).then(() => {
      if(callBack) {
        callBack('')
      }
    // })
  }
  private createStage(view: View) {
    return new Promise<void>(async (resolve) => {
      // this.viewNodeObj[view.id] = {
      //   childrens: []
      // }
      this.viewImgObj.push({ id: view.id, name: view.name });
      let div = document.createElement('div')
      div.style.width = '100%'
      div.style.height = '100%'
      this.container.appendChild(div)
      this.stageObj[`stage${view.id}`] = new Konva.Stage({
        container: div,
        width: div.clientWidth,
        height: div.clientHeight
      })
      await this.initDesignLayer(view.id, div.clientWidth)
      var n = {
        id: view.printArea.id, //打印区域id
        defaultViews: view.id,//默认哪一面
        printArea: view.printArea, //打印区域
        config: this.convertDefaultConfig({
          width: view.printArea.width,
          height: view.printArea.height,
        })
      }
      this.cacheProductPrintAreas.push(n)
      resolve()
    })
  }
  private initDesignLayer(viewId: number, containerWidth: number) {
    return new Promise<void>((resolve) => {
      const currentView = this.productData.views.filter((item: object) => {
        return item['id'] == viewId;
      })[0]
      const ratio = currentView.width / containerWidth
      const currentStage = this.stageObj[`stage${viewId}`]
      const designLayer = new Konva.Layer({
        x: 0,
        y: 0,
        name: "designLayer",
      })
      designLayer.setAttrs({
        ratio: ratio,
        printAreaId: currentView.printArea.id,
        viewId,
        softSvg: currentView.printArea.soft_svg,
      })
      const designContainerGroup = new Konva.Group({
        x: currentView.printArea.offset_x / ratio,
        y: currentView.printArea.offset_y / ratio,
        width: currentView.printArea.width / ratio,
        height: currentView.printArea.height / ratio,
        name: "designContainerGroup",
      })
      const designContainer = new Konva.Rect({
        x: 0,
        y: 0,
        width: currentView.printArea.width / ratio,
        height: currentView.printArea.height / ratio,
        name: "print_area_border_outer",
      })
      designContainerGroup.add(designContainer);
      designLayer.add(designContainerGroup);
      currentStage.add(designLayer);
      designLayer.batchDraw();
      designContainerGroup.clip({
        x: 0,
        y: 0,
        width: designContainerGroup.width(),
        height: designContainerGroup.height(),
      })
      resolve()
    })
  }
  createStageForUpdateImage(viewId) {
    return new Promise<void>(async (resolve) => {
      let div = document.createElement('div')
      div.setAttribute('id', 'controlImgCanvas')
      div.style.width = '100%'
      div.style.height = '100%'
      this.editImgConteiner.appendChild(div)
      this.stageObj[`updateImgStage`] = new Konva.Stage({
        container: div,
        width: div.clientWidth,
        height: div.clientHeight
      })
      const currentView = this.productData.views.filter((item: object) => {
        return item['id'] == viewId;
      })[0]
      const ratio = currentView.width / this.editImgConteiner.clientWidth
      const currentStage = this.stageObj[`updateImgStage`]
      const designLayer = new Konva.Layer({
        x: 0,
        y: 0,
        name: "designLayer",
      })
      designLayer.setAttrs({
        ratio: ratio,
        printAreaId: currentView.printArea.id,
        viewId,
        softSvg: currentView.printArea.soft_svg,
      })
      const designContainerGroup = new Konva.Group({
        x: currentView.printArea.offset_x / ratio,
        y: currentView.printArea.offset_y / ratio,
        width: currentView.printArea.width / ratio,
        height: currentView.printArea.height / ratio,
        name: "designContainerGroup",
      })
      const designContainer = new Konva.Rect({
        x: 0,
        y: 0,
        width: currentView.printArea.width / ratio,
        height: currentView.printArea.height / ratio,
        name: "print_area_border_outer",
      })
      designContainerGroup.add(designContainer);
      designLayer.add(designContainerGroup);
      currentStage.add(designLayer);
      designLayer.batchDraw();
      designContainerGroup.clip({
        x: 0,
        y: 0,
        width: designContainerGroup.width(),
        height: designContainerGroup.height(),
      })
      resolve()
    })
  }
  async updateImage({container, nodeId = 0, src, callBack}) {
    changeNodeList = []
    this.editImgConteiner = container
    for(const view of this.productData.views) {
      const stage = this.stageObj[`stage${view.id}`]
      const layer = stage.findOne('.designLayer')
      layer.find('.designImg').forEach(node => {
        if (node.nodeIndex == nodeId) {
          changeNodeList.push({
            view: view,
            oldNode: node,
            oldNodeAttrs: JSON.parse(JSON.stringify(node.getAttrs())),
            oldNodeId: node.nodeIndex,
          })
        }
      })
    }
    let changeNode = changeNodeList.find(c => {return c.oldNodeId == nodeId})
    if(!this.stageObj[`updateImgStage`]) {
      await this.createStageForUpdateImage(changeNode.view.id)
    } else {
      this.destroyTransform({currentStage: this.stageObj[`updateImgStage`]})
    }
    this.stageObj[`updateImgStage`].findOne(".designLayer").find('.designImg').forEach(node => {
      if(node.getLayer().findOne(`.repeatImgGroup${node._id}`)) {
        node.getLayer().findOne(`.repeatImgGroup${node._id}`).destroy()
      }
      node.destroy()
    })
    let curNode = null
    await this.addImageForUpdateImage(0, changeNode.oldNode.getAttrs()).then((node: any) => {
      curNode = node
      if(!src) {
        this.drawRepeatType(
          node.getAttrs().tileType,
          node,
          node.getAttrs().spacingH,
          node.getAttrs().spacingV,
        )
      }
    })
    if(src) {
      //替换图片
      let galleryData = curNode.getAttrs().imageData
      await(() => {
        return new Promise<void>((resolve) => {
          const newImage = new Image()
          newImage.src = src
          newImage.crossOrigin = 'Anonymous'
          newImage.onload = async (img) => {
            galleryData.designImg3 = src
            galleryData.size = {
              width: newImage.width,
              height: newImage.height
            }
            resolve()
          }
        })
      })()
      await this.replaceImage(curNode, galleryData, changeNode.view.id, true, 2, null).then((node: any) => {
        curNode = node
        this.anchorGroupFourceupdate({ node, viewId: null });
      })
      await this.changeAllLayerImgForUpdateImage(true, galleryData)
    }
    callBack({node: curNode, canvasObj: this.viewImgObj})

  }
  updateText({nodeId = 0, text, callBack}) {
    for(const view of this.productData.views) {
      const stage = this.stageObj[`stage${view.id}`]
      const layer = stage.findOne('.designLayer')
      layer.find('.designText').forEach(node => {
        if (node.nodeIndex == nodeId) {
          this._updateText(node, text)
        }
      })
      this.cloneStage({ viewId: view.id });
    }
    callBack({canvasObj: this.viewImgObj})
  }
  async transformEndImage({callBack}) {
    await this.changeAllLayerImgForUpdateImage(false, null)
    callBack({canvasObj: this.viewImgObj})
  }
  async confirmUpdateImage({galleryArr, callBack}) {
    for(let item of this.productData.views) {
      const stage = this.stageObj[`stage${item.id}`]
      const layer = stage.findOne('.designLayer')
      for(let node of layer.find('.designImg')) {
        let galleryData = galleryArr.find(g => {return g.nodeId === node.nodeIndex})
        if (galleryData && node.nodeIndex === galleryData.nodeId) {
          //确认使用图片时，图片已上传至后台，可以使用图片滤镜
          await this.replaceImage(node, galleryData.galleryData, item.id, false, 1, null)
        }
      }
      this.cloneStage({ viewId: item.id });
    }
    callBack({canvasObj: this.viewImgObj})
  }
  async cancelUpdateImage({callBack}) {
    for(let item of changeNodeList) {
      const stage = this.stageObj[`stage${item.view.id}`]
      const layer = stage.findOne('.designLayer')
      for(let node of layer.find('.designImg')) {
        if (node.nodeIndex == item.oldNodeId) {
          await this.replaceImage(node, item.oldNodeAttrs.imageData, item.view.id, false, 1, item.oldNodeAttrs)
        }
      }
      await this.cloneStage({ viewId: item.view.id });
    }
    callBack({canvasObj: this.viewImgObj})
  }
  addImageForUpdateImage(viewId, recordData) {
    return new Promise<void>(resolve => {
      let currentStage = this.stageObj[`updateImgStage`];
      let designLayer = currentStage.findOne(".designLayer");
      let designContainerGroup = designLayer.findOne(".designContainerGroup");
      Konva.Image.fromURL(recordData.flipImgUrl, async (image) => {
        //保存记录还原、切换产品保留图片状态
        image.setAttrs(recordData);
        let recordDataLayerScale = recordData.layerScale || 1;
        const canvasRatio = (this.editImgConteiner.clientWidth / (600))
        image.scaleX(recordData.scaleX * canvasRatio);
        image.scaleY(recordData.scaleY * canvasRatio);
        // image.scaleX(imageWidth / ratio / image.width() * userScale.x);
        // image.scaleY(imageHeight / ratio / image.height() * userScale.y);
        image.x(this.editImgConteiner.clientWidth / (600) * image.x())
        image.y(this.editImgConteiner.clientWidth / (600) * image.y())

        image.offsetX(image.width() / 2);
        image.offsetY(image.height() / 2);

        image.setAttrs({
          stageWidth: this.editImgConteiner.clientWidth,
          layerScale: designLayer.scaleX()
        })
        if(recordData.isclip) await this.implementClip(image, recordData.flipImgUrl, recordData.clipData)
        designContainerGroup.add(image);

        
        // this.viewNodeObj[viewId].childrens.push({
        //   type: 'image',
        //   node: image,
        //   id: konvaId,
        //   isVagueData: picException.isVagueData,
        //   transformData: picException.transformData
        // })
        resolve(image)
        designLayer.batchDraw();
        this.addTransformer({ currentStage, node: image, viewId });
        image.on("transform dragmove", (e) => {
          this.anchorGroupFourceupdate({ node: e.target, viewId });
        })
      });
    })
  }
  async changeAllLayerImgForUpdateImage(isReplace, galleryData) {
    let index = 0
    for(let item of changeNodeList) {
        index ++;
        const stage = this.stageObj[`stage${item.view.id}`]
        const layer = stage.findOne('.designLayer')
        for(let node of layer.find('.designImg')) {
          if (node.nodeIndex == item.oldNodeId) {
              if (isReplace) { //替换图片
                  await this.replaceImage(node, galleryData, item.view.id, true, 1, null);
              } else {
                const updateImgLayer = this.stageObj[`updateImgStage`].findOne('.designLayer')
                const curNode = updateImgLayer.findOne('.designImg')
                this.diffViewTheSameDesign({
                  currentView: item.view,
                  associateProductView: item.view,
                  currentRecordData: curNode.getAttrs(),
                  associateNode: node,
                  type: 'image'
                })
                if(index == 1) { //updateImgStage 画布平铺
                  this.drawRepeatType(
                    curNode.getAttrs().tileType,
                    curNode,
                    curNode.getAttrs().spacingH,
                    curNode.getAttrs().spacingV,
                  )
                }
                //正常产品画布平铺
                await this.drawRepeatType(
                  node.getAttrs().tileType,
                  node,
                  node.getAttrs().spacingH,
                  node.getAttrs().spacingV,
                )
              }
          }
        }
        this.cloneStage({ viewId: item.view.id });
    }
}
  // async updateElement({ viewId, nodeList, callBack }) {
  //   this.viewId = viewId
  //   let picException = null
  //   for (let item of nodeList) {
  //     let oldNode = null
  //     for (let child of this.viewNodeObj[viewId].childrens) {
  //       if (child.id == item.nodeIndex) {
  //         oldNode = child.node
  //       }
  //     }
  //     if (item.type == 'image') {
  //       let galleryData = item.galleryData
  //       if(item.previewSrc) {
  //         await(() => {
  //           return new Promise<void>((resolve) => {
  //             const newImage = new Image()
  //             newImage.src = item.previewSrc
  //             newImage.crossOrigin = 'Anonymous'
  //             newImage.onload = async (img) => {
  //               galleryData.designImg3 = item.previewSrc
  //               galleryData.size = {
  //                 width: newImage.width,
  //                 height: newImage.height
  //               }
  //               resolve()
  //             }
  //           })
  //         })()
  //       }
  //       await this.updateImage(oldNode, galleryData, viewId, item.previewSrc ? true : false)
  //       picException = this.ncYSRemind({ node: oldNode })
  //     } else if (item.type == 'text') {
  //       this.updateText(oldNode, item.text)
  //     }
  //   }
  //   this.cloneStage({ viewId });
  //   let viewDesign = {}
  //   for (let item of this.viewImgObj) {
  //     if (item.id == viewId) {
  //       viewDesign = item.viewDesign
  //     }
  //   }
  //   callBack({
  //     src: viewDesign,
  //     picException
  //   })
  // }
  addImage({src, viewId, nodeId, callBack}) {
    let galleryData: ImageData = {
      width: 0,
      height: 0,
      size: {
        width: 0,
        height: 0,
      },
      code: '',
      designImg: '',
      designImg2: '',
      designImg3: '',
    }
    const newImage = new Image()
    newImage.src = src
    newImage.crossOrigin = 'Anonymous'
    newImage.onload = async (img) => {
      galleryData.designImg = src
      galleryData.designImg3 = src
      galleryData.size = {
        width: newImage.width,
        height: newImage.height
      }
      await this._addImage({
        imageData: galleryData,
        viewId,
        konvaId: nodeId
      })
      await this.cloneStage({ viewId })
      callBack(this.viewImgObj)
    }
  }
  // async restoreElement({ viewId }) {
  //   for(let view of this.productData.views) {
  //     if(view.id == viewId) {
  //       const stage = this.stageObj[`stage${view.id}`]
  //       const layer = stage.findOne('.designLayer')
  //       layer.find('.designImg').forEach(async node => {
  //         let galleryData = node.getAttrs().imageData
  //         await this.replaceImage(node, galleryData, viewId, false, 1, null)
  //       })
  //     }
  //   }
  //   // for (let child of this.viewNodeObj[viewId].childrens) {
  //   //   if (child.type == 'image') {
  //   //   }
  //   // }
  // }
  destroy() {
    this.isDestroy  =true
    for (let key in this.stageObj) {
      this.stageObj[key].destroy();
    }
    this.threeDApp.forEach(item => {
      item.drawApp.destroy();
      item.drawApp = null;
    })
    let controlImgCanvas = document.getElementById('controlImgCanvas')
    if(controlImgCanvas) {
      controlImgCanvas.parentNode.removeChild(controlImgCanvas)
    }
    document.body.removeChild(this.container)
  }
  private reCombinKonvaJson(saveData: Array<SaveData>, views: Array<View>) {
    return new Promise<void>(async (resolve) => {
      if (saveData.length) {
        let filterData = [],
          riskImg = 0;
          for (let item of saveData) {
          /**
           * 简版切换自定义底板，需要把当前模板通过getSaveData()存起来，getSaveData()取到的值已经过滤掉了风险词图片，这里即使风险词信息是空的也没影响
           * 重新打开这个模板的时候，image就会缺少风险词信息，isRisk()内部会报错，
           * 这里补上
           */
          if(item.image && !item.image.risk_gallery) { 
            item.image.risk_gallery = {}
            item.image.risk_gallery.risk = []
            item.image.risk_word = []
            item.konvaAttrs.imageData.risk_gallery = {}
            item.konvaAttrs.imageData.risk_gallery.risk = []
            item.konvaAttrs.imageData.risk_word = []
          }
          if (item['image'] && this.isRisk(item['image'])) {
            riskImg++;
          } else {
            filterData.push(item);
          }
        }
        if (riskImg > 0) {
          console.error('图片信息异常，无法使用')
        }
        saveData = filterData;
        if (saveData[0].konvaAttrs) {
          for (let item of saveData) {
            if (!this.konvaJson[item.view_id])
              this.konvaJson[item.view_id] = [];
            if (item.type == 'design') { //旧版图片翻转designImg2保存的是base64，跳到新版保存的时候要把base64删除，这里要加回上图片地址才能添加图片
              //item.konvaAttrs.imageData.designImg如果有值，就是从localStorage保存的noLoginDesign
              //如果没值就是从接口请求的模板来的
              if(!item.konvaAttrs.imageData.designImg) {
                item.konvaAttrs.imageData.designImg = item.image.designImg
                item.konvaAttrs.imageData.designImg2 = item.image.designImg2
                if(this.needDetailImg) {
                    item.konvaAttrs.imageData.designImg3 = item.image.designImg;
                } else {
                    item.konvaAttrs.imageData.designImg3 = item.image.designImg3;
                }
              }
            }
            this.konvaJson[item.view_id].push({ node: item.konvaAttrs, id: item.nodeId, item });
          }
          const _konvaJson = JSON.parse(JSON.stringify(this.konvaJson))
          // 模板，根据当前面重组数据结构
          if(views && views.length){
            for(let i=0; i<this.productData.views.length; i++){
              let curView = this.productData.views[i];
              if(!this.konvaJson[curView.id]) this.konvaJson[curView.id] = [];
              // 模板映射关系，单面应用到所有，多面按顺序
              let tempId = views.length===1 ? views[0].id : views[i]?.id;
              this.konvaJson[curView.id] = _konvaJson[tempId] ? JSON.parse(JSON.stringify(_konvaJson[tempId])) : [];
              this.konvaJson[curView.id].forEach(designAttrs => {
                this.diffViewTheSameDesign({
                  currentView: this.productData.views[i],
                  associateProductView: views.length===1 ? views[0] : views[i],
                  currentRecordData: designAttrs.node,
                  associateNodeAttrs: designAttrs.node,
                  fromCustomProducts: true, 
                  type: designAttrs.node.name.indexOf('designText')? 'text' : 'image'
                })
              })
            }
          }
          resolve()
        } else {
          await this.oldDataRestore(
            saveData,
            this.productData,
          ).then((newD: Array<SaveData>) => {
            for (let item of newD) {
              if (!this.konvaJson[item.view_id])
                this.konvaJson[item.view_id] = [];
              this.konvaJson[item.view_id].push({ node: item.konvaAttrs, id: item.id });
            }
            resolve()
          });
        }
      } else {
        resolve()
      }
    })
  }
  private oldDataRestore(data: Array<SaveData>, productData: ProductData) {
    for (let view of productData.views) {
      this.cacheProductPrintAreas.push({
        id: view.printArea.id, //打印区域id
        defaultViews: view.id,//默认哪一面
        printArea: view.printArea, //打印区域
        config: this.convertDefaultConfig({
          width: view.printArea.width,
          height: view.printArea.height,
        })
      });
    }
    return new Promise((resolve, reject) => {
      let promises = [];
      for (let item of data) {
        if (item.type == "design") {
          //图片
          if (this.isRisk(item.image)) {
            console.error('图片信息异常，无法使用')
          } else {
            promises.push(
              new Promise<void>((resolve, reject) => {
                Konva.Image.fromURL(
                  item.image.designImg3,
                  (image) => {
                    let ratio = 0;
                    for (let view of productData.views) {
                      if (view.id == item.view_id) {
                        ratio = view.width / 547;
                      }
                    }

                    let imgSize = this.imgSizeCalculate(
                      { size: item.image.size },
                      item.view_id,
                    );
                    let imgWidth = item.image.width, imgHeight = item.image.height;
                    if(item.image.isclip){
                      let {imgAttrs, pathAttrs} = item.image.clipData;
                      imgWidth = imgWidth * (pathAttrs.width * pathAttrs.scaleX) / (imgAttrs.width * imgAttrs.scaleX)
                      imgHeight = imgHeight * (pathAttrs.height * pathAttrs.scaleY) / (imgAttrs.height * imgAttrs.scaleY)
                    }
                    let aTransform = [];
                    for (let t of item.image.transform
                      .slice(7, item.image.transform.length - 1)
                      .split(",")) {
                      aTransform.push(parseFloat(t));
                    }
                    image.scaleX(aTransform[0]);
                    image.scaleY(aTransform[3]);
                    image.x(
                      item.image.offset_x / ratio + (imgWidth / ratio * image.scaleX()) / 2
                    );
                    image.y(
                      item.image.offset_y / ratio + (imgHeight / ratio * image.scaleY()) / 2
                    );
                    image.name("design designImg");
                    image.addName(`design${image._id}`);
                    image.addName(`${item.image.isBg == 1 ? "isBg" : ""}`);
                    image.setAttrs({
                      stageWidth: 547,
                      draggable: true,
                      tileType: item.image.tileType,
                      spacingH: item.image.hspacing,
                      spacingV: item.image.vspacing,
                      xFlip: item.image.xFlip,
                      yFlip: item.image.yFlip,
                      rotation: item.image.rotate,
                      flipImgUrl: item.image.designImg3,
                      maxImgSize: imgSize.viewerSize,
                      imageData: Object.assign(item.image, {
                        code: item.image.gallery_id
                      }),
                      render_id: item.image.render_id || '',
                      rendercode: item.image.rendercode || '',
                      historyId: image._id,
                    });
                    if(item.image.isclip){
                      image.setAttrs({
                        isclip: item.image.isclip,
                        clipData: item.image.clipData
                      })
                    }
                    let nodeAttrs = JSON.parse(
                      JSON.stringify(image.getAttrs())
                    );
                    delete nodeAttrs.image;
                    item.konvaAttrs = nodeAttrs;
                    resolve();
                  }
                );
              })
            );
          }
        } else if (item.type == "text") {
          let textStr = [],
            textData = item.text.tspans[0];
          for (let span of item.text.tspans) {
            textStr.push(span.content);
          }
          let label = new Konva.Label({
            name: "design designText",
          });
          item.konvaAttrs = Object.assign(label.getAttrs(), {
            designText: textStr.join("\n"),
            designFill: item.text.textBg,
            proStrokeWidth: parseFloat(item.text.strokeWidth),
            proStroke: item.text.stroke,
            textColor: textData.fill,
            proFontFamily: textData.pFontFamily
              ? textData.pFontFamily.slice(1, -1)
              : textData.fontFamily.slice(1, -1),
            proFontSize: textData.fontSize,
            proFontStyle: "",
            proTextDecoration: "",
            textAlign: textData.textAnchor,
            stageWidth: 547,
            strokeValue: item.text.strokeValue,
            oldData: true,
            historyId: label._id
          });
        } else if (item.type == "bgColor") {
          item.konvaAttrs = { name: "bgRect design", fill: item.color.value };
        }
      }
      Promise.all(promises).finally(() => {
        resolve(data);
      });
    });
  }
  private async addElement() {
    for (let item of this.productData.views) {
      if (this.konvaJson[item.id]) {
        //保存记录还原
        for (let konva of this.konvaJson[item.id]) {
          const node = konva.node
          if (node.name.indexOf("designImg") != -1) {
            if (this.isRisk(node.imageData)) {
              console.error("图片信息异常，无法使用")
            } else {
              node.flipImgUrl = node.imageData.designImg3;
              await this._addImage({
                imageData: node.imageData,
                viewId: item.id,
                recordData: node,
                isSetBg: node.name.indexOf("isBg") > -1,
                // bgApplyAllView: node.name.indexOf("bgApplyAllView") > -1,
                konvaId: konva.id,
                nodeItem: konva.item
              }).then(async (data: any) => {
                // this.nodeArr.push({type: 'image', node: data, id: konva.id})
                await this.drawRepeatType(
                  data.getAttrs().tileType,
                  data,
                  data.getAttrs().spacingH,
                  data.getAttrs().spacingV,
                )
              })
            }
          } else if (node.name.indexOf("designText") != -1) {
            if (node.oldData) {
              //旧设计器文字还原，只需要把文字还原到初始位置
              await this.addText({
                textNode: node,
                viewId: item.id,
                konvaId: konva.id,
              })
              // .then((data) => {
              //     this.nodeArr.push({type: 'text', node: data, id: konva.id})
              // })
            } else {
              await this.addText({
                viewId: item.id,
                recordData: node,
                konvaId: konva.id,
              })
              // .then((data) => {
              //     this.nodeArr.push({type: 'text', node: data, id: konva.id})
              // })
            }
          } else if (node.name.indexOf("bgRect") != -1) {
            this.addBgColor({
              color: node.fill,
              viewId: item.id,
              konvaId: konva.id,
            })
            // .then((data) => {
            //     this.nodeArr.push({type: 'bgColor', node: data, id: konva.id})
            // })
          }
        }
      }
      await this.cloneStage({ viewId: item.id });
    }
  }
  private _addImage({
    imageData,
    viewId,
    isSetBg = false,
    // bgApplyAllView = false,
    recordData = null,
    konvaId = 0,
    nodeItem = null
  }) {
    return new Promise((resolve, reject) => {
      if(this.isDestroy) return
      let currentStage = this.stageObj[`stage${viewId}`];
      let designLayer = currentStage.findOne(".designLayer");
      let designRect = designLayer.findOne(".print_area_border_outer");
      let designContainerGroup = designLayer.findOne(".designContainerGroup");
      let ratio = designLayer.getAttrs().ratio;
      let imageWidth = 0,
        imageHeight = 0;
      let imgUrl = recordData ? recordData.flipImgUrl : imageData.designImg3;
      Konva.Image.fromURL(imgUrl, async (image) => {
        let imgSize = this.imgSizeCalculate(imageData, viewId);
        imageWidth = imgSize.width;
        imageHeight = imgSize.height;

        if (recordData) {
          //保存记录还原、切换产品保留图片状态
          image.setAttrs(recordData);
          image.setAttrs({
            widthMM: imageWidth,
            heightMM: imageHeight,
          });
          image.name(`design designImg design${image._id} template`)
          let recordDataLayerScale = recordData.layerScale || 1;
          // let userScale = {
          //   x: recordData.initScaleX ? recordData.scaleX / recordData.initScaleX : recordData.scaleX,
          //   y: recordData.initScaleY ? recordData.scaleY / recordData.initScaleY : recordData.scaleY
          // }
          const canvasRatio = (this.containerWidth / (100));
          // // image.scaleX(imageWidth / ratio / image.width() * userScale.x);
          // // image.scaleY(imageHeight / ratio / image.height() * userScale.y);
          // image.scaleX(recordData.scaleX * canvasRatio);
          // image.scaleY(recordData.scaleY * canvasRatio);

          let aTransform = [];
          for (let t of nodeItem.image.transform
            .slice(7, nodeItem.image.transform.length - 1)
            .split(",")) {
            aTransform.push(parseFloat(t));
          }
          let saveWHMM = {
              w: (imageWidth * aTransform[0]),
              h: (imageHeight * aTransform[3])
          }
          if(imageWidth != nodeItem.image.width || imageHeight != nodeItem.image.height) {
              saveWHMM.w = (parseFloat(nodeItem.image.width)) * aTransform[0]
              saveWHMM.h = (parseFloat(nodeItem.image.height)) * aTransform[3]
          }
          image.scaleX(saveWHMM.w / recordData.ratio / (image.width()) * canvasRatio);
          image.scaleY(saveWHMM.h / recordData.ratio / (image.height()) * canvasRatio);
          image.x(this.containerWidth / (recordData.stageWidth / recordDataLayerScale) * image.x())
          image.y(this.containerWidth / (recordData.stageWidth / recordDataLayerScale) * image.y())
          
          if(this.associateProductView != null) {
            // const associateProductView = {
            //   width: 400,
            //   height: 400,
            //   printArea: {
            //     width: 280,
            //     height: 400,
            //     offset_x: 60,
            //     offset_y: 0
            //   }
            // }
            // const currentProductView = {
            //   width: 226,
            //   height: 226,
            //   printArea: {
            //     height: 176.28,
            //     offset_x: 0,
            //     offset_y: 24.86,
            //     width: 226
            //   }
            // }
            const currentProductView = this.productData.views.filter(item => {
              return item.id == viewId
            })[0]
            // const canvasRatio = (this.containerWidth / (recordData.stageWidth / recordDataLayerScale))
            // const associateProductViewRatio = (this.associateProductView.width / (recordData.stageWidth / recordDataLayerScale))
            // const twoViewOffsetXDistance = (this.associateProductView.printArea.offset_x - this.currentProductView.printArea.offset_x * (this.associateProductView.width / this.currentProductView.width))
            // const twoViewOffsetYDistance = (this.associateProductView.printArea.offset_y - this.currentProductView.printArea.offset_y * (this.associateProductView.width / this.currentProductView.width))
            // image.scaleX(recordData.scaleX * canvasRatio);
            // image.scaleY(recordData.scaleY * canvasRatio);
            // image.x((recordData.x + (twoViewOffsetXDistance / associateProductViewRatio)) * canvasRatio)
            // image.y((recordData.y + (twoViewOffsetYDistance / associateProductViewRatio)) * canvasRatio)

            this.diffViewTheSameDesign({
              currentView: currentProductView,
              associateProductView: this.associateProductView,
              currentRecordData: recordData,
              associateNode: image,
              type: 'image'
            })
          }

          image.offsetX(image.width() / 2);
          image.offsetY(image.height() / 2);
        } else {
          image.setAttrs({
            scaleX: imageWidth / ratio / image.width(),
            scaleY: imageHeight / ratio / image.height(),
          })
          image.x(designRect.width() / 2);
          image.y(image.height() * image.scaleY() / 2);
          image.offsetX(image.width() / 2);
          image.offsetY(image.height() / 2);
          image.name(`design designImg design${image._id} template`);
          this.imgMaximization({ viewId, flag: "imgFull", node: image }) //默认最大化铺满
          //图片 清晰度 饱和度  亮度 对比度 色温 色差
          let colorAjustmentData = {
            definition: 0,
            saturation: 0,
            brightness: 0,
            contrast: 0,
            colorTemp: 0,
            hue: 0,
          };
          image.setAttrs({
            maxImgSize: imgSize.viewerSize, //保存最大尺寸 单位mm
            imageData: imageData,
            widthMM: imageWidth,
            heightMM: imageHeight,
            opacity: 1,
            tileType: "",
            spacingH: 0,
            spacingV: 0,
            flipImgUrl: imageData.designImg3,
            xFlip: false,
            yFlip: false,
            filterType: "",
            colorAjustmentData: colorAjustmentData,
            historyId: image._id,
          });
        }
        image.setAttrs({
          initScaleX: imageWidth / ratio / image.width(),
          initScaleY: imageHeight / ratio / image.height(),
          draggable: true
        })
        if (isSetBg) {
          image.addName("isBg");
          // if (bgApplyAllView) {
          //   image.addName("bgApplyAllView");
          // }
        }
        image.nodeIndex = konvaId
        if(recordData && recordData.isclip){
          await this.implementClip(image, imgUrl, recordData.clipData)
        }
        
        designContainerGroup.add(image);
        
        if(!this.needDetailImg) { //给官网用只需要合图。不需要判断是否模糊
          let picException = this.ncYSRemind({ node: image })
          image.picException = picException
        }
        
        // this.viewNodeObj[viewId].childrens.push({
        //   type: 'image',
        //   node: image,
        //   id: konvaId,
        //   isVagueData: picException.isVagueData,
        //   transformData: picException.transformData
        // })
        resolve(image)
        designLayer.batchDraw();
      });
    });
  }
  private addText({
    textNode = null,
    viewId,
    recordData = null,
    konvaId = 0
  }) {
    return new Promise(async (resolve, reject) => {
      if(this.isDestroy) return
      /*等待字体加载完成*/
      await loadFont(recordData.proFontFamily)
      let curS = this.getCurStageLayer({ viewId });
      let layer = curS.layer;
      let designContainerGroup = curS.designContainerGroup;
      let text = null;
      let textGroup = null,
        textRect = null;
      if (recordData) {
        if (!recordData.scaleX) {
          recordData.scaleX = 1;
          recordData.scaleY = 1;
        }
        text = new Konva.Text({
          text: recordData.designText,
          fontSize: recordData.proFontSize, //画布缩放，保持文字在屏幕上大小
          fill: recordData.textColor,
          wrap: "char",
          fontFamily: recordData.proFontFamily,
          fontStyle: recordData.proFontStyle,
          textDecoration: recordData.proTextDecoration,
          strokeWidth: recordData.proStrokeWidth,
          stroke: recordData.proStroke,
          verticalAlign: "bottom",
          align: recordData.textAlign
        });
        textGroup = new Konva.Group();
        textGroup.name(`design designText design${textGroup._id} template`);
        let recordDataLayerScale = recordData.layerScale || 1;

        let scaleRatio = this.containerWidth / recordData.stageWidth;
        recordData.scaleX =
          (recordData.scaleX * scaleRatio * recordDataLayerScale) /
          layer.scaleX();
        recordData.scaleY =
          (recordData.scaleY * scaleRatio * recordDataLayerScale) /
          layer.scaleX();
        textGroup.setAttrs(recordData);
        textGroup.label = ClearBr({
          str: text.text(),
          type: 3,
        });
        textGroup.strokeValue = recordData.strokeValue;
        textGroup.x(
          (scaleRatio * recordDataLayerScale * textGroup.x()) / layer.scaleX()
        );
        textGroup.y(
          (scaleRatio * recordDataLayerScale * textGroup.y()) / layer.scaleX()
        );
        if(this.associateProductView != null) {
          const currentProductView = this.productData.views.filter(item => {
            return item.id == viewId
          })[0]
          // const canvasRatio = (this.containerWidth / (recordData.stageWidth / recordDataLayerScale))
          // const associateProductViewRatio = (this.associateProductView.width / (recordData.stageWidth / recordDataLayerScale))
          // const twoViewOffsetXDistance = (this.associateProductView.printArea.offset_x - this.currentProductView.printArea.offset_x * (this.associateProductView.width / this.currentProductView.width))
          // const twoViewOffsetYDistance = (this.associateProductView.printArea.offset_y - this.currentProductView.printArea.offset_y * (this.associateProductView.width / this.currentProductView.width))
          // textGroup.x((recordData.x + (twoViewOffsetXDistance / associateProductViewRatio)) * canvasRatio)
          // textGroup.y((recordData.y + (twoViewOffsetYDistance / associateProductViewRatio)) * canvasRatio)

          this.diffViewTheSameDesign({
            currentView: currentProductView,
            associateProductView: this.associateProductView,
            currentRecordData: recordData,
            associateNode: textGroup,
            type: 'text'
          })
        }
        textRect = new Konva.Rect({
          width: text.width(),
          height: text.height(),
          listening: false,
          strokeScaleEnabled: false,
          fill: recordData.designFill,
        });
        textGroup.add(textRect);
        textGroup.add(text);
      }
      textGroup.nodeIndex = konvaId
      designContainerGroup.add(textGroup);

      
      layer.batchDraw();
      // this.viewNodeObj[viewId].childrens.push({
      //   type: 'text',
      //   node: textGroup,
      //   id: konvaId,
      // })
      resolve(textGroup);
    });
  }
  private addBgColor({ color, viewId, konvaId = 0 }) {
    return new Promise((resolve) => {
      if(this.isDestroy) return
      let curS = this.getCurStageLayer({ viewId });
      let layer = curS.layer;
      let designContainerGroup = curS.designContainerGroup;
      let bgRect = null;
      if (layer.findOne(".bgRect")) {
        if (!color || color == "transparent") {
          layer.findOne(".bgRect").destroy();
        } else {
          layer.findOne(".bgRect").fill(color);
        }
      } else {
        bgRect = new Konva.Rect({
          x: 0,
          y: 0,
          width: layer.findOne(".print_area_border_outer").width(),
          height: layer.findOne(".print_area_border_outer").height(),
          fill: color,
          name: "bgRect design template",
          listening: false,
        });
        bgRect.addName(`design${bgRect._id}`);
        designContainerGroup.add(bgRect);
        bgRect.moveToBottom();
        bgRect.nodeIndex = konvaId
      }
      layer.batchDraw()
      
      // this.viewNodeObj[viewId].childrens.push({
      //   type: 'bgColor',
      //   node: layer.findOne(".bgRect"),
      //   id: konvaId,
      // })
      resolve(layer.findOne(".bgRect"))
    })
  }
  imgMaximization({ viewId, flag, node }) {
    let curS = this.getCurStageLayer({ viewId });
    let designRect = curS.designRect;
    node.rotation(0);
    let designRectWidth = designRect.width(),
      designRectHeight = designRect.height();
    var widthScale = designRectWidth / node.width();
    var heightScale = designRectHeight / node.height();
    var scale = Math.max(Math.abs(widthScale), Math.abs(heightScale));
    let scaleX = widthScale, scaleY = heightScale

    if (flag == "widthMaximization") {
      scaleX = widthScale;
      scaleY = widthScale
    } else if (flag == "heightMaximization") {
      scaleX = heightScale;
      scaleY = heightScale
    } else if (flag == "imgFull") {
      scaleX = scale;
      scaleY = scale
    } else if (flag == "restore") {
      scaleX = node.getAttrs().initScaleX;
      scaleY = node.getAttrs().initScaleY
    }

    if (flag == "widthMaximization") {
      scale = widthScale;
    } else if (flag == "heightMaximization") {
      scale = heightScale;
    }

    node.scaleX(scaleX);
    node.scaleY(scaleY);

    node.x(designRectWidth / 2);
    node.y(designRectHeight / 2);
  }
  private drawRepeatType(
    type: string,
    node: any,
    spacingH: number,
    spacingV: number,
  ) {
    return new Promise<void>((resolve, reject) => {
      if(this.isDestroy) return
      node.setAttrs({
        tileType: type,
        spacingH: spacingH,
        spacingV: spacingV,
      });
      let layer = node.getLayer();
      const currentStage = node.getStage()
      let designContainerGroup = currentStage.findOne(".designContainerGroup");
      if (!type) {
        if (currentStage.findOne(`.repeatImgGroup${node._id}`)) {
          node.moveTo(designContainerGroup);
          node.zIndex(
            currentStage.findOne(`.repeatImgGroup${node._id}`).getZIndex()
          );
          currentStage.findOne(`.repeatImgGroup${node._id}`).destroy();
          layer.batchDraw();
        }
        resolve();
        return;
      }

      let rotateNodePoint = this.getRotateNodePoint({
        node: node,
        layer,
      });
      let canvas = document.createElement("canvas");
      canvas.width = currentStage.findOne(".print_area_border_outer").width() * 3;
      canvas.height = currentStage
        .findOne(".print_area_border_outer")
        .height() * 3;
      let width = Math.abs(node.width() * node.scaleX()) * 3, //放大三倍 解决模糊问题
        height = Math.abs(node.height() * node.scaleY()) * 3;
      let context = canvas.getContext("2d");
      // let src = node.toDataURL()
      let img = new Image();
      img.setAttribute("crossOrigin", "anonymous");
      img.src = node.getAttrs().flipImgUrl;
      // img.src = node.toDataURL()
      img.onload = function () {
        let ratio = layer.getAttrs().ratio;
        let spacingHMM = spacingH / ratio * 3; //后端mm计算，单位换算mm
        let spacingVMM = spacingV / ratio * 3; //后端mm计算，单位换算mm
        let JQspacingH = spacingHMM / 2;
        let JQspacingV = spacingVMM / 2;
        let canvasTemp = document.createElement("canvas");
        let contextTemp = canvasTemp.getContext("2d");
        if (type == "basicsTile") {
          canvasTemp.width = (width + spacingHMM);
          canvasTemp.height = (height + spacingVMM);

          contextTemp.save();
          contextTemp.drawImage(img, JQspacingH, JQspacingV, width, height);
          contextTemp.restore();

          contextTemp.save();
          contextTemp.drawImage(
            img,
            width + 3 * JQspacingH,
            JQspacingV,
            width,
            height
          );
          contextTemp.restore();

          contextTemp.save();
          contextTemp.drawImage(
            img,
            JQspacingH,
            height + 3 * JQspacingV,
            width,
            height
          );
          contextTemp.restore();

          contextTemp.save();
          contextTemp.drawImage(
            img,
            width + 3 * JQspacingH,
            height + 3 * JQspacingV,
            width,
            height
          );
          contextTemp.restore();
        } else if (type == "Mirror") {
          // node.to({
          //   scaleX: -Math.abs(node.scaleX()),
          //   scaleY: -Math.abs(node.scaleY()),
          // })
          canvasTemp.width = (width + spacingHMM) * 2;
          canvasTemp.height = (height + spacingVMM) * 2;

          contextTemp.save();
          contextTemp.drawImage(
            img,
            canvasTemp.width / 2 + JQspacingH,
            canvasTemp.height / 2 + JQspacingV,
            width,
            height
          );
          contextTemp.restore();

          contextTemp.save();
          contextTemp.scale(-1, 1);
          contextTemp.drawImage(
            img,
            -canvasTemp.width / 2 + JQspacingH,
            canvasTemp.height / 2 + JQspacingV,
            width,
            height
          );
          contextTemp.restore();

          contextTemp.save();
          contextTemp.scale(1, -1);
          contextTemp.drawImage(
            img,
            canvasTemp.width / 2 + JQspacingH,
            -canvasTemp.height / 2 + JQspacingV,
            width,
            height
          );
          contextTemp.restore();

          contextTemp.save();
          contextTemp.scale(-1, -1);
          contextTemp.drawImage(
            img,
            -canvasTemp.width / 2 + JQspacingH,
            -canvasTemp.height / 2 + JQspacingV,
            width,
            height
          );
          contextTemp.restore();
        } else if (type == "XSpacedTile") {
          canvasTemp.width = (width + spacingHMM) * 2;
          canvasTemp.height = (height + spacingVMM) * 2;

          contextTemp.save();
          contextTemp.drawImage(img, -width / 2, JQspacingV, width, height);
          contextTemp.restore();

          contextTemp.save();
          contextTemp.drawImage(
            img,
            width / 2 + 2 * JQspacingH,
            JQspacingV,
            width,
            height
          );
          contextTemp.restore();

          contextTemp.save();
          contextTemp.drawImage(
            img,
            1.5 * width + 4 * JQspacingH,
            JQspacingV,
            width,
            height
          );
          contextTemp.restore();

          contextTemp.save();
          contextTemp.drawImage(
            img,
            JQspacingH,
            height + 3 * JQspacingV,
            width,
            height
          );
          contextTemp.restore();

          contextTemp.save();
          contextTemp.drawImage(
            img,
            width + 3 * JQspacingH,
            height + 3 * JQspacingV,
            width,
            height
          );
          contextTemp.restore();
        } else if (type == "YSpacedTile") {
          canvasTemp.width = (width + spacingHMM) * 2;
          canvasTemp.height = (height + spacingVMM) * 2;

          contextTemp.save();
          contextTemp.drawImage(
            img,
            JQspacingH,
            -0.5 * height,
            width,
            height
          );
          contextTemp.restore();

          contextTemp.save();
          contextTemp.drawImage(
            img,
            JQspacingH,
            0.5 * height + 2 * JQspacingV,
            width,
            height
          );
          contextTemp.restore();

          contextTemp.save();
          contextTemp.drawImage(
            img,
            JQspacingH,
            1.5 * height + 4 * JQspacingV,
            width,
            height
          );
          contextTemp.restore();

          contextTemp.save();
          contextTemp.drawImage(
            img,
            width + 3 * JQspacingH,
            JQspacingV,
            width,
            height
          );
          contextTemp.restore();

          contextTemp.save();
          contextTemp.drawImage(
            img,
            width + 3 * JQspacingH,
            height + 3 * JQspacingV,
            width,
            height
          );
          contextTemp.restore();
        }
        let pattern = context.createPattern(canvasTemp, "repeat");
        // let a = Math.sin(image.attrs.rotation * (Math.PI / 180)) * canvas.width
        // let b = Math.cos(image.attrs.rotation * (Math.PI / 180)) * canvas.width
        // let i = b / 2
        // let j = a / 2
        // console.log('sss', i, j)
        let r = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)) / 2; //图片中心点绕圆旋转的半径
        let oringAngle = Math.atan(height / width); //两个图片中心点的初始角度
        let tansAngle = (node.rotation() * Math.PI) / 180 + oringAngle; //旋转后两个图片中心点的角度
        //兼容火狐
        let svgM = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg"
        );
        let matrix = svgM.createSVGMatrix();
        // let tramsform = new Konva.Transform()
        // let matrix = tramsform.getMatrix();
        pattern.setTransform(
          matrix
            // .transform(node.scaleX() > 0 ? 1 : -1, 0, 0, node.scaleY() > 0 ? 1 : -1, 0, 0)
            .translate(rotateNodePoint.VCenter * 3, rotateNodePoint.HCenter * 3) //平移到旋转点
            // .translate(rotateNodePoint.VStart, rotateNodePoint.HStart) //平移到旋转点
            // .scaleNonUniform(node.scaleX() > 0 ? 1 : -1, node.scaleY() > 0 ? 1 : -1) //镜像翻转
            .translate(r * Math.cos(tansAngle), r * Math.sin(tansAngle)) //让两个图片中心点的重合
            .rotate(node.rotation()) //平移后再旋转
            .translate(spacingHMM * 0.5, spacingVMM * 0.5)
        );

        // context.setTransform(image.getTransform().m.join(','))
        context.fillStyle = pattern;
        context.fillRect(0, 0, canvas.width, canvas.height);

        let base = canvas.toDataURL("image/png", 1.0);

        let repeatImg = new Image();
        repeatImg.src = base;
        repeatImg.onload = function () {
          if (currentStage.findOne(`.repeatImgGroup${node._id}`)) {
            node.moveTo(designContainerGroup);
            node.zIndex(
              currentStage.findOne(`.repeatImgGroup${node._id}`).getZIndex()
            );
            currentStage.findOne(`.repeatImgGroup${node._id}`).destroy();
          }
          //有选中平铺效果
          let images = new Konva.Image({
            x: 0,
            y: 0,
            image: repeatImg,
            name: `repeatImg${node._id}`,
            scaleX: 1 / 3,
            scaleY: 1 / 3
          });
          let group = new Konva.Group({
            x: 0,
            y: 0,
            name: `repeatImgGroup repeatImgGroup${node._id}`,
          });
          designContainerGroup.add(group);
          group.add(images);
          group.zIndex(node.getZIndex());
          node.moveTo(group);
          layer.batchDraw();
          resolve();
        };
      };
    });
  }
  private async cloneStage({
    viewId,
    cloneViewLength = 0
  }) {
    return new Promise(async resolve => {
      if(this.isDestroy) return
      for (let item of this.viewImgObj) {
        if (item.id == viewId) {
          let curS = this.getCurStageLayer({ viewId });
          let designContainerGroup = curS.designContainerGroup.clone();
  
          designContainerGroup.findOne(".print_area_border_outer").destroy()
  
          let printArea = null,
            productView = null;
          for (let view of this.productData.views) {
            if (view.id == viewId) {
              productView = view;
              printArea = view.printArea;
            }
          }
          item.viewDesign = designContainerGroup.toDataURL({
            mimeType: "image/png",
            quality: 1,
            x: designContainerGroup.x(),
            y: designContainerGroup.y(),
            width: designContainerGroup.width(),
            height: designContainerGroup.height(),
          });
          item.viewDesignCanvas = designContainerGroup.toCanvas({
            x: 0,
            y: 0,
            width: this.containerWidth,
            height: this.containerWidth,
          })
          designContainerGroup.destroy()
        }
      }
      if(!this.needDetailImg) {  //简版不需要细节图，官网商品详情切模板需要细节图
        resolve('')
        return
      }
      // let canSetViewDesigns = false;
      // if (cloneViewLength) { 
      //   this.cloneViewLength += 1;
      //   // let viewsLength = 0;
      //   // if (hasBg) {
      //     //   viewsLength = this.productData.views.length - 1;
      //   // } else {
      //     //   viewsLength = this.productData.views.length;
      //   // }
      //   if (cloneViewLength == this.cloneViewLength) {
      //     canSetViewDesigns = true;
      //   }
      // } else {
      //   canSetViewDesigns = true;
      // }
      this.cloneViewLength += 1
      if (this.cloneViewLength == this.productData.views.length) {
        let imgList = []
        for(let index of this.indexList) {
          let colors = null
          if(this.curColorId) {
            colors = this.productData.colors.find(item => item.id == this.curColorId);
          } else { //只选主图
            colors = this.productData.colors[0]
          }
          await this.updateCurrentDetail(index, colors).then(imgObj => {
            imgList.push(imgObj)
          });
        }
        this.detailImgList = imgList
        resolve('')
        this.cloneViewLength = 0;
      } else {
        resolve('')
      }
    })
  }
  updateCurrentDetail(index, colors) {
    return new Promise(async (resolve, reject) => {
      if(this.isDestroy) return
      let detail:any
        if (!colors.detail) {
          if(index == "master") {
            detail = colors.views[0]
          } else {
            detail = colors.views[index]
          }
        } else {
          if(index == "master") {
            const detailIndex = colors.detail.findIndex(item => item.master === 1)
            if(detailIndex != -1) {
              detail = colors.detail[detailIndex]
            } else {
              detail = colors.detail[0]
            }
          } else {
            detail = colors.detail[index]
          }
        }
        let detailObj: any = {}
        if(detail.isUserDefined == 1) { //自定义底板
          detailObj.boardArr = []
          detailObj.baseWidth = detail.base_width
          detailObj.boardImg = ''
          for(let de of detail.detail) {
            detailObj.boardArr.push({
              maskImg: de.texture,
              image: de.image,
              bgColor: de.bgColor,
              type: de.parts ? de.parts[0].type : null,
              transform: de.transform,
              left: 0,
              top: 0,
              width: detail.base_width,
              height: detail.base_width,
              radius: 0,
              isText: de.type == 3 ? true : false,
              detail: de,
              layoutId: de.layoutId
              // parts: de.parts
            })
          }
        }
        if (this.productData.hasDetail) {
          if(detail.isUserDefined == 1) {
            let i = 0
              for(let de of detail.detail) {
                if(de.type == 1 || de.type == 2) { //底板类型 1: 底板图  2：底板模型 4: 背景图
                  if(de.parts) {
                    await this.createDetailCanvas({
                      detailImg: de,
                      baseWidth: detail.base_width,
                      renderIndex: index,
                      borderIndex: i
                    }).then((imgObj: any) => {
                      detailObj.boardArr[i].canvasImgArr = imgObj.canvasArr
                    })
                  }
                } 
                i += 1
              }
              await this.drawBoardImg({
                detailImages: detailObj,
                baseWidth: detail.base_width,
              })
              resolve({isUserDefined: 1, boardImg: detailObj.boardImg});
          } else {
            this.createDetailCanvas({
              detailImg: detail,
              baseWidth: this.productData.base_width,
              renderIndex: index
            }).then((imgObj) => {
              resolve(imgObj);
            });
          }
        } else {
          for (let item of this.viewImgObj) {
            if (item.id == detail.id) {
              let curS = this.getCurStageLayer({ viewId: detail.id });
              let layer = curS.layer;
              let designContainerGroup = curS.designContainerGroup.clone();

              designContainerGroup.findOne(".print_area_border_outer").destroy()

              let ratio = layer.getAttrs().ratio;
              let printArea = null,
                productView = null;
              for (let view of this.productData.views) {
                if (view.id == detail.id) {
                  productView = view;
                  printArea = view.printArea;
                }
              }
              let pixelRatio = 700 / (this.containerWidth / layer.scaleX()); //细节图大图width: 700
              if (
                // productView.pointoutPrintAreas &&
                // productView.pointoutPrintAreas.soft_svg &&
                printArea &&
                printArea.soft_svg
              ) {
                await (() => {
                  return new Promise<void>((resolve, reject) => {
                    designContainerGroup.clipFunc((ctx) => {
                      ctx.save();
                      ctx.translate(
                        -designContainerGroup.x(),
                        -designContainerGroup.y()
                      );
                      ctx.scale(1 / ratio, 1 / ratio);
                      new Konva.Path({
                        data: printArea.soft_svg,
                        stroke: "",
                        strokeWidth: 1,
                        // name: "auxiliaryPath pointoutPrint-area",
                      })._sceneFunc(ctx);
                      ctx.restore();
                      resolve();
                    });
                    let canvas = designContainerGroup.toCanvas()
                    designContainerGroup._drawChildren(
                      "drawScene",
                      canvas,
                      "top"
                    );
                  });
                })();
              }
              let src = designContainerGroup.toDataURL({
                x: 0,
                y: 0,
                pixelRatio,
                width: (this.containerWidth / layer.scaleX()),
                height: (this.containerWidth / layer.scaleX()),
                // pixelRatio: 1200 / (layerBg.width()*layer.scaleX())
              })
              designContainerGroup.destroy()
              if(detail.isUserDefined == 1) {
                let i = 0
                for(let item of detail.detail) {
                  detailObj.boardArr[i].canvasImgArr = [src]
                  // this.$set(detailImages[colorId][index].boardArr[i], "canvasImgArr", [src]);
                  i += 1
                }
                await this.drawBoardImg({
                  detailImages: detailObj,
                  baseWidth: detail.base_width
                })
                resolve({isUserDefined: 1, boardImg: detailObj.boardImg})
              } else {
                resolve({image: detail.image, maskImg: detail.texture, canvasArr: [src]});
              }
            }
          }
        }
    });
  }
  createDetailCanvas({
    detailImg,
    baseWidth,
    renderIndex,
    borderIndex = null
  }) {
    return new Promise((resolve, reject) => {
      if(this.isDestroy) return
      let imgObj: {image: string, maskImg: string, canvasArr: Array<string>} = {image: detailImg.image, maskImg: detailImg.texture, canvasArr: []}
      let parts = detailImg.parts;
      // 所有异步处理数组
      let canvasImgArr: Array<string> = [];
      let promises = [];
      let threeDetailFlag = false; //3D图是否渲染完
      for (let part of parts) {
        if (part.type == 0) {
          //画布图
          for (let item of this.viewImgObj) {
            if (item.id == part.target_view_id) {
              let canvasConfig = part.canvas_config;
              let views = this.getViews(part.target_view_id);
              const promise = this.initCanvas(
                canvasConfig,
                item.viewDesign,
                views.printArea,
                part.mask.image_url,
                views
              ).then((src: string) => {
                canvasImgArr.push(src);
              });

              promises.push(promise);
              break;
            }
          }
        } else if (part.type == 1) {
          //遮罩图
          // let img =
          // '<img class="visualization-mask" src="' +
          // part.cover_img.image_url +
          // '">';
          // visualizationCanvas.append(img);
          imgObj.maskImg =
            part.cover_img.image_url;
        } else if (part.type == 2) {
          if(part.detail3D) { //兼容模型被删除的情况
            //3D图
            if (threeDetailFlag) continue; //3D所有part效果合成一张
            threeDetailFlag = true;
            const promise = this.create3DDetail(
              detailImg,
              baseWidth,
              renderIndex,
              borderIndex
            ).then((src: string) => {
              canvasImgArr.push(src);
            });
            promises.push(promise);
          }
        }
      }
      Promise.all(promises).finally(() => {
        imgObj.canvasArr = canvasImgArr
        resolve(imgObj);
      });
    });
  }
  initCanvas(canvasConfig, src: string, printArea, clipImg, views) {
    return new Promise((resolve, reject) => {
      if(this.isDestroy) return
      let canvas = document.createElement("canvas");
      //后台基于600px计算
      canvas.width = 600;
      canvas.height = 600;
      let count = 10;
      let ctx = canvas.getContext("2d");
      let dots = [];
      let dotscopy, idots;
      let img = new Image();
      img.setAttribute("crossOrigin", "anonymous");
      img.src = src;
      let img2;
      if (clipImg) {
        img2 = new Image();
        img2.setAttribute("crossOrigin", "anonymous");
        img2.src = clipImg;
      }

      let WIDTH = parseInt(((printArea.width / printArea.viewWidth) * 600).toString());
      let HEIGHT = parseInt(((printArea.height / printArea.viewWidth) * 600).toString());
      let meshObj = zw_Mesh2D.createMapMesh(
        WIDTH,
        HEIGHT,
        FISH_DIV,
        FISH_DIV_h
      );

      img.onload = function () {
        let img_w = WIDTH;
        let img_h = HEIGHT;
        let left = parseInt(((printArea.offset_x / printArea.viewWidth) * 600).toString());
        let top =
          parseInt(((printArea.offset_y / printArea.viewWidth) * 600).toString()) || 0.5;
        dots = [
          {
            x: left,
            y: top,
          },
          {
            x: left + img_w,
            y: top,
          },
          {
            x: left + img_w,
            y: top + img_h,
          },
          {
            x: left,
            y: top + img_h,
          },
        ];
        //保存一份不变的拷贝
        dotscopy = [
          {
            x: left,
            y: top,
          },
          {
            x: left + img_w,
            y: top,
          },
          {
            x: left + img_w,
            y: top + img_h,
          },
          {
            x: left,
            y: top + img_h,
          },
        ];
        meshObj.move(left, top);
        if (canvasConfig) {
          dots = JSON.parse(canvasConfig);
        }
        render();
      };

      function render() {
        let srcCorners;
        let dstCorners;
        let perspT;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        srcCorners = [
          dotscopy[0].x,
          dotscopy[0].y,
          dotscopy[1].x,
          dotscopy[1].y,
          dotscopy[2].x,
          dotscopy[2].y,
          dotscopy[3].x,
          dotscopy[3].y,
        ];

        dstCorners = [
          dots[0].x,
          dots[0].y,
          dots[1].x,
          dots[1].y,
          dots[2].x,
          dots[2].y,
          dots[3].x,
          dots[3].y,
        ];
        /* 透视变化矩阵计算 */
        perspT = zw_PerspT(srcCorners, dstCorners);
        for (let i = 0; i < meshObj.points.length; i++) {
          let newPoint = perspT.transform(
            meshObj.points[i].x,
            meshObj.points[i].y
          );
          meshObj.points[i].x = newPoint[0];
          meshObj.points[i].y = newPoint[1];
        }
        /**
         * 兼容Safari
         * 在Safari使用globalCompositeOperation，会使浏览器绘图阻塞导致卡顿
         * 解决办法：在有透明颜色的时候才使用此属性
         */
        // if(_this.hasOpacity({viewId: _this.viewId})) {
        //   ctx.globalCompositeOperation = "destination-atop";
        // }
        if (
          navigator.userAgent
            .toLowerCase()
            .match(/version\/([\d.]+).*safari/) == null
        ) {
          ctx.globalCompositeOperation = "destination-atop";
        } else {
          ctx.globalCompositeOperation = "lighter";
        }
        meshObj.drawImageToContext(img, ctx);
        // ctx.drawImage(img, 0, 0)

        if (clipImg) {
          if (img2.complete) {
            maskImg();
            createCanvasImage();
          } else {
            img2.onload = function () {
              maskImg();
              createCanvasImage();
            };
          }
        } else {
          createCanvasImage();
        }
      }

      function createCanvasImage() {
        let src = canvas.toDataURL("image/png", 1.0);
        // canvasImage.attr("src", src);
        resolve(src);
      }

      function maskImg() {
        ctx.save();
        //重新画的时候找个属性要去掉，不然都是已找个属性是操作
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(img2, 0, 0, 600, 600);
        ctx.restore();
      }
    });
  }
  async create3DDetail(
    detailImg,
    baseWidth,
    renderIndex,
    borderIndex
  ) {
    let _this = this;
    // 图片尺寸
    const canvasSize = 600;
    // 模型数据
    const modelOptions = detailImg.parts;
    let faceListMap = {};
    for (let item of this.viewImgObj) {
      faceListMap[item.id] = item.viewDesignCanvas;
    }
    const modelNum = modelOptions.length;
    let modelNumTotal = modelNum;
    for (let app of this.threeDApp) {
      modelNumTotal += app.modelNum;
    }
    // 内存最大模型数量
    const modelLimit = 10;
    let excessNum = modelNumTotal - modelLimit;
    if (excessNum >= 0) {
      for (let i = 0; i < this.threeDApp.length; i++) {
        const app = this.threeDApp[i];
        excessNum -= app.modelNum;
        let drawApp = app.drawApp;
        drawApp.destroy();
        drawApp = null;
        this.threeDApp.splice(i, 1);
        i--;
        if (excessNum <= 0) break;
      }
    }
    let code = ''
    if(this.curColorId) {
      code = this.productData.code + "-" + this.curColorId + '-' + renderIndex + '-' + borderIndex
    } else {
      code = this.productData.code + "-" + renderIndex + '-' + borderIndex
    }
    let drawApp = null
    for (let app of this.threeDApp) {
      if (app.code == code) {
        drawApp = app.drawApp;
        break;
      }
    }
    return new Promise((resolve, reject) => {
      if(this.isDestroy) return
      if(drawApp) {
        drawApp.updateFaceListMap(faceListMap, (src) => {
          resolve(src);
        });
      } else {
        const drawApp = new composeDetail3D({
          baseWidth: baseWidth,
          canvasSize,
          modelOptions,
          faceListMap,
          canvas: null,
          container: null,
          partIds: this.partCheckedList,
          type: 5,
          callBack(src) {
            resolve(src);
            if(_this.curColorId) { //商品详情页，细节图new一张可以删一张，因为不需要再用到了
              setTimeout(() => {
                drawApp.destroy();
              }, 0);
            }
          },
        });
        if(!this.curColorId) {
          this.threeDApp.push({ code, drawApp, modelNum });
        }
      }
    });
  }
  getViews(viewId: number) {
    var views: View;
    for (var i = 0; i < this.productData.views.length; i++) {
      if (this.productData.views[i].id == viewId) {
        views = this.productData.views[i];
        break;
      }
    }

    return views;
  }
  async drawBoardImg({
    detailImages, 
    baseWidth,
  }) {
    let canvas = document.createElement('canvas')
    canvas.width = baseWidth
    canvas.height = baseWidth
    let ctx = canvas.getContext('2d')
    for(let item of detailImages.boardArr) {
      if(item.detail.type == 5) break //type=5 布局
      ctx.save()
      if(!item.bgColor && !item.isText) {
        const layoutIndex = detailImages.boardArr.findIndex(b => {return b.detail.type == 5}) //存在布局
        if(layoutIndex != -1) {
          for(let layout of detailImages.boardArr[layoutIndex].detail.layoutData) {
            if(layout.layoutId == item.layoutId) {
              this.radiusRect(parseFloat(layout.x), parseFloat(layout.y), parseFloat(layout.width), parseFloat(layout.height), parseFloat(layout.radius), ctx)
              ctx.clip()
            }
          }
        }
      }
      if(!item.transform) item.transform = "matrix(1,0,0,1,0,0)" //背景色没传矩阵
      let m = item.transform.substring(7, item.transform.length -1).split(',')
      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5])
      if(item.bgColor) {
        ctx.fillStyle = item.bgColor
        ctx.fillRect(item.left, item.top, item.width, item.height);
      }else if(item.isText) {
        await this.drawText({data: item.detail, ctx})
      }else {
        
        if(item.image) {
          await this.drawImage({url: item.image, data: item, ctx})
        }
        if(item.canvasImgArr) {
          for(let canvasimg of item.canvasImgArr) {
            await this.drawImage({url: canvasimg, data: item, ctx})
          }
        }
        if(item.maskImg) {
          await this.drawImage({url: item.maskImg, data: item, ctx})
        }
      }
      ctx.restore()
    }
    detailImages.boardImg = canvas.toDataURL()
  }
  radiusRect(left, top, width, height, r, ctx){
    const pi = Math.PI;
    ctx.beginPath();
    ctx.arc(left + r, top + r, r, - pi, -pi / 2);
    ctx.arc(left + width - r, top + r, r, -pi / 2, 0);
    ctx.arc(left + width - r, top + height - r, r, 0, pi / 2);
    ctx.arc(left + r, top + height - r, r, pi / 2, pi);
    ctx.closePath();
      
  }
  drawImage({url, data, ctx}) {
    return new Promise<void>((resolve, reject) => {
      if(this.isDestroy) return
      let img = new Image()
      img.src = url
      img.setAttribute("crossOrigin", "anonymous");
      img.onload = () => {
        // ctx.save()
        // let m = data.nodeTransform.m
        // console.log('item.nodeTransform.m.slice(',')', data.nodeTransform.m.join(','))
        // ctx.rect(layout.left, layout.top, layout.width, layout.height)
        
        // ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5])
        ctx.drawImage(img, 0, 0, data.width, data.height)
        // ctx.restore()
        resolve()
      }
      img.onerror = () => {
        reject()
      }
    })
  }
  drawText({
    data,
    ctx
  }) {
    return new Promise<void>(async (resolve) => {
      if(this.isDestroy) return
      // let canvas = document.createElement('canvas')
      // canvas.width = baseWidth
      // canvas.height = baseWidth
      // let ctx = canvas.getContext('2d')
      // let m = data.transform.substring(7, data.transform.length -1).split(',')
      // ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5])
      /*等待所有字体加载完成*/
      await loadFont(data.tspans[0].pFontFamily)
      ctx.textAlign = data.tspans[0].textAnchor
      ctx.fillStyle = data.tspans[0].fill;
      ctx.strokeStyle = data.strokeValue;
      ctx.font = `${data.tspans[0].fontSize} ${data.tspans[0].fontFamily}`
      ctx.lineWidth = data.strokeWidth
      ctx.lineJoin = 'round'
      data.tspans.map((item, i) => {
        ctx.fillText(item.content, item.x, item.y)
        if(parseFloat(data.strokeWidth)) {
          ctx.strokeText(item.content, item.x, item.y);
        }
      })
      // ctx.restore()
      // console.log('&&&&&', detailImages[colorId][renderIndex].boardArr[boardIndex])
      // this.$set(
      //   detailImages[colorId][renderIndex].boardArr[boardIndex],
      //   "canvasImgArr",
      //   [canvas.toDataURL()]
      // );
      resolve()
    })
  }
  private flipImage({ data, node, viewId, isReduction = false, isClick = false }) {
    return new Promise<void>((resolve, reject) => {
      if(this.isDestroy) return
      const _this = this;
      let width = node.width(),
        height = node.height();
      let nodeAttrs = node.getAttrs();
      if(nodeAttrs.isclip){
        let {imgAttrs, pathAttrs} = nodeAttrs.clipData;
        width = width * (imgAttrs.width * imgAttrs.scaleX) / (pathAttrs.width * pathAttrs.scaleX);
        height = height * (imgAttrs.height * imgAttrs.scaleY) / (pathAttrs.height * pathAttrs.scaleY);
      }
      let canvas = document.createElement("canvas");
      canvas.width = width; //解决翻转后图片放大会模糊的问题
      canvas.height = height;
      let context = canvas.getContext("2d");

      let image = new Image();
      image.setAttribute("crossOrigin", "anonymous");
      image.src = node.getAttrs().flipImgUrl;
      image.onload = function () {
        if (data.data == "leftRightMirror") {
          if (isClick) {
            node.setAttrs({
              xFlip: node.getAttrs().xFlip ? false : true,
            });
          }
          context.scale(-1, 1);
          context.drawImage(
            image,
            -canvas.width,
            0,
            canvas.width,
            canvas.height
          );
        } else if (data.data == "upDownMirror") {
          if (isClick) {
            node.setAttrs({
              yFlip: node.getAttrs().yFlip ? false : true,
            });
          }
          context.scale(1, -1);
          context.drawImage(
            image,
            0,
            -canvas.height,
            canvas.width,
            canvas.height
          );
        }
        let url = canvas.toDataURL();
        let flipImg = new Image();
        flipImg.onload = function () {
          node.image(flipImg);
          let imageData = JSON.parse(JSON.stringify(node.getAttrs().imageData))
          imageData.designImg = url
          imageData.designImg3 = url
          node.setAttrs({ flipImgUrl: url, imageData });

          resolve();
          if (isReduction) return; //记录还原
          node.getLayer().batchDraw();
          // if (node.type == 'image') {
          _this
            .drawRepeatType(
              node.getAttrs().tileType,
              node,
              node.getAttrs().spacingH,
              node.getAttrs().spacingV,
            )
            .then(() => {
              _this.cloneStage({ viewId });
            });
          // } else {
          //   _this.cloneStage({ viewId });
          // }
        };
        flipImg.src = url;
      };
    });
  }
  private changeImageFilter(data) {
    return new Promise((resolve, reject) => {
      if(this.isDestroy) return
      let { render_code, params, node } = data;
      if (render_code) {
        axios
          .get(`${requestReferer}/v1/Render/${render_code}`, {
            params: params
          })
          .then((res: any) => {
            if (res.data.code == 'success') {
              node.setAttrs({ filterType: render_code, rendercode: render_code, render_id: res.data.data.render_id });
              resolve(res.data);
            }
          })
      } else {
        node.setAttrs({ filterType: '', rendercode: '', render_id: '' });
        resolve(null);
      }
    })
  }
  private replaceFilter({ viewId = this.viewId, node, url }) {
    return new Promise((resolve, reject) => {
      if(this.isDestroy) return
      let curS = this.getCurStageLayer({ viewId })
      let designLayer = curS.layer
      let newImage = new Image();
      newImage.src = url;
      newImage.crossOrigin = 'Anonymous';
      newImage.onload = async () => {
        let oldImgData = {
          width: node.width(),
          height: node.height()
        }
        const nodeAttrs = node.getAttrs();
        if(nodeAttrs.isclip){
          const {imgAttrs, pathAttrs} = nodeAttrs.clipData;
          oldImgData.width = oldImgData.width * (imgAttrs.width * imgAttrs.scaleX) / (pathAttrs.width * pathAttrs.scaleX);
          oldImgData.height = oldImgData.height * (imgAttrs.height * imgAttrs.scaleY) / (pathAttrs.height * pathAttrs.scaleY);
        }
        node.image(newImage);
        node.setAttrs({
          flipImgUrl: url,
          scaleX: node.scaleX() / (newImage.width / oldImgData.width), //为了清晰度新增了designimg3 1200px，滤镜接口没改，返回的图片是800，这里要重新计算缩放
          scaleY: node.scaleY() / (newImage.height / oldImgData.height),
          initScaleX: node.getAttrs().widthMM / designLayer.getAttrs().ratio / newImage.width,
          initScaleY: node.getAttrs().heightMM / designLayer.getAttrs().ratio / newImage.height,
          offsetX: newImage.width / 2,
          offsetY: newImage.height / 2
        });
        designLayer.batchDraw();
        resolve({ node, curS, viewId })
      }
    })
  }
  private replaceImage(oldNode = null, galleryData: ImageData, viewId: number, isPreview: boolean, type, oldNodeAttrs) {
    return new Promise((resolve) => {
      if(this.isDestroy) return
      const _this = this;
      const currentStage = type == 1 ? this.stageObj[`stage${viewId}`] : this.stageObj[`updateImgStage`];
      const designLayer = currentStage.findOne(".designLayer");
      const ratio = designLayer.getAttrs().ratio;
      const nodeAttrs = oldNode.getAttrs();
      const imageData = galleryData
      const imgSize = this.imgSizeCalculate(imageData, viewId);
      const imageWidth = imgSize.width || 0;
      const imageHeight = imgSize.height || 0;
      let oldImgWidth = oldNode.width() * oldNode.scaleX();
      let oldImgHeight = oldNode.height() * oldNode.scaleY();
      if(nodeAttrs.isclip){
        let {imgAttrs, pathAttrs} = nodeAttrs.clipData;
        oldImgWidth = oldImgWidth * (imgAttrs.width * imgAttrs.scaleX) / (pathAttrs.width * pathAttrs.scaleX);
        oldImgHeight = oldImgHeight * (imgAttrs.height * imgAttrs.scaleY) / (pathAttrs.height * pathAttrs.scaleY);
      }
      const oldMaxLength = oldImgWidth > oldImgHeight ? oldImgWidth : oldImgHeight;
      const newMaxLength = imageWidth > imageHeight ? imageWidth : imageHeight;
      const replaceScale = oldMaxLength / (newMaxLength / ratio);
      const newImage = new Image();
      newImage.src = imageData.designImg3;
      newImage.crossOrigin = 'Anonymous';
      newImage.onload = async () => {
        oldNode.image(newImage);
        // oldNode.width(imageWidth / ratio);
        // oldNode.height(imageHeight / ratio);
        if(isPreview) { //替换图片走这里
          oldNode.scaleX(replaceScale * (imageWidth / ratio / newImage.width));
          oldNode.scaleY(replaceScale * (imageHeight / ratio / newImage.height));
          oldNode.offsetX(newImage.width / 2);
          oldNode.offsetY(newImage.height / 2);
        }
        oldNode.setAttrs({
          flipImgUrl: imageData.designImg3
        })
        if(oldNodeAttrs) {
          oldNode.scaleX(oldNodeAttrs.scaleX);
          oldNode.scaleY(oldNodeAttrs.scaleY);
          oldNode.x(oldNodeAttrs.x);
          oldNode.y(oldNodeAttrs.y);
          oldNode.rotation(oldNodeAttrs.rotation);
        }
        if(!isPreview) { //图片预览，图片还没上传至后台，attrs里面的imageData需要是旧值，以便还原
          oldNode.scaleX(oldImgWidth / newImage.width);
          oldNode.scaleY(oldImgHeight / newImage.height);
          oldNode.offsetX(newImage.width / 2);
          oldNode.offsetY(newImage.height / 2);
          oldNode.setAttrs({
            initScaleX: imageWidth / ratio / newImage.width,
            initScaleY: imageHeight / ratio / newImage.height,
            widthMM: imageWidth,
            heightMM: imageHeight,
            maxImgSize: imgSize.viewerSize,
            imageData: imageData,
            // 如果旧图是张渲染图片，则去除渲染效果
            // filterType: '',
            // rendercode: '',
            // render_id: ''
          });
        }
        // 是否背景图，如果是背景图片则铺满
        // if(nodeAttrs.name.indexOf('isBg') > -1){
        //   await _this.imgMaximization({viewId, flag: 'imgFull', node: oldNode});
        // }
        if (nodeAttrs.xFlip) {
          await _this.flipImage({
            data: { data: "leftRightMirror" },
            node: oldNode,
            viewId,
            isReduction: true,
          });
          oldNode.setAttr('xFlip', true);
        }
        if (nodeAttrs.yFlip) {
          await _this.flipImage({
            data: { data: "upDownMirror" },
            node: oldNode,
            viewId: viewId,
            isReduction: true,
          });
          oldNode.setAttr('yFlip', true);
        }
        // 保持原图的滤镜效果
        if (!isPreview && nodeAttrs.render_id) {
          let filterRet: any = await _this.changeImageFilter({
            node: oldNode,
            render_code: nodeAttrs.rendercode,
            params: {
              gallery_id: imageData.code,
              xFlip: nodeAttrs.xFlip ? 1 : 0,
              yFlip: nodeAttrs.yFlip ? 1 : 0
            }
          });
          if (filterRet && filterRet.data && filterRet.data.url2) {
            await _this.replaceFilter({
              url: filterRet.data.url2,
              viewId,
              node: oldNode
            });
          }
        }
        if(nodeAttrs.isclip){
          await this.implementClip(oldNode, oldNode.getAttrs().flipImgUrl, nodeAttrs.clipData)
        }
        await this.drawRepeatType(
          oldNode.getAttrs().tileType,
          oldNode,
          oldNode.getAttrs().spacingH,
          oldNode.getAttrs().spacingV,
        );
        resolve(oldNode)
      }
    })
  }
  private _updateText(oldNode = null, text: string) {
    let textNode = oldNode.findOne("Text");
    textNode.text(text.trim());
    oldNode.width(textNode.width());
    oldNode.height(textNode.height());
    oldNode.offsetX(textNode.width() / 2);
    oldNode.offsetY(textNode.height() / 2);
    oldNode.findOne("Rect").width(textNode.width());
    oldNode.findOne("Rect").height(textNode.height());
    // oldNode.fire("click");
    // layer.batchDraw();
    // oldNode.getLayer().batchDraw();
    oldNode.label = ClearBr({
      str: oldNode.findOne("Text").text(),
      type: 3,
    });
    // this.setLayerImgList({
    //   viewId: this.viewId,
    //   node: oldNode,
    //   isAdd: false,
    //   type: "text",
    // });
  }
  public addTemplate({templateData: templateData, indexList, colorId, callBack}) { //替换模板
    if(indexList) { //官网商品详情需要展示所有细节图
      this.indexList = indexList
      this.curColorId = colorId
    }
    changeNodeList = []
    let promises = []
    this.deleteTemplateNode({viewId: null, callBack: null})
    this.konvaJson = {}
    this.reCombinKonvaJson(templateData.cfg, templateData.views)
    // for (let item of this.productData.views) {
    //   // await this.createStage(item)
    // }
    promises.push(this.addElement())
    Promise.all(promises).then(async () => {
      if(this.useType == 1) {
        callBack(this.viewImgObj)
      } else {
        if(indexList) {
          let canvasImgArr = []
          for(let item of this.detailImgList) {
            if(item.isUserDefined) { //自定义底板是画好一整张图
              canvasImgArr.push(item.boardImg)
            } else {
              let canvas = document.createElement('canvas')
              canvas.width = 600
              canvas.height = 600
              let context = canvas.getContext('2d')
              await this.imageOnload(item.image, context)
              for(let src of item.canvasArr) {
                await this.imageOnload(src, context)
              }
              await this.imageOnload(item.maskImg, context)
              canvasImgArr.push(canvas.toDataURL())
            }
          }
          callBack(canvasImgArr)
        } else {
          for(let item of this.detailImgList) {
            let canvas = document.createElement('canvas')
            canvas.width = 600
            canvas.height = 600
            let context = canvas.getContext('2d')
            context.fillStyle = 'rgba(0,0,0,.04)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            await this.imageOnload(item.image, context)
            for(let src of item.canvasArr) {
              await this.imageOnload(src, context)
            }
            await this.imageOnload(item.maskImg, context)
            item.image = ''
            item.maskImg = ''
            item.canvasArr = [canvas.toDataURL()]
          }
          callBack(this.detailImgList)
        }
      }
    })
  }
  imageOnload(src, ctx) {
    return new Promise(resolve => {
      if(src != '') {
        const image = new Image()
        image.src = src
        image.setAttribute("crossOrigin", "anonymous")
        image.onload = function(e) {
          if(ctx) {
            ctx.drawImage(image, 0, 0, 600, 600)
          }
          resolve('')
        }
        image.onerror = function () {
          resolve('')
        }
      } else {
        resolve('')
      }
    })
  }
  async getDetailImage({indexList, colorId, callBack}) {
    this.indexList = indexList
    this.curColorId = colorId
    for(let view of this.productData.views) {
      await this.cloneStage({viewId: view.id})
    }
    let canvasImgArr = []
    for(let item of this.detailImgList) {
      if(item.isUserDefined) { //自定义底板是画好一整张图
        canvasImgArr.push(item.boardImg)
      } else {
        let canvas = document.createElement('canvas')
        canvas.width = 600
        canvas.height = 600
        let context = canvas.getContext('2d')
        await this.imageOnload(item.image, context)
        for(let src of item.canvasArr) {
          await this.imageOnload(src, context)
        }
        await this.imageOnload(item.maskImg, context)
        canvasImgArr.push(canvas.toDataURL())
      }
    }
    callBack(canvasImgArr)
  }
  diffViewTheSameDesign({currentView, associateProductView, currentRecordData, associateNode = null, associateNodeAttrs = null, fromCustomProducts = false, type = "image"}) {
    let recordDataLayerScale = currentRecordData.layerScale || 1;
    const currentProductView = currentView

    // fromCustomProducts 从定制产品来，无需再算一遍canvasRatio，只需要算不同面印刷区域的差异，因为从定制产品来后面还需要执行addImage会计算canvasRatio
    const canvasRatio = fromCustomProducts ? 1 : (this.containerWidth / (currentRecordData.stageWidth))
    const associateProductViewRatio = (associateProductView.width / (currentRecordData.stageWidth / recordDataLayerScale))
    const twoViewOffsetXDistance = (associateProductView.printArea.offset_x - currentProductView.printArea.offset_x * (associateProductView.width / currentProductView.width))
    const twoViewOffsetYDistance = (associateProductView.printArea.offset_y - currentProductView.printArea.offset_y * (associateProductView.width / currentProductView.width))
    const attrs = {
      scaleX: type == 'text' ? currentRecordData.scaleX : currentRecordData.scaleX * canvasRatio,
      scaleY: type == 'text' ? currentRecordData.scaleY : currentRecordData.scaleY * canvasRatio,
      x: (currentRecordData.x + (twoViewOffsetXDistance / associateProductViewRatio)) * canvasRatio,
      y: (currentRecordData.y + (twoViewOffsetYDistance / associateProductViewRatio)) * canvasRatio,
      rotation: currentRecordData.rotation,
      spacingH: (currentProductView.width / associateProductView.width) * currentRecordData.spacingH,
      spacingV: (currentProductView.height / associateProductView.height) * currentRecordData.spacingV
    }
    
    if(associateNode) {
      associateNode.setAttrs({
        scaleX: attrs.scaleX,
        scaleY: attrs.scaleY,
        x: attrs.x,
        y: attrs.y,
        rotation: attrs.rotation
      })
    } else if(associateNodeAttrs) {
      associateNodeAttrs.scaleX = attrs.scaleX
      associateNodeAttrs.scaleY = attrs.scaleY
      associateNodeAttrs.x = attrs.x
      associateNodeAttrs.y = attrs.y
      associateNodeAttrs.rotation = attrs.rotation
      associateNodeAttrs.ratio = associateProductView.width / 100
      associateNodeAttrs.spacingH = attrs.spacingH
      associateNodeAttrs.spacingV = attrs.spacingV
    }
  }
  private ncYSRemind({ node }) {
    if(!node.getLayer()) return //destroy后没有Layer了
    const layerAttrs = node.getLayer().getAttrs()
    const scaleX = Math.abs(node.scaleX()),
      scaleY = Math.abs(node.scaleY());
    let maxImgSize = node.getAttrs().maxImgSize;
    let newImgWidth = node.width() * scaleX * layerAttrs.ratio,
      newImgHeight = node.height() * scaleY * layerAttrs.ratio;
    let isVagueData: PictureException = {
      text: '',
      title: '',
      bgColor: '',
      type: 0
    },
      transformData: PictureException = {
        text: '',
        title: '',
        bgColor: '',
        type: 0
      };
    //放大程度
    if (
      newImgWidth > maxImgSize.width ||
      newImgHeight > maxImgSize.height
    ) {
      var magnificationW = newImgWidth / maxImgSize.width;
      var magnificationH = newImgHeight / maxImgSize.height;
      var magnificationMax = Math.max(magnificationW, magnificationH);
      if (magnificationMax > 1.01 && magnificationMax <= 1.5) {
        isVagueData.text = "图片像素不足放大，轻微影响生产印刷清晰度！";
        isVagueData.title = "图片轻微模糊";
        isVagueData.bgColor = "#f5cf52";
        isVagueData.type = 1;
      } else if (magnificationMax > 1.5 && magnificationMax <= 2) {
        isVagueData.text = "图片像素不足放大，比较影响生产印刷清晰度！";
        isVagueData.title = "图片比较模糊";
        isVagueData.bgColor = "#ff9902";
        isVagueData.type = 2;
      } else if (magnificationMax > 2) {
        isVagueData.text = "图片像素不足放大，严重影响生产印刷清晰度！";
        isVagueData.title = "图片严重模糊";
        isVagueData.bgColor = "#fe2c25";
        isVagueData.type = 3;
      }
    }
    //变形程度
    var oriWHRatio = maxImgSize.width / maxImgSize.height;
    var nowWHRatio = newImgWidth / newImgHeight;
    var defRatio: number;
    if (oriWHRatio > nowWHRatio) {
      defRatio = oriWHRatio / nowWHRatio;
    } else {
      defRatio = nowWHRatio / oriWHRatio;
    }
    if (defRatio >= 1.09 && defRatio < 1.5) {
      transformData.text =
        "图片拉伸变形指数1-1.5倍，请注意已经导致图案变形！";
      transformData.title = "图片轻微变形";
      transformData.bgColor = "#f5cf52";
      transformData.type = 1;
    } else if (defRatio >= 1.5 && defRatio < 2) {
      transformData.text =
        "图片拉伸变形指数1.5-2倍，请注意已经导致图案变形！";
      transformData.title = "图片比较变形";
      transformData.bgColor = "#ff9902";
      transformData.type = 2;
    } else if (defRatio >= 2) {
      transformData.text = "图片拉伸变形指数2倍以上，请注意图案变形严重！";
      transformData.title = "图片严重变形";
      transformData.bgColor = "#fe2c25";
      transformData.type = 3;
    }
    return { isVagueData, transformData }
  }
  private textAttrToLabel({ node }) {
    let layer = node.getLayer();
    let nodeAttr = JSON.parse(JSON.stringify(node.getAttrs()));
    let text = node.findOne("Text");
    nodeAttr.designText = text.text();
    (nodeAttr.designFill = node.findOne("Rect").fill()),
      (nodeAttr.proStrokeWidth = text.strokeWidth());
    nodeAttr.proStroke = text.stroke();
    nodeAttr.textColor = text.fill();
    nodeAttr.proFontFamily = text.fontFamily();
    nodeAttr.proFontSize = text.fontSize();
    // nodeAttr.canvasFontSize =
    //   (text.fontSize() * layer.scaleX()) / (stage.width() / 547.2);
    nodeAttr.proFontStyle = text.fontStyle();
    nodeAttr.proTextDecoration = text.textDecoration();
    nodeAttr.textAlign = text.align();
    nodeAttr.stageWidth = this.containerWidth * layer.scaleX();
    nodeAttr.layerScale = layer.scaleX();
    nodeAttr.strokeValue = node.strokeValue;
    return nodeAttr;
  }
  public getSaveData({isSaveProduct = true, callBack}) {
    this.imgFullAllDesign()
    let productConfig = this.getProductConfiguration({ viewId: this.viewId, isSaveProduct });
    productConfig.is_overspread = this.saveProductObj.is_overspread;
    productConfig.is_vague = this.saveProductObj.is_vague;
    let cfgs = productConfig.cfgs || [];
    for (let i = 0; i < cfgs.length; i++) {
      let cfg = cfgs[i];
      if (cfg.type == "design") {
        cfg.image.designImg2 = "";
      }
    }
    callBack(productConfig)
  }
  private deleteTemplateNode({viewId, callBack}){
    /**
     * viewId：简版自定义底板，可以删除已添加的图片，故传viewid删除当前面的图片
     * callBack：简版选择自定义底板需要删除掉之前选中的底板，返回空白的canvas
     */
    let keyArr = []
    for(let key in this.stageObj){
      if(viewId && `stage${viewId}` === key) {
        keyArr.push(key)
        break
      }
      if(!viewId) {
        keyArr.push(key)
      }
    }
    keyArr.forEach(key => {
      let designLayer = this.stageObj[key].findOne('.designLayer');
      designLayer.find('.design').forEach(node => {
        node.destroy();
        designLayer.find(`.repeatImgGroup${node._id}`).destroy();
      })
    })
    if(callBack) {
      this.productData.views.forEach(async (item) => {
        await this.cloneStage({viewId: item.id})
      })
      callBack(this.viewImgObj)
    }
  }
  private imgFullAllDesign() {
    // let _this = this;

    return new Promise<void>((resolve, reject) => {
      let productConfig = this.getProductConfiguration();
      let viewIdLength = this.productData.views.length;
      let vagueDesignId = [],
        vagueDesignName = [];
      // let xhtml = "";
      // if (this.productData.imgFull == 1 && viewIdLength > 1) {
      //   //全幅产品，并且大于1面需要提示用户没有设计完
      //   let viewIdList = [];
      //   for (let item of productConfig.cfgs) {
      //     if (viewIdList.indexOf(item.view_id) == -1) {
      //       viewIdList.push(item.view_id);
      //     }
      //   }
      //   if (viewIdList.length != viewIdLength) {
      //     let noDesignName = [];
      //     for (let item of this.productData.views) {
      //       if (viewIdList.indexOf(item.id) == -1) {
      //         noDesignName.push(`${item.name.substr(0, 1)}`);
      //       }
      //     }
      //     xhtml += `<li>
      //               共有<strong>${viewIdLength}</strong>个设计面，其中<strong>${noDesignName.join(
      //       "、"
      //     )}</strong>面未设计
      //               </li>`;
      //   }
      // }

      let overspreadObj = {};
      let copyCfgs = JSON.parse(JSON.stringify(productConfig.cfgs));
      for (let i = 0; i < viewIdLength; i++) {
        let viewId = this.productData.views[i].id,
          viewName = this.productData.views[i].name;
        let layer = this.getCurStageLayer({ viewId }).layer;
        let printAreaRect = layer.findOne(".print_area_border_outer");

        //图片像素不足放大，图片模糊
        // if (this.viewNodeObj[viewId]) {
          // if (
          //   this.viewNodeObj[viewId].childrens.some((im) => {
          //     return im.isVagueData && im.isVagueData.text;
          //   })
          // ) {
          //   vagueDesignId.push(viewId);
          // }
          // }
        layer.find('.designImg').forEach(node => {
          if(node.picException.isVagueData && node.picException.isVagueData.text) {
            vagueDesignId.push(viewId);
          }
        })
        for (let img of layer.find(".designImg")) {
          if (img.visible()) {
            // if (vagueDesignId.indexOf(viewId) == -1) {
            //   //图片像素不足放大，图片模糊
            //   for (let layer of this.layerImgList) {
            //     if (
            //       layer.childrens.some((im) => {
            //         return im.isVagueData && im.isVagueData.text;
            //       })
            //     ) {
            //       vagueDesignId.push(viewId);
            //     }
            //   }
            // }

            if (this.productData.imgFull == 1) {
              //全幅产品，设计未铺满设计区域
              let rotateNodePoint = this.getRotateNodePoint({
                node: img,
                layer,
              });
              let minX = rotateNodePoint.VStart,
                minY = rotateNodePoint.HStart,
                maxX = rotateNodePoint.VEnd,
                maxY = rotateNodePoint.HEnd;
              if (overspreadObj[viewId] == undefined) {
                overspreadObj[viewId] = {
                  viewName: viewName,
                  leftNum: minX,
                  topNum: minY,
                  rightNum: maxX,
                  bottomNum: maxY,
                  printAreaWidth: printAreaRect.width(),
                  printAreaHeight: printAreaRect.height(),
                };
              }

              let cfgsIndex = copyCfgs.findIndex((item) => {
                return item.view_id == viewId;
              });
              if (
                cfgsIndex != -1 &&
                (copyCfgs[cfgsIndex].type == "bgColor" ||
                  (copyCfgs[cfgsIndex].image &&
                    copyCfgs[cfgsIndex].image.tileType != ""))
              ) {
                overspreadObj[viewId].leftNum = 0;
                overspreadObj[viewId].topNum = 0;
                overspreadObj[viewId].rightNum = printAreaRect.width();
                overspreadObj[viewId].bottomNum = printAreaRect.height();
              }

              if (minX < overspreadObj[viewId].leftNum) {
                overspreadObj[viewId].leftNum = minX;
              }
              if (minY < overspreadObj[viewId].topNum) {
                overspreadObj[viewId].topNum = minY;
              }
              if (maxX > overspreadObj[viewId].rightNum) {
                overspreadObj[viewId].rightNum = maxX;
              }
              if (maxY > overspreadObj[viewId].bottomNum) {
                overspreadObj[viewId].bottomNum = maxY;
              }
              copyCfgs.splice(cfgsIndex, 1);
            }
          }
        }
      }

      //图片铺满
      let noOverspreadName = [];
      for (let i in overspreadObj) {
        if (overspreadObj[i].leftNum < 0) overspreadObj[i].leftNum = 0;
        if (overspreadObj[i].topNum < 0) overspreadObj[i].topNum = 0;
        if (overspreadObj[i].rightNum > overspreadObj[i].printAreaWidth)
          overspreadObj[i].rightNum = overspreadObj[i].printAreaWidth;
        if (overspreadObj[i].bottomNum > overspreadObj[i].printAreaHeight)
          overspreadObj[i].bottomNum = overspreadObj[i].printAreaHeight;

        let designWidthRatio =
          (overspreadObj[i].rightNum - overspreadObj[i].leftNum) /
          overspreadObj[i].printAreaWidth;
        let designHeightRatio =
          (overspreadObj[i].bottomNum - overspreadObj[i].topNum) /
          overspreadObj[i].printAreaHeight;
        if (designWidthRatio < 0.98 || designHeightRatio < 0.98) {
          noOverspreadName.push(
            `${overspreadObj[i].viewName.substr(0, 1)}`
          );
        }
      }
      if (noOverspreadName.length > 0) {
        this.saveProductObj.is_overspread = -1;
        // xhtml += `<li><strong>${noOverspreadName.join(
        //   "、"
        // )}</strong>面设计未铺满设计区域，产品会留空白
        //         </li>`;
      }

      //图片模糊
      for (let views of this.productData.views) {
        if (
          vagueDesignId.some((item) => {
            return views.id == item;
          })
        ) {
          vagueDesignName.push(`${views.name.substr(0, 1)}`);
        }
      }
      if (vagueDesignName.length > 0) {
        this.saveProductObj.is_vague = 1;
        // xhtml += `<li>
        //             <strong>${vagueDesignName.join(
        //               "、"
        //             )}</strong> 面图片像素不足放大，会导致印刷图案模糊
        //           </li>`;
      }
      resolve()
    });
  }
  private getProductConfiguration({ viewId = 0, isSaveProduct = true } = {}) {
    var productViews = this.productData.views,
      cfgs: Array<SaveData> = [],
      products: any = {
        color_id: '',
        view_id: '',
        product_type_id: '',
        cfgs: []
      }
    for (let item of productViews) {
      let stage = this.stageObj[`stage${item.id}`];
      let layer = stage.findOne(".designLayer");
      let designImg = layer.find(".designImg") || [],
        designText = layer.find(".designText") || [],
        bgRectGroup = layer.find(".bgRect") || [];
      if (designImg.length + designText.length + bgRectGroup.length > 0) {
        for (let node of bgRectGroup) {
          //背景色
          if (node.visible()) {
            let colorData = formateColor({ color: node.fill() });
            let konvaAttrs = Object.assign({}, node.getAttrs(), {
              stageWidth: this.containerWidth * layer.scaleX(),
              layerScale: layer.scaleX(),
            });
            cfgs.push({
              color: {
                value: colorData.value,
                fillOpacity: colorData.alpha,
              },
              print_area_id: layer.getAttrs().printAreaId,
              view_id: item.id,
              type: "bgColor",
              konvaAttrs,
            });
          }
        }
        for (let node of layer.find(".design")) {
          if (node.visible() && node.hasName("designImg")) {
            cfgs.push(
              this.getDesignesConfiguration({
                node,
                viewId: item.id,
                layer,
                isSaveProduct
              })
            );
          } else if (node.visible() && node.hasName("designText")) {
            cfgs.push(
              this.getTextConfiguration({
                node,
                viewId: item.id,
                layer,
              })
            );
          }
        }
        // for (let node of designImg) {
        //   if (node.visible()) {
        //     cfgs.push(
        //       this.getDesignesConfiguration({ node, viewId: item.id, layer })
        //     );
        //   }
        // }
        // for (let node of designText) {
        //   if (node.visible()) {
        //     cfgs.push(
        //       this.getTextConfiguration({ node, viewId: item.id, layer })
        //     );
        //   }
        // }
      }
    }

    products.cfgs = cfgs;
    return products;
  }
  private getDesignesConfiguration({ node, viewId, layer, isSaveProduct }) {
    let nodeAttrs = JSON.parse(JSON.stringify(node.getAttrs()));
    let layerAttrs = layer.getAttrs();
    //传mm的宽高给后端，矩阵也需要用mm
    let pxToMmScaleX = layerAttrs.ratio * node.width() / nodeAttrs.widthMM, 
    pxToMmScaleY = layerAttrs.ratio * node.height() / nodeAttrs.heightMM
    let clipWidth, clipHeight, clipData, designImg2 = nodeAttrs.flipImgUrl;
    if(nodeAttrs.isclip){
      clipData = nodeAttrs.clipData;
      let {imgAttrs, pathAttrs} = clipData;
      designImg2 = clipData.imgAttrs.originImg
      clipWidth = (pathAttrs.width * pathAttrs.scaleX) / (imgAttrs.width * imgAttrs.scaleX) * nodeAttrs.widthMM;
      clipHeight = (pathAttrs.height * pathAttrs.scaleY) / (imgAttrs.height * imgAttrs.scaleY) * nodeAttrs.heightMM;
      clipData.imgAttrs.originImg = isSaveProduct ? '' : clipData.imgAttrs.originImg;
      pxToMmScaleX = layerAttrs.ratio * node.width() / clipWidth;
      pxToMmScaleY = layerAttrs.ratio * node.height() / clipHeight;
    }
    let designeTransform = node.getTransform();
    let designeTransformCopy = designeTransform.copy()
    designeTransformCopy.scale(pxToMmScaleX, pxToMmScaleY)
    // let rotateNodePoint = this.getRotateNodePoint({ node, layer });  
    designeTransformCopy.m[4] = designeTransformCopy.m[4] * layerAttrs.ratio
    designeTransformCopy.m[5] = designeTransformCopy.m[5] * layerAttrs.ratio
    // let matrix = JSON.parse(JSON.stringify(designeTransformCopy.m));
    // matrix[4] = matrix[4] * layerAttrs.ratio; //px转mm
    // matrix[5] = matrix[5] * layerAttrs.ratio;

    let twoTransform = calcTwoTransform(designeTransformCopy, node.rotation() * Math.PI / 180)
    let nodeIndex = 0
    if(!isSaveProduct) {
      nodeIndex = node.nodeIndex
    }
    //konva数据还原
    delete nodeAttrs.image;
    if (isSaveProduct) {
      nodeAttrs.imageData.designImg = ''
      nodeAttrs.imageData.designImg2 = ''
      nodeAttrs.imageData.designImg3 = '' //旧版翻转图片跳到新版传过来的是base64
      nodeAttrs.flipImgUrl = ""; //base64太大，传不了
      designImg2 = ''
    }
    nodeAttrs.stageWidth = this.containerWidth * layer.scaleX();
    nodeAttrs.layerScale = layer.scaleX();
    let designeData: SaveData = {
      image: {
        gallery_id: nodeAttrs.imageData.code,
        designImg2,
        // transform:
        //   nodeAttrs.tileType != ""
        //     ? `matrix(${Math.abs(node.scaleX()) * pxToMmScaleX},0,0,${Math.abs(
        //         node.scaleY() * pxToMmScaleY
        //       )},0,0)`
        //     : "matrix(1,0,0,1,0,0)",
        // gTransform: `matrix(${matrix.join(",")})`,
        // height: nodeAttrs.heightMM / (nodeAttrs.heightMM / layerAttrs.ratio / node.height()), // 后台使用这个值计算，前台添加图片时对原图进行了缩放，为了使transform正确，这里要把传给后端的宽高缩放
        // width: nodeAttrs.widthMM / (nodeAttrs.widthMM / layerAttrs.ratio / node.width()),
        transform: twoTransform.transform,
        gTransform: twoTransform.gTransform,
        height: nodeAttrs.heightMM,
        width: nodeAttrs.widthMM,
        opacity: 1,
        tileType: nodeAttrs.tileType,
        hspacing: nodeAttrs.spacingH,
        vspacing: nodeAttrs.spacingV,
        isBg: node.hasName("isBg") ? 1 : 0,
        // offset_x: rotateNodePoint.VStart * layerAttrs.ratio,
        // offset_y: rotateNodePoint.HStart * layerAttrs.ratio,
        offset_x:
          (node.x() - (node.width() * Math.abs(node.scaleX())) / 2) *
          layerAttrs.ratio,
        offset_y:
          (node.y() - (node.height() * Math.abs(node.scaleY())) / 2) *
          layerAttrs.ratio,
        rotate: node.rotation(),
        name: nodeAttrs.imageData.name,
        size: nodeAttrs.imageData.size,
        rendercode: nodeAttrs.rendercode || "",
        render_id: nodeAttrs.render_id || "",
        xFlip: nodeAttrs.xFlip,
        yFlip: nodeAttrs.yFlip,
        risk_gallery: nodeAttrs.imageData.risk_gallery,
        risk_word: [],
        // xFlip: designeImg.hasClass("xFlip"),
        // yFlip: designeImg.hasClass("yFlip"),
      },
      dpi: 100,
      view_id: viewId,
      print_area_id: layerAttrs.printAreaId,
      type: "design",
      konvaAttrs: nodeAttrs,
    };
    if(nodeAttrs.isclip){
      designeData.image.isclip = true;
      designeData.image.clipData = clipData;
      designeData.image.clipWidth = clipWidth;
      designeData.image.clipHeight = clipHeight;
    }
    if(!isSaveProduct) {
      designeData.nodeId = nodeIndex
    }
    // if (!isSaveProduct) {
    //   designeData.image.designImg = nodeAttrs.imageData.designImg3
    //   // matrix[3] = matrix[3] / (nodeAttrs.heightMM / layerAttrs.ratio / node.height())
    //   // matrix[0] = matrix[0] / (nodeAttrs.widthMM / layerAttrs.ratio / node.width());
    //   // designeData.image.gTransform = `matrix(${matrix.join(",")})`
    //   designeData.image.height = nodeAttrs.heightMM
    //   designeData.image.width = nodeAttrs.widthMM
    // }
    return designeData;
  }
  private getTextConfiguration({ node, viewId, layer }) {
    let text = node.findOne("Text");
    node.setAttrs(this.textAttrToLabel({ node }));
    let nodeAttrs = JSON.parse(JSON.stringify(node.getAttrs()));
    let layerAttrs = layer.getAttrs();
    let designeTransform = node.getTransform();
    let rotateNodePoint = this.getRotateNodePoint({ node, layer });
    let matrix = JSON.parse(JSON.stringify(designeTransform.m));
    let angle = (node.rotation() * Math.PI) / 180;
    // matrix[5] = (matrix[5] + (node.height() * node.scaleY() - node.height()) - 6.35 * layerAttrs.ratio) * layerAttrs.ratio + text.fontSize() * layerAttrs.ratio;
    // matrix[5] = (matrix[5] + (node.height() * node.scaleY() - node.height())) * layerAttrs.ratio / layerAttrs.backRatio + text.fontSize() * layerAttrs.ratio / layerAttrs.backRatio;
    // matrix[5] =
    //   (matrix[5] +
    //     ((text.lineHeight() * text.fontSize()) / 2) * node.scaleY()) *
    //   layerAttrs.ratio;
    // matrix[5] = (matrix[5]) * layerAttrs.ratio;

    nodeAttrs.stageWidth = this.containerWidth * layer.scaleX();
    nodeAttrs.layerScale = layer.scaleX();

    let tspanListData = [],
      textAnchorX = 0,
      textAnchor = "start";
    for (let i = 0; i < text.text().split("\n").length; i++) {
      let item = text.text().split("\n")[i];
      let createText = new Konva.Text({
        text: item,
        scaleX: nodeAttrs.scaleX,
        scaleY: nodeAttrs.scaleY,
        fontSize: text.fontSize(),
      });
      if (i == 0) {
        matrix[4] =
          (matrix[4] -
            createText.height() * node.scaleY() * Math.sin(angle)) *
          layerAttrs.ratio; //px转mm 
        matrix[5] =
          (matrix[5] +
            createText.height() * node.scaleY() * Math.cos(angle)) *
          layerAttrs.ratio;
        // console.log('####', `matrix(${matrix.join(",")})`, Math.cos(angle), text.fontSize() * layerAttrs.ratio)
        // console.log("@@@@", createText.height() * node.scaleY(), Math.sin(angle), layerAttrs.ratio)
      }

      let createTextWidth = nodeAttrs.width;
      switch (text.align()) {
        case "left":
          textAnchorX = 0;
          textAnchor = "start";
          break;
        case "center":
          textAnchorX = (createTextWidth / 2) * layerAttrs.ratio;
          textAnchor = "middle";
          break;
        case "right":
          textAnchorX = createTextWidth * layerAttrs.ratio;
          textAnchor = "end";
          break;
      }
      let colorData = formateColor({ color: text.fill() });
      tspanListData.push({
        content: item,
        fill: colorData.value,
        fillOpacity: colorData.alpha,
        fontFamily: text.fontFamily(),
        fontSize: text.fontSize() * layerAttrs.ratio + "px",
        fontStyle: text.fontStyle().indexOf("italic") != -1 ? "italic" : "",
        fontWeight: text.fontStyle().indexOf("bold") != -1 ? "bold" : "",
        textDecoration: text.textDecoration(),
        textAnchor: textAnchor,
        x: textAnchorX,
        y:
          i == 0
            ? 0
            : (createText.height() *
              Math.abs(node.scaleY()) *
              i *
              layerAttrs.ratio) /
            Math.abs(node.scaleY()),
      });
    }
    let colorData = formateColor({ color: text.stroke() });
    let textData = {
      text: {
        tspans: tspanListData,
        x: 0,
        y: 0,
        transform: `matrix(${matrix.join(",")})`,
        gTransform: `matrix(1,0,0,1,0,0)`,
        handleGroupTransform: `matrix(1,0,0,1,0,0)`,
        width: rotateNodePoint.width * layerAttrs.ratio,
        height: rotateNodePoint.height * layerAttrs.ratio,
        textBg: formateColor({ color: node.findOne("Rect").fill() }).value,
        textBgX: 0,
        textBgY: 0,
        textBgWidth: 0,
        textBgheight: 0,
        stroke: colorData.value,
        strokeOpacity: colorData.alpha,
        strokeWidth: text.strokeWidth() * layerAttrs.ratio + "px",
        strokeValue: node.strokeValue,
        // dominantBaseline: "hanging",
        strokeMiterLimit: 10,
        // fontStyle: text.fontStyle().indexOf("italic") != -1 ? "italic" : "",
        // fontWeight: text.fontStyle().indexOf("bold") != -1 ? "bold" : "",
        // textDecoration: text.textDecoration()
      },
      dpi: 100,
      print_area_id: layerAttrs.printAreaId,
      view_id: viewId,
      type: "text",
      konvaAttrs: nodeAttrs,
    };

    // var filterBg = element.select(".filterBg");
    // var textPathG = element.select(".textPathG");
    // if (filterBg) {
    //   var textBg = filterBg.select("feFlood").attr("flood-color");
    //   textData.text.textBg = textBg;
    // }
    // if (textPathG) {
    //   var textPathGTransform = textPathG.transform().localMatrix.toString();
    //   var pathTransform = textPathG
    //     .select("path")
    //     .transform()
    //     .localMatrix.toString();
    //   var pathD = textPathG.select("path").attr("d");
    //   textData.text.textPathGTransform = textPathGTransform;
    //   textData.text.pathTransform = pathTransform;
    //   textData.text.pathD = pathD;
    //   var sliderLeft =
    //     $(element.node).data("sliderLeft") / $(".text-slider").width();
    //   textData.text.sliderLeft = sliderLeft;
    //   textData.text.dy = text.attr("dy");
    // }
    // textData.text.stroke = text.attr('stroke')
    // textData.text.strokeWidth = text.attr('stroke-width')
    // textData.text.strokeValue = $(text.node).data('strokeValue')

    return textData;
  }
  addTransformer({ currentStage, node, viewId }) {
    let layer = currentStage.findOne(".designLayer");
    let designContainerGroup = layer.findOne(".designContainerGroup");
    let rotateNodePoint = this.getRotateNodePoint({
      node: node,
      layer: currentStage.findOne(".designLayer"),
    });
    anchorGroup = new Konva.Group({
      x: rotateNodePoint.VCenter + designContainerGroup.x(),
      y: rotateNodePoint.HCenter + designContainerGroup.y(),
      rotation: node.rotation(),
      name: "anchorGroup",
    });
    anchorRotate = new Konva.Image({
      x: (node.width() * Math.abs(node.scaleX())) / 2 - 10 / layer.scaleX(),
      y: -(node.height() * Math.abs(node.scaleY())) / 2 - 12 / layer.scaleY(),
      image: imgRotate,
      width: 24 / layer.scaleX(),
      height: 24 / layer.scaleY(),
      name: "anchorRotate",
      listening: false,
    });
    anchorZoom = new Konva.Image({
      x: (node.width() * Math.abs(node.scaleX())) / 2 - 12 / layer.scaleX(),
      y: (node.height() * Math.abs(node.scaleY())) / 2 - 12 / layer.scaleY(),
      image: imgZoom,
      width: 24 / layer.scaleX(),
      height: 24 / layer.scaleY(),
      name: "anchorZoom",
      listening: false,
    });

    let tr = new Konva.Transformer({
      borderStroke: "#6CD0FF",
      borderStrokeWidth: 1,
      rotateAnchorOffset: 10,
      ignoreStroke: true,
      anchorSize: 24,
      anchorStroke: "#ADB8BF",
      anchorCornerRadius: 24,
      keepRatio: true,
      enabledAnchors: ['bottom-right'],
      centeredScaling: true,
      boundBoxFunc: (oldBox, newBox) => {
        if (newBox.width < 20 || newBox.height < 20) {
          return oldBox;
        }
        return newBox;
      },
    });
    anchorGroup.add(anchorRotate);
    anchorGroup.add(anchorZoom);
    layer.add(tr);
    layer.add(anchorGroup);
    tr.nodes([node]);
  }
  anchorGroupFourceupdate({ node, viewId }) {
    let stage = this.stageObj['updateImgStage']
    let layer = stage.findOne('.designLayer')
    let designContainerGroup = layer.findOne(".designContainerGroup");
    if (!layer.findOne(".anchorGroup")) return;
    let rotateNodePoint = this.getRotateNodePoint({ node, layer });
    anchorGroup.rotation(node.rotation());
    anchorGroup.x(rotateNodePoint.VCenter + designContainerGroup.x());
    anchorGroup.y(rotateNodePoint.HCenter + designContainerGroup.y());
    anchorRotate.x(
      (node.width() * Math.abs(node.scaleX())) / 2 - 10 / layer.scaleX()
    );
    anchorRotate.y(-(node.height() * Math.abs(node.scaleY())) / 2 - 12 / layer.scaleY());
    anchorRotate.width(24 / layer.scaleX());
    anchorRotate.height(24 / layer.scaleY());
    anchorZoom.x(
      (node.width() * Math.abs(node.scaleX())) / 2 - 12 / layer.scaleX()
    );
    anchorZoom.y((node.height() * Math.abs(node.scaleY())) / 2 - 12 / layer.scaleY());
    anchorZoom.width(24 / layer.scaleX());
    anchorZoom.height(24 / layer.scaleY());
  }
  destroyTransform({ currentStage }) {
    currentStage.find("Transformer").destroy();
    currentStage.find(".anchorGroup").destroy();
    currentStage.findOne(".designLayer").batchDraw();
  }
  private isRisk(data: object) {
    const highRiskIds = [1, 3, 4, 6]; //1涉政, 3涉黄, 4暴恐, 6不良场景
    let isHighRisk = data['risk_gallery'].risk.reduce((prev, cur) => {
      return prev || highRiskIds.includes(cur.id);
    }, false);
    return (
      (data['risk_word'].length && data['risk_word'][0].level == 5) || isHighRisk
    );
  }
  private convertDefaultConfig({ width, height }) {
    let designWidthRatio: number,
      designHeightRatio: number;

    if (!this.productData['design_width']) {
      this.productData['design_width'] = "100";
    }
    designWidthRatio = Number(this.productData['design_width']) / 100;

    if (!this.productData.design_height) {
      this.productData.design_height = "0";
    }

    designHeightRatio =
      1 - Math.abs(Number(this.productData.design_height)) / 100;

    var defaultWidth = parseInt(width),
      defaultHeight = parseInt(height),
      scaledWidth = defaultWidth * designWidthRatio,
      scaledHeight = defaultHeight * designHeightRatio;

    let flag: string;
    if (this.productData.design_height.indexOf("-") == -1) {
      flag = "top";
    } else {
      flag = "bottom";
    }

    return {
      defaultWidth: defaultWidth,
      defaultHeight: defaultHeight,
      width: scaledWidth,
      height: scaledHeight,
      x: (defaultWidth - scaledWidth) / 2,
      y: defaultHeight - scaledHeight,
      flag: flag,
    }
  }
  private imgSizeCalculate(imageData: { size: { width: number, height: number } }, viewId: number) {
    let viewerSize = this.convertSizeToMm(
      { width: imageData.size.width, height: imageData.size.height },
      this.productData.dpi
    );
    var defaultConfig = this.getDesigneConfiguration({ viewId: viewId }),
      defaultScale = this.convertDefaultScale(
        viewerSize,
        defaultConfig.config
      ),
      defaultScaleHeight = this.convertDefaultScaleHeight(
        viewerSize.height * defaultScale,
        defaultConfig.config.height
      );

    //防止除不尽
    var iw =
      viewerSize.width * defaultScale * defaultScaleHeight >
        defaultConfig.config.width
        ? defaultConfig.config.width
        : viewerSize.width * defaultScale * defaultScaleHeight;
    var ih =
      viewerSize.height * defaultScale * defaultScaleHeight >
        defaultConfig.config.height
        ? defaultConfig.config.height
        : viewerSize.height * defaultScale * defaultScaleHeight;
    // imageWidth = iw
    // imageHeight = ih
    return { width: iw, height: ih, viewerSize: viewerSize };
  }
  private getDesigneConfiguration({ viewId }) {
    let rel = this.cacheProductPrintAreas,
      _rel
    for (var i = 0, ii = rel.length; i < ii; i++) {
      if (rel[i].defaultViews == viewId) {
        _rel = rel[i];
        break;
      }
    }

    return _rel;
  }
  private convertDefaultScale(size: object, _size: object) {
    if (size['width'] > _size['width']) {
      return _size['width'] / size['width'];
    } else {
      return 1;
    }
  }
  /**
   * 宽不能超过印刷区， 同理高也不能超出，再计算
   */
  private convertDefaultScaleHeight(curViewerSizeHeight: number, defaultConfigHeight: number) {
    if (curViewerSizeHeight > defaultConfigHeight) {
      return defaultConfigHeight / curViewerSizeHeight;
    }

    return 1;
  }
  private convertSizeToMm(designeSize: object, dpi: number) {
    var pixelToMm = function (pixel: number, dpi: number) {
      return (pixel * 25.4) / dpi;
    };
    return {
      height: pixelToMm(designeSize['height'], dpi),
      width: pixelToMm(designeSize['width'], dpi),
    };
  }
  private getCurStageLayer({ viewId }) {
    let stage = this.stageObj[`stage${viewId}`];
    let layer = stage.findOne(".designLayer");
    let layerBg = stage.findOne(".layerBg");
    let designRect = layer.findOne(".print_area_border_outer");
    let designContainerGroup = layer.findOne(".designContainerGroup");
    return {
      stage: stage,
      layer: layer,
      layerBg,
      designRect: designRect,
      designContainerGroup,
    };
  }
  private getRotateNodePoint({ node, layer = null }) {
    //获取元素最大矩形各个点坐标
    let boundingBox: any;
    if (layer) {
      let designContainerGroup = layer.findOne(".designContainerGroup");
      boundingBox = node.getClientRect({ relativeTo: designContainerGroup });
    } else {
      boundingBox = node.getClientRect();
    }

    return {
      HStart: boundingBox.y,
      HCenter: boundingBox.y + boundingBox.height / 2,
      HEnd: boundingBox.y + boundingBox.height,
      VStart: boundingBox.x,
      VCenter: boundingBox.x + boundingBox.width / 2,
      VEnd: boundingBox.x + boundingBox.width,
      width: boundingBox.width,
      height: boundingBox.height,
    };
  }
  private async implementClip(node: any, originImg:string, clipData:ClipData): Promise<void>{
    clipData.imgAttrs.originImg = originImg
    let clipUrl = await this.getClipImage(clipData);
    let [clipImage] = await this.loadImgs([clipUrl]);
    node.image(clipImage);
    node.setAttrs({
      offsetX: clipImage.width/2,
      offsetY: clipImage.height/2,
      clipData
    })
  }
  private getClipImage(clipData:ClipData): Promise<string>{
    return new Promise(async (resolve, reject) => {
      let {imgAttrs, pathAttrs, clipPath} = clipData;
      let [image] = await this.loadImgs([imgAttrs.originImg]);
      let canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      let ctx = canvas.getContext('2d');
      ctx.save();
      ctx.drawImage(image, 0, 0, image.width, image.height);
      ctx.restore();
      ctx.globalCompositeOperation="destination-in";

      let pathUrl: string = clipPath.image;
      if(pathAttrs.xFlip || pathAttrs.yFlip){
        pathUrl = await this.getFlipPath(clipPath.image, pathAttrs.xFlip, pathAttrs.yFlip)
      }
      const [pathImg] = await this.loadImgs([pathUrl])
      let percent: Percent = this.getClipPercent(clipData);
      let left = percent.left * image.width;
      let top = percent.top * image.height;
      let pathWidth = (pathAttrs.width * pathAttrs.scaleX) / (imgAttrs.width * imgAttrs.scaleX) * image.width;
      let pathHeight = (pathAttrs.height * pathAttrs.scaleY) / (imgAttrs.height * imgAttrs.scaleY) * image.height;
      ctx.drawImage(pathImg, left, top, pathWidth, pathHeight)

      let oImgData = ctx.getImageData(left, top, left+pathWidth, top+pathHeight);
      let oCanvas = document.createElement('canvas');
      oCanvas.width = pathWidth;
      oCanvas.height = pathHeight;
      let oCtx = oCanvas.getContext("2d");
      oCtx.putImageData(oImgData, 0, 0);
      let url = oCanvas.toDataURL();
      resolve(url)
    })
  }
  private async getFlipPath(pathUrl:string, xFlip:boolean=false, yFlip:boolean=false){
    const [pathImg] = await this.loadImgs([pathUrl]);
    const canvas = document.createElement('canvas');
    canvas.width = pathImg.width;
    canvas.height = pathImg.height;
    const ctx = canvas.getContext("2d");
    const left = xFlip ? -pathImg.width : 0;
    const top = yFlip ? -pathImg.height : 0;
    ctx.scale(xFlip ? -1 : 1, yFlip ? -1 : 1)
    ctx.drawImage(pathImg, left, top, canvas.width, canvas.height);
    return canvas.toDataURL();
  }
  private getClipPercent(clipData:ClipData): Percent{
    let {imgAttrs, pathAttrs} = clipData;
    return {
      left: pathAttrs.x / (imgAttrs.width * imgAttrs.scaleX),
      top: pathAttrs.y / (imgAttrs.height * imgAttrs.scaleY)
    }
  }
  private loadImgs(urls:Array<string> = [], crossOrigin?:string): Promise<Array<HTMLImageElement|null>>{
    const loadImg = (url: string): Promise<HTMLImageElement|null> => {
      return new Promise((resolve, reject) => {
        if(!url) resolve(null)
        const image = new Image();
        image.src = url;
        image.setAttribute("crossOrigin", crossOrigin || "anonymous");
        image.onload = () => { resolve(image) }
        image.onerror = () => { reject() }
      });
    }
    const promises = urls.map((url:string): Promise<HTMLImageElement|null> => loadImg(url));
    return Promise.all(promises);
  }
}
function checkFont(name: string) {
  let values = document.fonts.values();
  let isHave = false;
  let item = values.next();
  while (!item.done && !isHave) {
    let fontFace = item.value;
    if (fontFace.family == name) {
      isHave = true;
    }
    item = values.next();
  }
  return isHave;
}
// function loadFont({ fontFamily = '', all = false } = {}) {
//   return new Promise<void>((resolve, reject) => {
//     if (document.fonts && !checkFont(fontFamily)) {
//       getFonts({ fontFamily, all }).then(() => {
//         fontLoaded = true
//         resolve();
//       });
//     } else {
//       resolve();
//     }
//   });
// }
// function getFonts({ fontFamily, all }) {
//   let promises = []
//   return new Promise<void>((resolve) => {
//     axios
//       .get(`${requestReferer}/v1/FontFamily?mediaType=json`)
//       .then((res: any) => {
//         let data: any = Object.values(res.data.data);
//         let fontFamilyList = [];
//         for (let el of data) {
//           let obj = {
//             hasNormalFontType: "",
//             hasBoldFontType: "",
//             hasItalicFontType: "",
//             hasBoldAndItalicFontType: "",
//             id: 0,
//             label: '',
//             value: ''
//           };
//           let fontFamilieId = el.id;
//           // let { id, fonts, lang, name, weight } = el;
//           obj.id = fontFamilieId;
//           obj.label = el.name;
//           for (let font of el.fonts) {
//             let { id, name, style, ttf, weight, woff } = font;
//             let fontName =
//               name + "_" + fontFamilieId + "_" + id + "_" + font.name;
//             if (style == "normal" && weight == "normal") {
//               obj.hasNormalFontType = fontName;
//             } else if (style == "normal" && weight == "bold") {
//               obj.hasBoldFontType = fontName;
//             } else if (style == "italic" && weight == "normal") {
//               obj.hasItalicFontType = fontName;
//             } else if (style == "italic" && weight == "bold") {
//               obj.hasBoldAndItalicFontType = fontName;
//             }
//             obj.value = fontName;

//             let src = "";
//             if (ttf && woff) {
//               src =
//                 'url("' +
//                 woff +
//                 '") format("woff"),' +
//                 'url("' +
//                 ttf +
//                 '") format("truetype")';
//             } else if (ttf && !woff) {
//               src = 'url("' + ttf + '") format("truetype")';
//             } else if (!ttf && woff) {
//               src = 'url("' + woff + '") format("woff")';
//             }
//             if (!all) { //添加文字加载到当前添加文字的字体就继续下一步
//               let fontFace = new FontFace(fontName, src, { weight, style });
//               fontFace.load().then(function (loadedFontFace) {
//                 document.fonts.add(loadedFontFace);
//                 if (loadedFontFace.family == fontFamily) {
//                   resolve()
//                 }
//               }).catch(e => {

//               }).finally(() => {
//                 resolve()
//               });
//             } else { //自定义底板文字加载到所有字体才进行下一步
//               promises.push(new Promise<void>((resolve) => {
//                 let fontFace = new FontFace(fontName, src, { weight, style });
//                 fontFace.load().then(function (loadedFontFace) {
//                   document.fonts.add(loadedFontFace);
//                   resolve()
//                 }).finally(() => {
//                   resolve()
//                 })
//               }))
//             }
//           }

//           fontFamilyList.push(obj);
//         }
//         if (promises.length) {
//           Promise.all(promises).then(() => {
//             resolve()
//           })
//         }
//       })
//   })
// }

function getFontList() {
  startLoadFont = true
  return new Promise<void>((resolve) => {
    axios
      .get(`${requestReferer}/v1/FontFamily?mediaType=json`)
      .then((res: any) => {
        let data: any = Object.values(res.data.data);
        let fontFamilyList = [];
        for (let el of data) {
          let obj = {
            hasNormalFontType: "",
            hasBoldFontType: "",
            hasItalicFontType: "",
            hasBoldAndItalicFontType: "",
            id: 0,
            label: '',
            value: '',
            src: '',
            weight: '',
            style: ''
          };
          let fontFamilieId = el.id;
          // let { id, fonts, lang, name, weight } = el;
          obj.id = fontFamilieId;
          obj.label = el.name;
          const font = el.fonts[0]
          let { id, name, style, ttf, weight, woff } = font;
          let fontName =
            name + "_" + fontFamilieId + "_" + id + "_" + font.name;
          if (style == "normal" && weight == "normal") {
            obj.hasNormalFontType = fontName;
          } else if (style == "normal" && weight == "bold") {
            obj.hasBoldFontType = fontName;
          } else if (style == "italic" && weight == "normal") {
            obj.hasItalicFontType = fontName;
          } else if (style == "italic" && weight == "bold") {
            obj.hasBoldAndItalicFontType = fontName;
          }
          let src = "";
          if (ttf && woff) {
            src =
              'url("' +
              woff +
              '") format("woff"),' +
              'url("' +
              ttf +
              '") format("truetype")';
          } else if (ttf && !woff) {
            src = 'url("' + ttf + '") format("truetype")';
          } else if (!ttf && woff) {
            src = 'url("' + woff + '") format("woff")';
          }
          obj.value = fontName;
          obj.src = src
          obj.weight = weight
          obj.style = style
          fontFamilyList.push(obj);
        }
        fontList = fontFamilyList
        resolve()
      })
  })
}
function loadFont(fontFamily) {
  return new Promise<void>(async (resolve, reject) => {
    await checkGetFontList()
    const fontObj = fontList.find(item => item.value == fontFamily)
    if (document.fonts && !checkFont(fontObj.value)) {
      let fontFace = new FontFace(fontObj.value, fontObj.src, { weight: fontObj.weight, style: fontObj.style });
      fontFace.load().then(function (loadedFontFace) {
        document.fonts.add(loadedFontFace);
        if (loadedFontFace.family == fontObj.value) {
          resolve()
        }
      }).catch(e => {

      }).finally(() => {
        resolve()
      });
    } else {
      resolve();
    }
  });
}
function checkGetFontList() {
  return new Promise<void>(resolve => {
    if(!startLoadFont) {
      getFontList()
    }
    if(!fontList.length) {
      const interval = setInterval(() => {
        if(fontList.length) {
          resolve()
          clearInterval(interval)
        }
      }, 100)
    } else {
      resolve()
    }
  })
}


// function checkFontLoaded() {
//   if(!startLoadFont) {
//     startLoadFont = true
//     loadFont({
//       fontFamily: "Academic M54_1_1_Academic M54",
//       all: true
//     })
//   }
//   return new Promise<void>(resolve => {
//     const interval = setInterval(() => {
//       if(fontLoaded) {
//         resolve()
//         clearInterval(interval)
//       }
//     }, 100)
//   })
// }
function ClearBr({ str, type }) {
  switch (type) {
    case 1: //去除换行
      str = str.replace(/<\/?.+?>/g, "");
      str = str.replace(/[\r\n]/g, "");
      break;
    case 2: //去除空格
      str = str.replace(/\s+/g, "");
      break;
    default:
      str = str.replace(/<\/?.+?>/g, "");
      str = str.replace(/[\r\n]/g, "");
      str = str.replace(/\s+/g, "");
      break;
  }

  return str;
}
function formateColor({ color }) {
  if (!color || color == 'transparent') {
    return {
      value: '',
      alpha: '',
      color: ''
    };
  } else {
    const formateColor = new Color({
      enableAlpha: false,
      format: "hex",
    });
    formateColor.fromString(color);
    return {
      value: formateColor.value,
      alpha: formateColor._alpha / 100,
      color: color,
    };
  }
}
function calcTwoTransform(transform, rad) {
  let rotationTran = new Konva.Transform()
  rotationTran.rotate(rad)
  let invertTran = rotationTran.copy().invert()
  let mulTransform = invertTran.multiply(transform)
  return {
    gTransform: `matrix(${rotationTran.m[0]}, ${rotationTran.m[1]}, ${rotationTran.m[2]}, ${rotationTran.m[3]}, ${rotationTran.m[4]}, ${rotationTran.m[5]})`,
    transform: `matrix(${mulTransform.m[0]}, ${mulTransform.m[1]}, ${mulTransform.m[2]}, ${mulTransform.m[3]}, ${mulTransform.m[4]}, ${mulTransform.m[5]})`
  }
}

async function preload(data: [{productData, cfg}]) {
  for(let i = 0; i < data.length; i++) {
    const {
      productData,
      cfg = []
    } = data[i]

    const detail = productData.colors[0].detail

    if (!detail) {
      return
    }

    const modelData = detail[0].parts.map(i => i.detail3D)

    await Promise.all([
      Promise.all(modelData.map(modelDatum => preloadModelData(modelDatum))),
      Promise.all(cfg.map(i => {
        if (i.image && i.image.designImg) {
          return axios.get(i.image.designImg)
        }else {
          return
        }
      })),
      detail.image && axios.get(detail.image),
      detail.texture && axios.get(detail.texture)
    ])
  }
}

export { Design, preload }