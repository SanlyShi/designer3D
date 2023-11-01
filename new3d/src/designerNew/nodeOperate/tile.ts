import { Designer } from "../types";
import { loadImgs } from "../utils";
import Konva from "../dependence/konva7.2.1";

interface Tile extends Designer {}

class Tile {
  async drawRepeatType(
    type: string,
    node: any,
    spacingH: number,
    spacingV: number,
    isAddHistory: boolean = true
  ): Promise<any> {
    node.setAttrs({ tileType: type, spacingH: spacingH, spacingV: spacingV });
    const currentStage = node.getStage();
    const layer = node.getLayer();
    const viewId = layer.getAttrs().viewId;
    const designContainerGroup = currentStage.findOne(".designContainerGroup");
    const repeatImgGroup = currentStage.findOne(`.repeatImgGroup${node._id}`);
    if (!type) {
      if (repeatImgGroup) {
        node.moveTo(designContainerGroup);
        node.zIndex(repeatImgGroup.getZIndex());
        repeatImgGroup.destroy();
      }
      layer.batchDraw();

      isAddHistory &&
        this.addHistoryBySystem("移除平铺", viewId, {
          nodeId: node.getAttrs()?.historyId,
        });
      return;
    }
    const printAreaBorderOuter = currentStage.findOne(
      ".print_area_border_outer"
    );
    const rotateNodePoint = this.getRotateNodePoint({ node: node, layer });

    const canvas = document.createElement("canvas");
    canvas.width = printAreaBorderOuter.width() * 3;
    canvas.height = printAreaBorderOuter.height() * 3;
    const width = Math.abs(node.width() * node.scaleX()) * 3, //放大三倍 解决模糊问题
      height = Math.abs(node.height() * node.scaleY()) * 3;
    const context: any = canvas.getContext("2d");
    const [img] = await loadImgs([node.getAttrs().flipImgUrl]);
    const ratio = layer.getAttrs().ratio;
    const spacingHMM = (spacingH / ratio) * 3; //后端mm计算，单位换算mm
    const spacingVMM = (spacingV / ratio) * 3; //后端mm计算，单位换算mm
    const JQspacingH = spacingHMM / 2;
    const JQspacingV = spacingVMM / 2;
    const canvasTemp: HTMLCanvasElement = document.createElement("canvas");
    const contextTemp: any = canvasTemp.getContext("2d");
    if (type == "basicsTile") {
      canvasTemp.width = width + spacingHMM;
      canvasTemp.height = height + spacingVMM;

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
      contextTemp.drawImage(img, JQspacingH, -0.5 * height, width, height);
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
    const pattern = context.createPattern(canvasTemp, "repeat");
    // let a = Math.sin(image.attrs.rotation * (Math.PI / 180)) * canvas.width
    // let b = Math.cos(image.attrs.rotation * (Math.PI / 180)) * canvas.width
    // let i = b / 2
    // let j = a / 2
    // console.log('sss', i, j)
    const r = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)) / 2; //图片中心点绕圆旋转的半径
    const oringAngle = Math.atan(height / width); //两个图片中心点的初始角度
    const tansAngle = (node.rotation() * Math.PI) / 180 + oringAngle; //旋转后两个图片中心点的角度
    //兼容火狐
    const svgM = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const matrix = svgM.createSVGMatrix();
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

    const base = canvas.toDataURL("image/png", 1.0);
    const [repeatImg] = await loadImgs([base]);
    if (repeatImgGroup) {
      node.moveTo(designContainerGroup);
      node.zIndex(repeatImgGroup.getZIndex());
      repeatImgGroup.destroy();
    }
    //有选中平铺效果
    const images = new Konva.Image({
      x: 0,
      y: 0,
      image: repeatImg,
      name: `repeatImg${node._id}`,
      scaleX: 1 / 3,
      scaleY: 1 / 3,
    });
    const group = new Konva.Group({
      x: 0,
      y: 0,
      name: `repeatImgGroup repeatImgGroup${node._id}`,
    });
    designContainerGroup.add(group);
    group.add(images);
    group.zIndex(node.getZIndex());
    node.moveTo(group);
    // group.on("click tap", () => {
    //   this.selectNode([node]);
    // });
    group.on("mousedown touchstart", () => {
      this.selectNode([node]);
    });
    layer.batchDraw();

    isAddHistory &&
      this.addHistoryBySystem("图案平铺", viewId, {
        nodeId: node.getAttrs().historyId,
      });
    return;
  }
}

export default Tile;
