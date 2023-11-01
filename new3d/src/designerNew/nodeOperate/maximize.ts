import { Designer } from "../types";

interface Maximize extends Designer {}

class Maximize {
  imgMaximization({ flag, node }) {
    const designRect = node.getLayer().findOne(".print_area_border_outer");
    node.rotation(0);
    const designRectWidth = designRect.width(),
      designRectHeight = designRect.height();
    const widthScale = designRectWidth / node.width();
    const heightScale = designRectHeight / node.height();
    let scale = Math.max(Math.abs(widthScale), Math.abs(heightScale));
    let scaleX = widthScale,
      scaleY = heightScale;

    if (flag == "widthMaximization") {
      scaleX = widthScale;
      scaleY = widthScale;
    } else if (flag == "heightMaximization") {
      scaleX = heightScale;
      scaleY = heightScale;
    } else if (flag == "imgFull") {
      scaleX = scale;
      scaleY = scale;
    } else if (flag == "restore") {
      // scaleX = node.getAttrs().initScaleX;
      // scaleY = node.getAttrs().initScaleY;
      const ratio = node.getLayer().getAttrs().ratio;
      scaleX = node.getAttrs().widthMM / ratio / node.width();
      scaleY = node.getAttrs().heightMM / ratio / node.height();
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
}

export default Maximize;
