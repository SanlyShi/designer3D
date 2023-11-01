import { Designer } from "../types";
import { loadImgs } from "../utils";
import { linkageDesign } from "../designerLogicProcess";

interface Flip extends Designer {}

class Flip {
  async flip({
    type,
    node = this.curNode,
    isReduction = false,
    isAddHistory = true,
  }: {
    type: string;
    node?: any;
    isReduction?: boolean;
    isAddHistory?: boolean;
  }): Promise<any> {
    const layer = node.getLayer();
    const viewId = layer.getAttrs()?.viewId;
    const designObj = linkageDesign(
      this.productData,
      this.stageObj,
      viewId,
      node
    );

    const promises: Array<Promise<any>> = [];
    for (let vid in designObj) {
      designObj[vid]?.forEach((item) => {
        if (item.node) {
          if (item.node.hasName("designImg")) {
            promises.push(
              this.flipImage({
                type,
                node: item.node,
                isReduction,
                isAddHistory,
              })
            );
          } else if (item.node.hasName("designText")) {
            this.flipText({ type, node: item.node, isAddHistory });
          }
        }
      });
    }
    Promise.length && (await Promise.all(promises));
    return;
  }

  async flipImage({
    type,
    node = this.curNode,
    isReduction = false,
    isAddHistory = true,
  }: {
    type: string;
    node?: any;
    isReduction?: boolean;
    isAddHistory?: boolean;
  }): Promise<any> {
    if (!node) return;
    const nodeAttrs = node.getAttrs();
    let width = node.width(),
      height = node.height(),
      imgUrl = nodeAttrs.flipImgUrl;
    if (nodeAttrs.isclip) {
      const { imgAttrs, pathAttrs } = nodeAttrs.clipData;
      width =
        (width * (imgAttrs.width * imgAttrs.scaleX)) /
        (pathAttrs.width * pathAttrs.scaleX);
      height =
        (height * (imgAttrs.height * imgAttrs.scaleY)) /
        (pathAttrs.height * pathAttrs.scaleY);
      imgUrl = imgAttrs.originImg;
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context: any = canvas.getContext("2d");
    const [image] = await loadImgs([imgUrl]);
    if (type == "leftRightMirror") {
      node.setAttrs({ xFlip: nodeAttrs.xFlip ? false : true });
      context.scale(-1, 1);
      context.drawImage(image, -canvas.width, 0, canvas.width, canvas.height);
    } else if (type == "upDownMirror") {
      node.setAttrs({ yFlip: nodeAttrs.yFlip ? false : true });
      context.scale(1, -1);
      context.drawImage(image, 0, -canvas.height, canvas.width, canvas.height);
    }
    const flipUrl = canvas.toDataURL();
    const imageData = JSON.parse(JSON.stringify(nodeAttrs.imageData));
    imageData.designImg = flipUrl;
    imageData.designImg3 = flipUrl;
    if (nodeAttrs.isclip) {
      let clipData = JSON.parse(JSON.stringify(node.getAttrs().clipData));
      clipData = this.updateClipData(node, type);
      clipData.imgAttrs.originImg = flipUrl;
      let clipUrl = await this.getClipImage(clipData);
      let [clipImage] = await loadImgs([clipUrl]);
      node.image(clipImage);
      node.setAttrs({ clipData, flipImgUrl: clipUrl, imageData });
    } else {
      const [flipImage] = await loadImgs([flipUrl]);
      node.image(flipImage);
      node.setAttrs({ image: flipImage, flipImgUrl: flipUrl, imageData });
    }
    if (isReduction) return;
    await this.drawRepeatType(
      nodeAttrs.tileType,
      node,
      nodeAttrs.spacingH,
      nodeAttrs.spacingV,
      false
    );

    const layer = node.getLayer();
    const viewId = layer.getAttrs()?.viewId;

    isAddHistory &&
      this.addHistoryBySystem("图层变换", viewId, {
        nodeId: nodeAttrs.historyId,
      });
    return;
  }

  flipText({
    type,
    node = this.curNode,
    isAddHistory = true,
  }: {
    type: string;
    node?: any;
    isAddHistory?: boolean;
  }): void {
    if (!node) return;
    const layer = node.getLayer();
    const viewId = layer.getAttrs().viewId;
    if (type == "leftRightMirror") {
      node.scaleX(-node.scaleX());
      // node.to({
      //   scaleX: -node.scaleX(),
      //   duration: 0,
      //   onFinish: () => {
      //     isAddHistory && this.addHistoryBySystem('图层变换', viewId, {
      //       nodeId: node.getAttrs().historyId
      //     });
      //   }
      // })
    } else if (type == "upDownMirror") {
      node.scaleY(-node.scaleY());
      // node.to({
      //   scaleY: -node.scaleY(),
      //   duration: 0,
      //   onFinish: () => {
      //     isAddHistory && this.addHistoryBySystem('图层变换', viewId, {
      //       nodeId: node.getAttrs().historyId
      //     });
      //   }
      // })
    }

    isAddHistory &&
      this.addHistoryBySystem("图层变换", viewId, {
        nodeId: node.getAttrs().historyId,
      });
  }
}

export default Flip;
