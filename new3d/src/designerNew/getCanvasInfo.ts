import {Designer, ProgramType} from "./types";
import {DesignerGlobals} from './base'

interface GetCanvasInfo extends Designer {}

class GetCanvasInfo {

  getRotateNodePoint({ node, layer = null }: { node: any; layer: any }) {
    let boundingBox: any;
    if (layer) {
      const designContainerGroup = layer.findOne('.designContainerGroup');
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

  getCurStageLayer(viewId: number = this.viewId): any {
    const stage = this.stageObj[`${viewId}`];
    const layer = stage.findOne('.designLayer');
    const designRect = layer.findOne('.print_area_border_outer');
    const designContainerGroup = layer.findOne('.designContainerGroup');
    return {
      stage: stage,
      layer: layer,
      designRect: designRect,
      designContainerGroup,
    };
  }

  getCanvasImage(viewId: number, imgOrCanvas) {
    if(imgOrCanvas) this.layerToImageOrCanvas = imgOrCanvas
    for (const item of this.viewImgArr) {
      if (item.id == viewId) {
        const curS = this.getCurStageLayer(viewId);
        const designContainerGroup = curS.designContainerGroup.clone();
        if(this.options.programType === ProgramType.SIMPLE) {
          this.changeNodeDisplayOnCanvas(true, designContainerGroup)
        }
        designContainerGroup.findOne('.print_area_border_outer').destroy();
        if (this.layerToImageOrCanvas === 'image' || this.layerToImageOrCanvas === 'both') {
          item.viewDesign = designContainerGroup.toDataURL({
            mimeType: 'image/png',
            quality: 1,
            pixelRatio: 800 / this.canvasSize,
            x: designContainerGroup.x(),
            y: designContainerGroup.y(),
            width: designContainerGroup.width(),
            height: designContainerGroup.height(),
          });
          
        }
        if (this.layerToImageOrCanvas === 'canvas' || this.layerToImageOrCanvas === 'both') {
          item.viewDesignCanvas = designContainerGroup.toCanvas({
            x: 0,
            y: 0,
            quality: 1,
            pixelRatio: 800 / this.canvasSize,
            width: this.canvasSize,
            height: this.canvasSize,
          });
        }
        designContainerGroup.destroy();
      }
    }
  }
  getKonvaCanvasOrImage(viewId, imgOrCanvas: string) {
    let productView = JSON.parse(JSON.stringify(this.productData.views))
    if(viewId) {
      productView = [JSON.parse(JSON.stringify(this.productData.views.find(item => item.id == viewId)))]
    }
    for(let item of this.productData.views) {
      this.getCanvasImage(item.id, imgOrCanvas);
    }
    return this.viewImgArr
  }
  getNodeText(group = this.curNode) {
    return group?.findOne('Text')?.text() || ''
  }

  public getStageObj() {
    return this.stageObj;
  }

  public getCurNode() {
    return this.curNode;
  }

  public getCurView(){
    return this.viewId
  }

  public getCurColor(){
    return this.colorId
  }

  public getCanvasSize() {
    return this.canvasSize;
  }

  getMasterImgInfo(colorId) {
    let colors, index = 0, curColorId = colorId;
    if (colorId) {
      colors = this.productData.colors.find((item: any) => item.id == colorId);
    } else {
      colors = this.productData.colors[0];
      curColorId = colors.id
    }
    try{
      colors
    } catch(e) {
      console.error('当前产品不存在传入的颜色');
      return
    }
    if (!colors.detail.length) {
      index = 0;
    } else {
      index = colors.detail.findIndex((item) => item.master === 1)
    }
    return {
      index: index === -1 ? 0 : index,
      colorId: curColorId
    }
  }

  getDetailImgLength(colorId) {
    let colors = this.productData.colors.find((item: any) => item.id == colorId);
    if (!colors.detail.length) {
      return colors.views.length
    } else {
      return colors.detail.length
    }
  }

  getThreeDApp() {
    return DesignerGlobals.threeDApp;
  }
}

export default GetCanvasInfo