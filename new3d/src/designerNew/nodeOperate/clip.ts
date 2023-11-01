import { Designer, ClipData, Percent } from "../types";
import { loadImgs } from "../utils";

interface Clip extends Designer {}

class Clip {
  async getClipImage(clipData: ClipData): Promise<string> {
    const { imgAttrs, pathAttrs, clipPath } = clipData;
    const [image] = await loadImgs([imgAttrs.originImg]);
    if (!image) return "";
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx: any = canvas.getContext("2d");
    ctx.save();
    ctx.drawImage(image, 0, 0, image.width, image.height);
    ctx.restore();
    ctx.globalCompositeOperation = "destination-in";

    let pathUrl: string = clipPath.image;
    if (pathAttrs.xFlip || pathAttrs.yFlip) {
      pathUrl = await this.getFlipPath(
        clipPath.image,
        pathAttrs.xFlip,
        pathAttrs.yFlip
      );
    }
    const [pathImg] = await loadImgs([pathUrl]);
    const percent: Percent = this.getClipPercent(clipData);
    const left = percent.left * image.width;
    const top = percent.top * image.height;
    const pathWidth =
      ((pathAttrs.width * pathAttrs.scaleX) /
        (imgAttrs.width * imgAttrs.scaleX)) *
      image.width;
    const pathHeight =
      ((pathAttrs.height * pathAttrs.scaleY) /
        (imgAttrs.height * imgAttrs.scaleY)) *
      image.height;
    ctx.drawImage(pathImg, left, top, pathWidth, pathHeight);

    const oImgData = ctx.getImageData(
      left,
      top,
      left + pathWidth,
      top + pathHeight
    );
    const oCanvas = document.createElement("canvas");
    oCanvas.width = pathWidth;
    oCanvas.height = pathHeight;
    const oCtx: any = oCanvas.getContext("2d");
    oCtx.putImageData(oImgData, 0, 0);
    const url = oCanvas.toDataURL();
    return url;
  }

  async getFlipPath(
    pathUrl: string,
    xFlip = false,
    yFlip = false
  ): Promise<string> {
    const [pathImg]: Array<HTMLImageElement | null> = await loadImgs([pathUrl]);
    if (!pathImg) return "";
    const canvas = document.createElement("canvas");
    canvas.width = pathImg.width;
    canvas.height = pathImg.height;
    const ctx: any = canvas.getContext("2d");
    const left = xFlip ? -pathImg.width : 0;
    const top = yFlip ? -pathImg.height : 0;
    ctx.scale(xFlip ? -1 : 1, yFlip ? -1 : 1);
    ctx.drawImage(pathImg, left, top, canvas.width, canvas.height);
    return canvas.toDataURL();
  }

  getClipPercent(clipData: ClipData): Percent {
    const { imgAttrs, pathAttrs } = clipData;
    return {
      left: pathAttrs.x / (imgAttrs.width * imgAttrs.scaleX),
      top: pathAttrs.y / (imgAttrs.height * imgAttrs.scaleY),
    };
  }

  /**
   * @description: 图片翻转后更新裁切区域位置
   * @param {*} node 操作节点
   * @param {*} type leftRightMirror-水平, upDownMirror-垂直
   * @return {*}
   */
  updateClipData(node, type) {
    let nodeAttrs = JSON.parse(JSON.stringify(node.getAttrs()));
    let clipData = nodeAttrs.clipData;
    let { imgAttrs, pathAttrs } = clipData;
    let percent = this.getClipPercent(clipData);
    if (type == "leftRightMirror") {
      let left = percent.left * imgAttrs.width * imgAttrs.scaleX;
      clipData.pathAttrs.x =
        imgAttrs.width * imgAttrs.scaleX -
        pathAttrs.width * pathAttrs.scaleX -
        left;
      clipData.pathAttrs.xFlip = !clipData.pathAttrs.xFlip;
    } else if (type == "upDownMirror") {
      let top = percent.top * imgAttrs.height * imgAttrs.scaleY;
      clipData.pathAttrs.y =
        imgAttrs.height * imgAttrs.scaleY -
        pathAttrs.height * pathAttrs.scaleY -
        top;
      clipData.pathAttrs.yFlip = !clipData.pathAttrs.yFlip;
    }
    return clipData;
  }

  /**
   * @description: 应用裁切操作
   * @param {any} node 操作节点
   * @param {string} originImg 裁切之前的原图
   * @param {ClipData} clipData 裁切数据
   * @return {*}
   */
  async implementClip(
    node: any,
    originImg: string,
    clipData: ClipData
  ): Promise<void> {
    clipData.imgAttrs.originImg = originImg;
    const clipUrl = await this.getClipImage(clipData);
    const [clipImage]: Array<any> = await loadImgs([clipUrl]);
    node.image(clipImage);
    node.setAttrs({
      offsetX: clipImage.width / 2,
      offsetY: clipImage.height / 2,
      clipData,
    });
    return;
  }
}

export default Clip;
