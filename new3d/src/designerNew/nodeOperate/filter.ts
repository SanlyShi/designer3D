import { Designer } from "../types";
import axios from "axios";
import { loadImgs } from "../utils";

interface Filter extends Designer {}

class Filter {
  async changeImageFilter(data, isAddHistory: boolean = true): Promise<any> {
    const { render_code, params, node } = data;
    if (render_code) {
      const res = await axios.get(
        `${location.origin}/v1/Render/${render_code}`,
        {
          params: params,
        }
      );
      if (res.data.code == "success") {
        node.setAttrs({
          // filterType: render_code,
          rendercode: render_code,
          render_id: res.data.data.render_id,
        });
        return res.data;
      }
    } else {
      node.setAttrs({ rendercode: "", render_id: "" });

      isAddHistory &&
        this.addHistoryBySystem("图片滤镜", node.getLayer()?.getAttrs()?.viewId, {
          historyId: node.getAttrs().historyId,
        });
      return null;
    }
  }

  async replaceFilter({
    node,
    url,
    isReduction = false,
    isAddHistory = true,
  }): Promise<any> {
    const viewId = node.getLayer().getAttrs("viewId");
    const curS: any = this.getCurStageLayer(viewId);
    const designLayer = curS.layer;
    const [newImage]: Array<any> = await loadImgs([url]);
    const oldImgData = {
      width: node.width(),
      height: node.height(),
    };
    const nodeAttrs = node.getAttrs();
    if (nodeAttrs.isclip) {
      const { imgAttrs, pathAttrs } = nodeAttrs.clipData;
      oldImgData.width =
        (oldImgData.width * (imgAttrs.width * imgAttrs.scaleX)) /
        (pathAttrs.width * pathAttrs.scaleX);
      oldImgData.height =
        (oldImgData.height * (imgAttrs.height * imgAttrs.scaleY)) /
        (pathAttrs.height * pathAttrs.scaleY);
    }
    node.image(newImage);
    node.setAttrs({
      flipImgUrl: url,
      scaleX: node.scaleX() / (newImage.width / oldImgData.width), //为了清晰度新增了designimg3 1200px，滤镜接口没改，返回的图片是800，这里要重新计算缩放
      scaleY: node.scaleY() / (newImage.height / oldImgData.height),
      // initScaleX: node.getAttrs().widthMM / designLayer.getAttrs().ratio / newImage.width,
      // initScaleY: node.getAttrs().heightMM / designLayer.getAttrs().ratio / newImage.height,
      offsetX: newImage.width / 2,
      offsetY: newImage.height / 2,
    });
    if (isReduction) return { node, curS, viewId };

    designLayer.batchDraw();

    isAddHistory &&
      this.addHistoryBySystem("图片滤镜", viewId, {
        historyId: nodeAttrs.historyId,
      });
    return { node, curS, viewId };
  }
}

export default Filter;
