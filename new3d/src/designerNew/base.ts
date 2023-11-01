import {createDateProcessor, isRisk, needImageOrcanvas} from "./designerLogicProcess";
import {CanvasConfig, CanvasImgs, DataProcessorType, Designer, PartCheckedObj, ProductData, View} from "./types";
import defaultConfig from "./defaultConfig";
import {convertProductData, loadImgs} from "./utils";
import Konva from "./dependence/konva7.2.1";

interface Base extends Designer {}

export class DesignerGlobals {
  public static threeDApp: any = [];
}

class Base {
  public designsInfoMap: object = {}; //当前各个面的设计信息,包括节点、模糊、未铺满等信息
  public userEvent: any = {
    pinchFlag: false,
    pinchTimer: null,
    panFlag: false,
    panTimer: null,
    transformFlag: false,
    transformTimer: null,
  }
  public templateCode: string
  public templateData
  public partCheckedList: Array<PartCheckedObj> = [];
  public indexList: Array<number> = [];
  public curNode: any; //当前选中的节点
  public historyListMap: any = {};
  public historyStepMap: any = {};
  public historyFreeze: boolean = false;
  public dataProcessor: DataProcessorType
  public levelInfo: object = {
    total: 0,
    index: 0
  }
  public events: object = {};
  public controllerConfig: any = defaultConfig.controler; //控制器配置
  public transformer //Konva的控制按钮
  public anchorGroup //自定义控制按钮
  productData: ProductData;
  options;
  canvasConfig: CanvasConfig = defaultConfig.canvas; //画布配置
  defaultSetting: any = defaultConfig.default; //显示配置,如默认颜色/面,是否显示主图肌理图,设计说明辅助线等
  container: HTMLElement; //画布容器
  canvasSize: number; //画布大小
  stageObj: object = {};
  layerToImageOrCanvas = 'image'; //画布转成图片还是canvas
  viewImgArr: Array<CanvasImgs> = [];
  konvaJson: object = {};
  isDestroy = false;
  cacheProductPrintAreas: Array<{
    id: number; //打印区域id
    defaultViews: number; //默认哪一面
    printArea: object; //打印区域
    config: object;
  }> = [];
  colorId: number; //当前选中的颜色
  viewId: number; //当前选中的面
  changeNodeList: Array<{}> = [] //简版替换编辑的图片
  constructor(options) {
    this.options = options
    this.dataProcessor = createDateProcessor({
      type: options.programType,
      requestMethod: options.requestMethod,
      env: options.env,
    })
    this.canvasConfig = Object.assign(this.canvasConfig, options.canvasConfig || {});

    this.controllerConfig = Object.assign(this.controllerConfig, options.controlerConfig || {});
    this.defaultSetting = Object.assign(this.defaultSetting, options.defaultSetting || {});
    this.container = options.container;
    if (!this.container) {
      const div = document.createElement('div');
      div.style.width = '600px';
      div.style.height = '600px';
      div.style.position = 'fixed';
      div.style.left = '99999px';
      document.body.appendChild(div);
      this.container = div;
    }

    this.canvasSize = Math.min(this.container.clientWidth, this.container.clientHeight);

    // Konva.hitOnDragEnabled = true;
    // Konva.captureTouchEventsEnabled = true;
  }
  async init({productCode, templateCode, productDataIn}): Promise<any> {
    this.templateCode = templateCode
    const promisesArr = [this.initTransformer()]
    if(!productDataIn){
      promisesArr.push(this.dataProcessor.getProductData(productCode))
    }
    templateCode && promisesArr.push(this.dataProcessor.getTemplateData(templateCode))

    const [
      assets,
      productData,
      templateData
    ] = await Promise.all(promisesArr)

    this.productData = !productDataIn?convertProductData(productData):productDataIn
    this.templateData = templateData

    this.colorId = this.defaultSetting?.color || this.productData.default_values.color;
    this.viewId = this.defaultSetting?.view || this.productData.default_values.view;
    this.getPartCheckedList();
    this.layerToImageOrCanvas = needImageOrcanvas(this.productData)
    const views = this.productData.views
    const promiseArr: Array<Promise<any>> = [];
    views?.forEach((view) => {
      promiseArr.push(this.initProductView(view));
    });
    await Promise.all(promiseArr);

    if (templateCode) {
      await this.addTemplate({data: templateData})
    }

    return this.stageObj;
  }

  async initProductView(view: View, dom?: HTMLElement): Promise<any> {
    if (!dom) {
      const w = this.container?.clientWidth,
        h = this.container?.clientHeight;
      dom = document.createElement('div');
      dom.style.width = w + 'px';
      dom.style.height = h + 'px';
      dom.style.position = 'absolute';
      dom.style.left = this.viewId == view.id ? '0' : `${w}px`;
      dom.style.top = '0';
      if (this.canvasConfig?.animation) {
        dom.style.transition = 'all 0.4s';
      }
      dom.setAttribute('viewId', String(view.id));
      this.container.appendChild(dom);
    }
    this.stageObj[view.id] = new Konva.Stage({
      container: dom,
      width: dom.clientWidth,
      height: dom.clientHeight,
      x: this.canvasConfig?.x || 0,
      y: this.canvasConfig?.y || 0,
    });
    await this.createDesignLayer(view);
    this.viewImgArr.push({ id: view.id, name: view.name });
    const n = {
      id: view.print_area.id, //打印区域id
      defaultViews: view.id, //默认哪一面
      printArea: view.print_area, //打印区域
      config: this.convertDefaultConfig({
        width: view.print_area.width,
        height: view.print_area.height,
      }),
    };
    // @ts-ignore
    this.cacheProductPrintAreas.push(n);

    this.initStageEvent(view.id);

    return this.stageObj[view.id];
  }

  private async createDesignLayer(view: View): Promise<any> {
    const ratio = view.print_area.view_width / this.canvasSize;
    const currentStage = this.stageObj[view.id];
    
    const {printArea: printAreaConfig} = this.defaultSetting;

    const designLayer = new Konva.Layer({
      name: 'designLayer',
      x: 0,
      y: 0,
      ratio: ratio,
      printAreaId: view.print_area.id,
      viewId: view.id,
      softSvg: view.print_area.soft_svg,
    });

    const designContainerGroup = new Konva.Group({
      name: 'designContainerGroup',
      x: view.print_area.offset_x / ratio,
      y: view.print_area.offset_y / ratio,
      width: view.print_area.width / ratio,
      height: view.print_area.height / ratio,
    });
    designContainerGroup.clip({
      x: 0,
      y: 0,
      width: designContainerGroup.width(),
      height: designContainerGroup.height(),
    });

    const designContainer = new Konva.Rect({
      name: 'print_area_border_outer',
      x: 0,
      y: 0,
      width: view.print_area.width / ratio,
      height: view.print_area.height / ratio,
      stroke: printAreaConfig?.stroke || '#14C9C9',
      strokeWidth: printAreaConfig?.strokeWidth || 3,
      dash: [5, 5],
      listening: false,
    });

    designContainerGroup.add(designContainer);
    designLayer.add(designContainerGroup);
    currentStage.add(designLayer);

    const promiseArr: Array<Promise<any>> = [];
    const typesArr: Array<number> = [];
    // 1:设计辅助线, 2:全幅安全线, 3:底图, 4:肌理图
    view.point_svg && this.defaultSetting.isShowAuxiliaryLine && typesArr.push(1);
    view.pointout_print_areas?.soft_svg && this.defaultSetting.isShowSafeLine && typesArr.push(2);
    // 没有设置印刷区域辅助线时, 显示底图和肌理图
    if (!view.print_area?.soft_svg) {
      this.defaultSetting.isShowBaseMap && typesArr.push(3);
      this.defaultSetting.isShowTexture && typesArr.push(4);
    }
    typesArr.forEach((type) => {
      promiseArr.push(
        this.addDesignLayerCont({
          layer: designLayer,
          view,
          ratio,
          type,
        })
      );
    });
    await Promise.all(promiseArr);
    this.baseMoveToTop(currentStage);
    designLayer.batchDraw();
    return designLayer;
  }

  private initStageEvent(viewId: number): void{
    const {stage, layer} = this.getCurStageLayer(viewId);

    stage.on('mousedown touchstart click', e => {
      if(e.target === stage){
        this.unselectAll(viewId);
      }
    })

    // 点击空白区域解绑元素
    // stage.on('click tap', e => {
    //   if(this.userEvent.pinchFlag || this.userEvent.panFlag || this.userEvent.transformFlag) return;
    //   if(e.target === stage){
    //     this.unselectAll(viewId);
    //   }
    // });

    // 双指缩放操作start
    // const hammer: any = new Hammer(stage, {domEvents: true});
    // hammer.get('pinch').set({ enable: true });

    // let startScaleX, startScaleY;
    // hammer.on('pinchstart', ev => {
    //   if(!this.curNode || this.userEvent.transformFlag || this.userEvent.panFlag) return;
    //   // console.log('pinchstart')
    //   this.userEvent.pinchFlag = true;
    //   startScaleX = this.curNode.scaleX() || 1;
    //   startScaleY = this.curNode.scaleY() || 1;
    // })
    // hammer.on('pinch', ev => {
    //   if(!this.curNode || this.userEvent.transformFlag || this.userEvent.panFlag) return;
    //   // console.log('pinch')
    //   this.curNode.scaleX(startScaleX * ev.scale);
    //   this.curNode.scaleY(startScaleY * ev.scale);
    //   this.anchorGroupForceUpdate();
    //   this.checkOverSpread();
    //   layer.batchDraw();
    // })
    // hammer.on('pinchend', ev => {
    //   if(!this.curNode || this.userEvent.transformFlag || this.userEvent.panFlag) return;
    //   // console.log('pinchend')
    //   // 当双指缩放结束后, 延迟还原pinchFlag标识, 避免解绑元素
    //   this.userEvent.pinchTimer && clearTimeout(this.userEvent.pinchTimer);
    //   this.userEvent.pinchTimer = setTimeout(() => {
    //     this.userEvent.pinchFlag = false;
    //   }, 10);

    //   const {tileType, spacingH, spacingV} = this.curNode.getAttrs();
    //   this.drawRepeatType(tileType, this.curNode, spacingH, spacingV, false).then(() => {
    //     this.curNode && this.addHistoryBySystem('图层变换', this.viewId, {
    //       nodeId: this.curNode.getAttrs().historyId
    //     });
    //     this.emit('transformend');
    //   });
    // })
    // // 双指缩放操作end

    // // 拖动start
    // let startX, startY, ePoint;
    // hammer.on('panstart', (ev) => {
    //   if(!this.curNode || this.userEvent.transformFlag || this.userEvent.pinchFlag) return;
    //   // console.log('panstart')
    //   this.userEvent.panFlag = true;
    //   startX = this.curNode.x();
    //   startY = this.curNode.y();
    //   ePoint = ev.center;
    // })
    // hammer.on('panmove', (ev) => {
    //   if(!this.curNode || this.userEvent.transformFlag || this.userEvent.pinchFlag) return;
    //   // console.log('panmove')
    //   this.curNode.x(startX + ev.center.x - ePoint.x);
    //   this.curNode.y(startY + ev.center.y - ePoint.y);
    //   this.nodeSnapping();
    //   this.anchorGroupForceUpdate();
    //   this.checkOverSpread();
    //   layer.batchDraw();
    // })
    // hammer.on('panend', (ev) => {
    //   if(!this.curNode || this.userEvent.transformFlag || this.userEvent.pinchFlag) return;
    //   // console.log('panend')
    //   this.userEvent.panTimer && clearTimeout(this.userEvent.panTimer);
    //   this.userEvent.panTimer = setTimeout(() => {
    //     this.userEvent.panFlag = false;
    //   }, 10);

    //   this.removeSnapGuideLine();
    //   const {tileType, spacingH, spacingV} = this.curNode.getAttrs();
    //   this.drawRepeatType(tileType, this.curNode, spacingH, spacingV, false).then(() => {
    //     this.curNode && this.addHistoryBySystem('图层变换', this.viewId, {
    //       nodeId: this.curNode.getAttrs().historyId
    //     })
    //     this.emit('dragend');
    //   });
    // })
    // 拖动end
  }

  // 调整面的位置
  adjustViewPos(x: number = 0, y: number = 0, viewId: number = this.viewId){
    let views = this.productData.views;
    if(viewId){
      views = views.filter(v => v.id = viewId);
    }
    views?.forEach(v => {
      const stage = this.stageObj[v.id];
      stage.x(x);
      stage.y(y);
      stage.batchDraw();
    })
  }

  public changeView(viewId: number) {
    this.viewId = viewId;
    if (this.container.children) {
      Array.from(this.container.children).forEach((v: HTMLElement) => {
        const vid = v.getAttribute('viewId');
        v.style.left = vid == String(viewId) ? '0' : 9999 + 'px';
      });
    }
  }

  public async changeColor(colorId: number): Promise<any> {
    this.colorId = colorId;
    // 切换颜色更换每个面的底图和肌理图
    const updateView = async (view) => {
      const promiseArr: Array<Promise<any>> = [];
      const {stage, layer} = this.getCurStageLayer(view.id);
      const isShowBaseMap = !view.print_area?.soft_svg && this.defaultSetting.isShowBaseMap;
      const isShowTexture = !view.print_area?.soft_svg && this.defaultSetting.isShowTexture;
      if(isShowBaseMap){
        const product_type_view = layer.findOne('.product_type_view');
        if(product_type_view){
          const { productViewImg } = this.getProductViewImgUrl(colorId, view.id);
          const replaceImg = async () => {
            const [image] = await loadImgs([productViewImg]);
            product_type_view.image(image);
            return;
          }
          productViewImg && promiseArr.push(replaceImg())
        } else {
          promiseArr.push(
            this.addDesignLayerCont({
              layer,
              view,
              ratio: layer.getAttrs().ratio,
              type: 3,
            })
          )
        }
      } else {
        layer.findOne('.product_type_view')?.destroy();
      }
      if(isShowTexture){
        const product_type_BaseMap = layer.findOne('.product_type_BaseMap');
        if(product_type_BaseMap){
          const { productTextureImg } = this.getProductViewImgUrl(colorId, view.id);
          const replaceImg = async () => {
            const [image] = await loadImgs([productTextureImg]);
            product_type_BaseMap.image(image);
            return;
          }
          productTextureImg && promiseArr.push(replaceImg())
        } else {
          promiseArr.push(
            this.addDesignLayerCont({
              layer,
              view,
              ratio: layer.getAttrs().ratio,
              type: 4,
            })
          )
        }
      } else {
        layer.findOne('.product_type_BaseMap')?.destroy();
      }
      await Promise.all(promiseArr);
      this.baseMoveToTop(stage);
      layer.batchDraw();
      return;
    }

    const promises: Array<Promise<any>> = [];
    this.productData.views?.forEach((view) => {
      promises.push(updateView(view));
    })
    await Promise.all(promises);
    this.emit('changeColor')
    return;
  }

  emptyDesign(viewId: number = this.viewId, isAddHistory:boolean = true): void {
    const { layer } = this.getCurStageLayer(viewId);
    layer.find('.design')?.destroy();
    layer.find('.repeatImgGroup').destroy();
    this.unselectAll();

    isAddHistory && this.addHistoryBySystem('清空', viewId);
  }

  addBgColor({
                       color,
                       viewId,
                       nodeItem = null,
                       isAddHistory = true
                     }: {
    color,
    viewId,
    nodeItem?: any,
    isAddHistory?: boolean,
  }) {
    return new Promise((resolve) => {
      if (this.isDestroy) return;
      const curS = this.getCurStageLayer(viewId);
      const layer = curS.layer;
      const designContainerGroup = curS.designContainerGroup;
      let bgRect: any = null;
      let historyName: any = '';
      if (layer.findOne('.bgRect')) {
        if (!color || color == 'transparent') {
          layer.findOne('.bgRect').destroy();
          historyName = '清空背景色'
        } else {
          layer.findOne('.bgRect').fill(color);
          historyName = '设置背景色'
        }
      } else {
        bgRect = new Konva.Rect({
          x: 0,
          y: 0,
          width: layer.findOne('.print_area_border_outer').width(),
          height: layer.findOne('.print_area_border_outer').height(),
          fill: color,
          name: 'bgRect design template',
          listening: false,
        });
        nodeItem && bgRect.setAttrs({conf_id: nodeItem.id, conf_info: nodeItem.conf_info});
        bgRect.addName(`design${bgRect._id}`);
        designContainerGroup.add(bgRect);
        bgRect.moveToBottom();
        historyName = '设置背景色';
      }
      layer.batchDraw();

      isAddHistory && this.addHistoryBySystem(historyName, viewId);

      // this.viewNodeObj[viewId].childrens.push({
      //   type: 'bgColor',
      //   node: layer.findOne(".bgRect"),
      // })
      resolve(layer.findOne('.bgRect'));
    });
  }
  setDestory(data) {
    this.isDestroy = data;
  }
  destroy() {
    this.isDestroy = true;
    for (const key in this.stageObj) {
      this.stageObj[key].destroy();
    }
    DesignerGlobals.threeDApp.forEach((item) => {
      item.drawApp.destroy();
      item.drawApp = null;
    });
    const controlImgCanvas = document.getElementById('controlImgCanvas');
    if (controlImgCanvas) {
      controlImgCanvas.parentNode.removeChild(controlImgCanvas);
    }
    // document.body.removeChild(this.container);
    this.container.innerHTML = ''
  }
}

export default Base