import defaultConfig from "./defaultConfig";
import Konva from "./dependence/konva7.2.1";
import {loadImgs, overallDesignView} from "./utils";
import {Designer} from "./types";
import { linkageDesign } from "./designerLogicProcess";

interface Controller extends Designer {}

class Controller {

  async initTransformer() {
    const customEle = await this.getCustomControllerEle()
    const options = Object.assign(this.controllerConfig, {
      name: `controler`,
      boundBoxFunc: (oldBox: any, newBox: any): any => {
        return newBox.width < 5 || newBox.height < 5 ? oldBox : newBox;
      },
    });
    this.transformer = new Konva.Transformer(options);
    if (customEle.length) {
      this.anchorGroup = new Konva.Group({ name: 'anchorGroup' });
      this.anchorGroup.add(...customEle);
    }
    this.initControllerEvent(this.transformer);
  }

  async getCustomControllerEle() {
    const customEle = []
    const keys = [
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
      'top',
      'bottom',
      'left',
      'right',
    ];
    for (const key in this.controllerConfig) {
      const { name, icon, size, offset } = this.controllerConfig[key];
      if (keys.includes(key) && icon) {
        const [iconImg] = await loadImgs([icon]);
        const ele = new Konva.Image({
          name: `anchorItem anchor_${name}`,
          image: iconImg,
          width: size || 24,
          height: size || 24,
          listening: !(name == 'rotate' || name == 'transform'),
          visible: true,
          configs: { size, offset, location: key },
          shadowColor: '#1D2129',
          shadowOpacity: 0.1,
          shadowBlur: 6,
          shadowOffsetX: 6,
          shadowOffsetY: 6,
        });
        customEle.push(ele);
        if (name == 'rotate') {
          this.controllerConfig['rotateAnchorPosition'] = key;
        }
        if (name != 'transform' && name != 'rotate') {
          ele.on('mousedown touchstart', (ev) => {
            ev.cancelBubble = true;
            this.emit(name);
          });
        }
      }
    }
    return customEle
  }

  private initControllerEvent(tr: any): void {
    tr.on('dragstart', (e) => {
      // this.userEvent.transformFlag = true;
    });
    tr.on('dragmove', (e) => {
      this.nodeSnapping();
      this.anchorGroupForceUpdate();
      this.checkOverSpread();
    });
    tr.on('dragend', async (e) => {
      // this.userEvent.transformFlag = false;
      this.removeSnapGuideLine();

      const designObj = linkageDesign(this.productData, this.stageObj, this.viewId, this.curNode)
      let overallDesignArr = designObj[9999]
      let currentViewDesignArr = designObj[this.viewId]
      for(let _viewId in designObj) {
        for(let item of designObj[_viewId]) {
          let curNode = item.node
          if(overallDesignArr) {
            curNode = overallDesignArr.find(a => a.node.getAttrs().overallDesignId === item.node.getAttrs().overallDesignId).node
          } else if(item.node.hasName('isBg')) {
            curNode = currentViewDesignArr.find(a => a.node.hasName('isBg')).node
          }
          await this.bgImgLinkageEnd({viewId: _viewId, node: curNode, associateNode: item.node, type: 'drag'});
        }
      }
      this.emit('dragend');

      // const {tileType, spacingH, spacingV} = this.curNode.getAttrs();
      // this.drawRepeatType(tileType, this.curNode, spacingH, spacingV, false).then(() => {
      //   this.addHistoryBySystem('图层变换', this.viewId, {
      //     nodeId: this.curNode.getAttrs().historyId
      //   })
      //   this.emit('dragend');
      // });
    });

    tr.on('transformstart', (e) => {
      // this.userEvent.transformFlag = true;
    });
    tr.on('transform', (e) => {
      this.anchorGroupForceUpdate();
      this.checkOverSpread();
    });
    tr.on('transformend', async (e) => {
      // this.userEvent.transformFlag = false;

      const designObj = linkageDesign(this.productData, this.stageObj, this.viewId, this.curNode)
      let overallDesignArr = designObj[9999]
      let currentViewDesignArr = designObj[this.viewId]
      for(let _viewId in designObj) {
        for(let item of designObj[_viewId]) {
          let curNode = item.node
          if(overallDesignArr) {
            curNode = overallDesignArr.find(a => a.node.getAttrs().overallDesignId === item.node.getAttrs().overallDesignId).node
          } else if(item.node.hasName('isBg')) {
            curNode = currentViewDesignArr.find(a => a.node.hasName('isBg')).node
          }
          await this.bgImgLinkageEnd({viewId: _viewId, node: curNode, associateNode: item.node, type: 'transform'});
        }
      }

      this.emit('transformend');
      // const {tileType, spacingH, spacingV} = this.curNode.getAttrs();
      // this.drawRepeatType(tileType, this.curNode, spacingH, spacingV, false).then(() => {
      //   this.curNode && this.addHistoryBySystem('图层变换', this.viewId, {
      //     nodeId: this.curNode.getAttrs().historyId
      //   })
      //   this.emit('transformend');
      // });
    });
    // 加入移动端事件库后, transformer的点击事件会冒泡到stage上，需要阻止掉
    // tr.on('touchstart', (e) => {
    //   e.cancelBubble = true;
    // })
  }

  anchorGroupForceUpdate(viewId: number = this.viewId): void {
    const { stage, layer } = this.getCurStageLayer(viewId);
    if (!layer.findOne('.anchorGroup')) return;
    const transformer = layer.findOne('Transformer');
    const [scaleX, scaleY] = [layer.scaleX(), layer.scaleY()];
    const ltPoint = {
      x: (transformer.x() - stage.x()) / scaleX,
      y: (transformer.y() - stage.y()) / scaleY,
    };

    const anchorGroup = layer.findOne('.anchorGroup');
    anchorGroup.x(ltPoint.x);
    anchorGroup.y(ltPoint.y);
    anchorGroup.rotation(transformer.rotation() || 0);

    const anchorItems = layer.find('.anchorItem');
    anchorItems.forEach((item: any): void => {
      const { size = 24, offset = 0, location } = item.getAttrs().configs;
      item.width(size / scaleX);
      item.height(size / scaleY);
      switch (location) {
        case 'top-left':
          item.x(-size / 2 / scaleX);
          item.y(-size / 2 / scaleY);
          break;
        case 'top-right':
          item.x((transformer.width() - size / 2) / scaleX);
          item.y(-size / 2 / scaleY);
          break;
        case 'bottom-left':
          item.x(-size / 2 / scaleX);
          item.y((transformer.height() - size / 2) / scaleY);
          break;
        case 'bottom-right':
          item.x((transformer.width() - size / 2) / scaleX);
          item.y((transformer.height() - size / 2) / scaleY);
          break;
        case 'top':
          item.x((transformer.width() / 2 - size / 2) / scaleX);
          item.y((-size - offset) / scaleY);
          break;
        case 'bottom':
          item.x((transformer.width() / 2 - size / 2) / scaleX);
          item.y((transformer.height() + offset) / scaleY);
          break;
        case 'left':
          item.x((-size - offset) / scaleX);
          item.y((transformer.height() / 2 - size) / scaleY);
          break;
        case 'right':
          item.x((transformer.width() + offset) / scaleX);
          item.y((transformer.height() / 2 - size) / scaleY);
          break;
      }
    });
  }

  hideController() {
    this.transformer.detach();
    this.transformer.hide();
    this.anchorGroup.hide();
    this.anchorGroup.remove();
  }

  addController(nodes: Array<any> = []): void {
    this.curNode = nodes[0]
    const layer = nodes[0].getLayer();
    const viewId = layer.getAttrs().viewId;
    layer.add(this.transformer);
    this.transformer.nodes(nodes);
    this.transformer.show();
    layer.add(this.anchorGroup);
    this.anchorGroup.show();
    this.anchorGroupForceUpdate(viewId);
  }

  async imgTransformEnd({viewId, node, type, isGroup=false}) {
    await this.drawRepeatType({
      viewId,
      type: node.getAttrs().tileType,
      node,
      spacingH: node.getAttrs().spacingH,
      spacingV: node.getAttrs().spacingV,
    }).then(() => {
      this.addHistoryBySystem('图层变换', viewId, {
        nodeId: node.getAttrs().historyId
      })
    });
  }
  textTransformEnd({viewId, textGroup}) {
    // this.saveImageData({ node: textGroup, viewId });
    this.addHistoryBySystem('图层变换', viewId, {
      nodeId: textGroup.getAttrs().historyId
    })
  }
  async bgImgLinkageEnd({viewId, node, associateNode, type}) {
    if(viewId != this.viewId) {
      if(associateNode.hasName('isBg')) {
        let nodeAttrs = associateNode.getAttrs()
        const scaleRatioX = associateNode.scaleX() / nodeAttrs.changeStartScaleX
        const scaleRatioY = associateNode.scaleY() / nodeAttrs.changeStartScaleY
        associateNode.setAttrs({
          scaleX: node.scaleX() * scaleRatioX,
          scaleY: node.scaleY() * scaleRatioY,
          x: node.x() * scaleRatioX,
          y: node.y() * scaleRatioY,
          rotation: node.rotation()
        })
        await this.imgTransformEnd({viewId, node: associateNode, type})
      } else {
        this.diffViewTheSameDesign({currentView: this.productData.views.find(v => v.id == viewId), associateProductView: overallDesignView, currentRecordData: node.getAttrs(), associateNode, type: node.type})
        if(node.type == 'image') {
          await this.imgTransformEnd({viewId, node: associateNode, type})
        } else {
          this.textTransformEnd({viewId, textGroup: associateNode})
        }
      }
    } else {
      if(node.type == 'image') {
        await this.imgTransformEnd({viewId, node: associateNode, type})
      } else {
        this.textTransformEnd({viewId, textGroup: associateNode})
      }
    }
  }
}

export default Controller