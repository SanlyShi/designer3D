import { Designer, ProgramType } from "../types";
import Konva from "../dependence/konva7.2.1";
import { ClearBr, isRisk, loadFont } from "../designerLogicProcess";
import { loadImgs } from "../utils";

interface Crub extends Designer {}

class Crub {
  async addElement() {
    for (const item of this.productData.views) {
      if (this.konvaJson[item.id]) {
        //保存记录还原
        for (const konva of this.konvaJson[item.id]) {
          const node = konva.node;
          if (node.name.indexOf("designImg") != -1) {
            if (isRisk(node.imageData)) {
              console.error("图片信息异常，无法使用");
            } else {
              node.flipImgUrl = node.imageData.designImg3;
              const imageData: any = await this.addImage({
                imageData: node.imageData,
                viewId: item.id,
                recordData: node,
                isSetBg: node.name.indexOf("isBg") > -1,
                // bgApplyAllView: node.name.indexOf("bgApplyAllView") > -1,
                nodeItem: konva.item,
              });
              // console.log('添加图片', imageData);
              await this.drawRepeatType(
                imageData.getAttrs().tileType,
                imageData,
                imageData.getAttrs().spacingH,
                imageData.getAttrs().spacingV,
                false
              );
            }
          } else if (node.name.indexOf("designText") != -1) {
            if (node.oldData) {
              //旧设计器文字还原，只需要把文字还原到初始位置
              // await this.addText({
              //   textNode: node,
              //   viewId: item.id,
              // });
              // .then((data) => {
              //     this.nodeArr.push({type: 'text', node: data, id: konva.id})
              // })
            } else {
              await this.addText({
                viewId: item.id,
                recordData: node,
                nodeItem: konva.item,
                isAddHistory: false,
              });
              // .then((data) => {
              //     this.nodeArr.push({type: 'text', node: data, id: konva.id})
              // })
            }
          } else if (node.name.indexOf("bgRect") != -1) {
            this.addBgColor({
              color: node.fill,
              viewId: item.id,
              nodeItem: konva.item,
              isAddHistory: false,
            });
            // .then((data) => {
            //     this.nodeArr.push({type: 'bgColor', node: data, id: konva.id})
            // })
          }
        }
      }
      this.addHistoryBySystem("init", item.id);
    }
  }

  addImage({
    imageData,
    viewId,
    isSetBg = false,
    // bgApplyAllView = false,
    recordData = null,
    isAddHistory = true,
    nodeItem = null,
  }) {
    return new Promise(async (resolve) => {
      if (this.isDestroy) return;
      const currentStage = this.stageObj[`${viewId}`];
      const designLayer = currentStage.findOne(".designLayer");
      const designRect = designLayer.findOne(".print_area_border_outer");
      const designContainerGroup = designLayer.findOne(".designContainerGroup");
      const ratio = designLayer.getAttrs().ratio;
      let imageWidth = 0,
        imageHeight = 0;
      const imgUrl = recordData ? recordData.flipImgUrl : imageData.designImg3;
      Konva.Image.fromURL(imgUrl, async (image) => {
        const imgSize = this.imgSizeCalculate(imageData, viewId);
        imageWidth = imgSize.width;
        imageHeight = imgSize.height;

        if (recordData) {
          //保存记录还原、切换产品保留图片状态
          image.setAttrs(recordData);
          image.setAttrs({
            widthMM: imageWidth,
            heightMM: imageHeight,
          });
          image.name(`design designImg design${image._id} template`);
          const recordDataLayerScale = recordData.layerScale || 1;
          const canvasRatio = this.canvasSize / 100;

          if (nodeItem) {
            const aTransform = [];
            for (const t of nodeItem.image.transform
              .slice(7, nodeItem.image.transform.length - 1)
              .split(",")) {
              aTransform.push(parseFloat(t));
            }
            const saveWHMM = {
              w: imageWidth * aTransform[0],
              h: imageHeight * aTransform[3],
            };
            if (
              imageWidth != nodeItem.image.width ||
              imageHeight != nodeItem.image.height
            ) {
              saveWHMM.w = parseFloat(nodeItem.image.width) * aTransform[0];
              saveWHMM.h = parseFloat(nodeItem.image.height) * aTransform[3];
            }
            image.scaleX(
              (saveWHMM.w / recordData.ratio / image.width()) * canvasRatio
            );
            image.scaleY(
              (saveWHMM.h / recordData.ratio / image.height()) * canvasRatio
            );
            image.setAttrs({
              conf_id: nodeItem.id,
              conf_info: nodeItem.conf_info,
            });
          }
          image.x(
            (this.canvasSize / (recordData.stageWidth / recordDataLayerScale)) *
              image.x()
          );
          image.y(
            (this.canvasSize / (recordData.stageWidth / recordDataLayerScale)) *
              image.y()
          );

          image.offsetX(image.width() / 2);
          image.offsetY(image.height() / 2);

          if (recordData?.isclip) {
            let clipData = recordData.clipData;
            clipData.imgAttrs.originImg = imgUrl;
            // 应用了滤镜的图片初始返回的大小跟滤镜接口返回的大小不一致，需要更新裁切信息
            clipData.imgAttrs.scaleX =
              (clipData.imgAttrs.scaleX * clipData.imgAttrs.width) /
              image.width();
            clipData.imgAttrs.scaleY =
              (clipData.imgAttrs.scaleY * clipData.imgAttrs.height) /
              image.height();
            clipData.imgAttrs.width = image.width();
            clipData.imgAttrs.height = image.height();
            let clipUrl = await this.getClipImage(clipData);
            let [clipImage] = await loadImgs([clipUrl]);
            image.image(clipImage);
            image.setAttrs({
              offsetX: clipImage.width / 2,
              offsetY: clipImage.height / 2,
              clipData,
            });
          }
        } else {
          image.setAttrs({
            scaleX: imageWidth / ratio / image.width(),
            scaleY: imageHeight / ratio / image.height(),
          });
          image.x(designRect.width() / 2);
          image.y((image.height() * image.scaleY()) / 2);
          image.offsetX(image.width() / 2);
          image.offsetY(image.height() / 2);
          image.name(`design designImg design${image._id} template`);
          
          //图片 清晰度 饱和度  亮度 对比度 色温 色差
          // const colorAjustmentData = {
          //   definition: 0,
          //   saturation: 0,
          //   brightness: 0,
          //   contrast: 0,
          //   colorTemp: 0,
          //   hue: 0,
          // };
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
            draggable: true
            // filterType: '',
          });
        }
        if(this.options.programType === ProgramType.MINI_PROGRAM){
          image.setAttrs({
            // initScaleX: imageWidth / ratio / image.width(),
            // initScaleY: imageHeight / ratio / image.height(),
            draggable: false, //todo: 移动端添加元素默认都是不可移动的,需要选中后才能操作
          });
        }
        if (isSetBg) {
          image.addName("isBg");
        }

        designContainerGroup.add(image);
        if(this.options.programType === ProgramType.SIMPLE) { //简版
          if(!recordData) {
            this.imgMaximization({ viewId, flag: "imgFull", node: image }) //默认最大化铺满
          }
        }
        const historyId = recordData?.historyId || image._id;
        if (this.defaultSetting?.history?.enable) {
          image.setAttrs({ historyId });
        }
        if (!recordData && isAddHistory) {
          this.addHistoryBySystem("添加图片", viewId, { nodeId: historyId });
        }

        resolve(image);
        designLayer.batchDraw();

        // image.on('click tap', (e) => {
        //   this.selectNode([image], true);
        // })
        image.on("mousedown touchstart click", (e) => {
          this.selectNode([image], true);
        });
      });
    });
  }

  addText({
    // textNode = null,
    viewId,
    recordData = null,
    isAddHistory = true,
    nodeItem = null,
  }: {
    // textNode?: any;
    viewId: number;
    recordData?: any;
    isAddHistory?: boolean;
    nodeItem?: any;
  }) {
    return new Promise(async (resolve) => {
      if (this.isDestroy) return;
      /*等待字体加载完成*/
      await loadFont(recordData.proFontFamily, this.dataProcessor);
      const curS = this.getCurStageLayer(viewId);
      const layer = curS.layer;
      const designContainerGroup = curS.designContainerGroup;
      let text: any = null;
      let textGroup: any = null,
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
          align: recordData.textAlign,
          draggable: true
        });
        if(this.options.programType === ProgramType.MINI_PROGRAM){
          text.setAttrs({
            draggable: false, //todo: 移动端添加元素默认都是不可移动的,需要选中后才能操作
          })
        }
        textGroup = new Konva.Group();
        textGroup.name(`design designText design${textGroup._id} template`);
        const recordDataLayerScale = recordData.layerScale || 1;

        const scaleRatio = this.canvasSize / recordData.stageWidth;
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

        textRect = new Konva.Rect({
          width: text.width(),
          height: text.height(),
          listening: false,
          strokeScaleEnabled: false,
          fill: recordData.designFill,
          // draggable: false,
        });
        textGroup.add(textRect);
        textGroup.add(text);
        nodeItem &&
          textGroup.setAttrs({
            conf_id: nodeItem.id,
            conf_info: nodeItem.conf_info,
          });
      }
      designContainerGroup.add(textGroup);

      const historyId = recordData?.historyId || textGroup._id;
      if (this.defaultSetting?.history?.enable) {
        // textGroup.setAttrs({historyId, draggable: false})
        textGroup.setAttrs({ historyId });
      }
      if (!recordData && isAddHistory) {
        this.addHistoryBySystem("添加文字", viewId, { nodeId: historyId });
      }

      layer.batchDraw();
      // this.viewNodeObj[viewId].childrens.push({
      //   type: 'text',
      //   node: textGroup,
      // })
      resolve(textGroup);

      // textGroup.on('click tap', (e) => {
      //   this.selectNode([textGroup], true);
      // })
      textGroup.on("mousedown touchstart click", (e) => {
        this.selectNode([textGroup], true);
      });
    });
  }

  deleteNode(node = this.curNode, isAddHistory: boolean = true): any {
    const layer = node.getLayer();
    const viewId = layer.getAttrs().viewId;
    node.destroy();
    layer.findOne(`.repeatImgGroup${node._id}`)?.destroy();
    this.unselectAll();
    layer.batchDraw();

    isAddHistory &&
      this.addHistoryBySystem("图层删除", viewId, {
        nodeId: node.getAttrs().historyId,
      });
  }

  /**
   * @description: 选中节点
   * @param {Array} nodes 节点数组
   * @param {*} isClick 标识符, true=直接点击触发的选中, false=外部触发选中, 为了区分两者操作以执行不同的动作
   * @return {*}
   */
  async selectNode(
    nodes: Array<any> = [],
    isClick: boolean = true
  ): Promise<void> {
    // if(this.userEvent.pinchFlag || this.userEvent.panFlag || this.userEvent.transformFlag) return;

    if (!nodes.length) return;
    const eventName = isClick ? "nodeClick" : "nodeSelect";
    if (nodes.length === 1) {
      if (nodes[0]._id == this.curNode?._id) return;
      // 不可定制的无法操作
      const attrs = nodes[0].getAttrs();
      if (attrs.conf_info && !attrs.conf_info.can_customized) {
        this.emit(eventName, nodes);
        return;
      }
    }
    const layer = nodes[0].getLayer();
    this.curNode = nodes.length > 1 ? nodes : nodes[0];
    this.hideController();
    // 未选中元素禁用移动, 避免双指缩放时导致未选中元素位置被移动
    if(this.options.programType === ProgramType.MINI_PROGRAM){
      layer.find(".design")?.forEach((node) => {
        node.setAttrs({ draggable: false });
      });
      this.curNode.setAttrs({ draggable: true });
    }
    this.addController(nodes);
    layer.batchDraw();

    this.emit(eventName, nodes);
  }

  unselectAll(viewId = this.viewId): void {
    const { layer } = this.getCurStageLayer(viewId);
    this.curNode = null;
    this.hideController();
    layer.find(".design")?.forEach((node) => {
      node.setAttrs({ draggable: false });
    });
    layer.batchDraw();
    this.emit("releaseNode");
  }

  setNodeText(text, group = this.curNode, isAddHistory = true) {
    if (!group || !group.findOne("Text")) return;
    const textNode = group.findOne("Text");
    group.findOne("Text").text(text);
    group.width(textNode.width());
    group.height(textNode.height());
    group.offsetX(textNode.width() / 2);
    group.offsetY(textNode.height() / 2);
    group.findOne("Rect").width(textNode.width());
    group.findOne("Rect").height(textNode.height());
    const layer = group.getLayer();
    layer.batchDraw();
    this.anchorGroupForceUpdate();

    const viewId = layer.getAttrs().viewId;
    isAddHistory &&
      this.addHistoryBySystem("文字工具", viewId, {
        nodeId: group.getAttrs().historyId,
      });
  }

  setTextNodeColor(color, group = this.curNode, isAddHistory = true) {
    if (!group || !group.findOne("Text")) return;
    group.findOne("Text").fill(color);
    const layer = group.getLayer();
    layer.batchDraw();

    const viewId = layer.getAttrs().viewId;
    isAddHistory &&
      this.addHistoryBySystem("文字工具", viewId, {
        nodeId: group.getAttrs().historyId,
      });
  }

  /**
  * @description: 
  * @param {boolean} isShowAll 是否显示所有节点，为true时画布上的元素都显示，false时只显示传入的nodes节点
  * @param {*} target 存放设计元素的上级元素,如layer, designGroup等
  * @param {Array} nodes
  * @return {*}
  */
  changeNodeDisplayOnCanvas(isShowAll:boolean = true, target, nodes?: Array<any>){
    const getOptNode = node => {
      const pNode = node.getParent();
      const optNode = pNode?.hasName("repeatImgGroup") ? pNode : node;
      return optNode;
    }
    if(isShowAll) {
      target.find('.design')?.forEach(node => getOptNode(node).show());
    } else {
      target.find('.design')?.forEach(node => getOptNode(node).hide());
      nodes?.forEach(node => getOptNode(node).show())
    }   
  }
}

export default Crub;
