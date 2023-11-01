import {Designer} from "./types";

interface Template extends Designer {}

class Template {

  async addTemplate({code, data, callBack}: {code?, data?, callBack?}) {
    this.changeNodeList = []
    let templateData
    if (code) {
      templateData = await this.dataProcessor.getTemplateData(code)
    }else {
      templateData = data
    }

    this.deleteTemplateNode({ viewId: null, callBack: null });
    this.konvaJson = {};
    this.reCombinKonvaJson(templateData.cfg, templateData.views, this.productData);
    await this.addElement();
    if(callBack) { //简版
      for(let item of this.productData.views) {
        this.getCanvasImage(item.id, 'canvas');
      }
      callBack({canvasObj: this.viewImgArr})
    }
  }

  deleteTemplateNode({ viewId, callBack }) {
    /**
     * viewId：简版自定义底板，可以删除已添加的图片，故传viewid删除当前面的图片
     * callBack：简版选择自定义底板需要删除掉之前选中的底板，返回空白的canvas
     */
    const keyArr = [];
    for (const key in this.stageObj) {
      if (viewId && `${viewId}` === key) {
        keyArr.push(key);
        break;
      }
      if (!viewId) {
        keyArr.push(key);
      }
    }
    keyArr.forEach((key) => {
      const designLayer = this.stageObj[key].findOne('.designLayer');
      designLayer.find('.design').forEach((node) => {
        node.destroy();
        designLayer.find(`.repeatImgGroup${node._id}`).destroy();
      });
    });
    if (callBack) {
      this.productData.views.forEach((item) => {
        this.getCanvasImage(item.id);
      });
      callBack(this.viewImgArr);
    }
  }
}

export default Template