import { Designer } from "./types";
import Konva from "./dependence/konva7.2.1";

interface Snap extends Designer {}

class Snap {
  // 元素吸附
  public nodeSnapping(node: any = this.curNode): void {
    if (!this.defaultSetting?.nodeSnap?.enable) return;
    this.removeSnapGuideLine();
    const viewId = node.getLayer()?.getAttr('viewId');
    const lineGuideStops = this.getLineGuideStops(node);
    const nodeBounds = this.getNodeSnappingEdges(node);
    const guides = this.getSnappingGuides(lineGuideStops, nodeBounds);
    if (!guides.length) return;
    this.drawSnappingGuides(viewId, guides);
    guides.forEach((lg: any): void => {
      if (lg.orientation == 'V') {
        // node.x(lg.lineGuide + lg.offset);
        node.x(node.x() + lg.diff);
      }
      if (lg.orientation == 'H') {
        // node.y(lg.lineGuide + lg.offset);
        node.y(node.y() + lg.diff);
      }
    });
  }

  // 获取非操作节点图片在水平和垂直位置上的碰撞集合点
  getLineGuideStops(node: any = this.curNode) {
    const stage = node.getStage();
    const designLayer = stage.findOne('.designLayer');
    const printAreaRect = designLayer.findOne('.print_area_border_outer').getClientRect();
    const vertical = [
      printAreaRect.x,
      printAreaRect.x + printAreaRect.width,
      printAreaRect.x + printAreaRect.width / 2,
    ];
    const horizontal = [
      printAreaRect.y,
      printAreaRect.y + printAreaRect.height,
      printAreaRect.y + printAreaRect.height / 2,
    ];
    designLayer.find('.design').forEach((nodeItem) => {
      // 忽略背景图片和当前操作节点
      if (nodeItem.hasName('isBg')) return;
      if (nodeItem == node) return;
      const box = nodeItem.getClientRect();
      vertical.push([box.x, box.x + box.width, box.x + box.width / 2]);
      horizontal.push([box.y, box.y + box.height, box.y + box.height / 2]);
    });
    // 加入标尺线的碰撞集合点
    const vRulerLines = document.querySelectorAll('.ruler-line.vertical');
    const hRulerLines = document.querySelectorAll('.ruler-line.horizontal');
    vRulerLines?.forEach((l: HTMLElement) => {
      vertical.push(parseFloat(l.style.left));
    });
    hRulerLines?.forEach((l: HTMLElement) => {
      horizontal.push(parseFloat(l.style.top));
    });
    return {
      vertical: vertical.flat(),
      horizontal: horizontal.flat(),
    };
  }

  // 获取操作节点的碰撞集合点
  getNodeSnappingEdges(node: any): any {
    const box = node.getClientRect();
    const [nodeX, nodeY] = [node.x(), node.y()];
    return {
      vertical: [
        {
          snap: 'start',
          guide: Math.round(box.x),
          offset: Math.round(nodeX - box.x),
        },
        {
          snap: 'center',
          guide: Math.round(box.x + box.width / 2),
          offset: Math.round(nodeX - box.x - box.width / 2),
        },
        {
          snap: 'end',
          guide: Math.round(box.x + box.width),
          offset: Math.round(nodeX - box.x - box.width),
        },
      ],
      horizontal: [
        {
          snap: 'start',
          guide: Math.round(box.y),
          offset: Math.round(nodeY - box.y),
        },
        {
          snap: 'center',
          guide: Math.round(box.y + box.height / 2),
          offset: Math.round(nodeY - box.y - box.height / 2),
        },
        {
          snap: 'end',
          guide: Math.round(box.y + box.height),
          offset: Math.round(nodeY - box.y - box.height),
        },
      ],
    };
  }

  // 寻找吸附的水平和垂直线位置
  getSnappingGuides(lineGuideStops, nodeBounds): Array<any> {
    const GUIDELINE_OFFSET = this.defaultSetting?.nodeSnap?.offset || 5;
    const resultV: Array<any> = [];
    const resultH: Array<any> = [];
    lineGuideStops.vertical.forEach((lineGuide) => {
      nodeBounds.vertical.forEach((nodeBound) => {
        const diff: number = lineGuide - nodeBound.guide;
        if (Math.abs(diff) < GUIDELINE_OFFSET) {
          resultV.push({
            lineGuide: lineGuide,
            diff: diff,
            snap: nodeBound.snap,
            offset: nodeBound.offset,
          });
        }
      });
    });
    lineGuideStops.horizontal.forEach((lineGuide) => {
      nodeBounds.horizontal.forEach((nodeBound) => {
        const diff: number = lineGuide - nodeBound.guide;
        if (Math.abs(diff) < GUIDELINE_OFFSET) {
          resultH.push({
            lineGuide: lineGuide,
            diff: diff,
            snap: nodeBound.snap,
            offset: nodeBound.offset,
          });
        }
      });
    });
    const guides: Array<any> = [];
    const minV = resultV.sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))[0];
    const minH = resultH.sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))[0];
    if (minV) {
      guides.push({
        orientation: 'V',
        lineGuide: minV.lineGuide,
        offset: minV.offset,
        snap: minV.snap,
        diff: minV.diff,
      });
    }
    if (minH) {
      guides.push({
        orientation: 'H',
        lineGuide: minH.lineGuide,
        offset: minH.offset,
        snap: minH.snap,
        diff: minH.diff,
      });
    }
    return guides;
  }

  // 绘制吸附水平和垂直线
  drawSnappingGuides(viewId: number = this.viewId, guides): void {
    this.removeSnapGuideLine(viewId);
    const curStage = this.stageObj[viewId];
    const layer = curStage.findOne('.designLayer');
    const layerRect = layer.getClientRect();
    const snapLineLayer = new Konva.Layer({
      name: 'snapLineLayer',
      x: -curStage.x(),
      y: -curStage.y(),
      listening: false,
    });
    curStage.add(snapLineLayer);
    guides.forEach((lg) => {
      // let points = lg.orientation === "H" ? [-6000, lg.lineGuide, 6000, lg.lineGuide] : [lg.lineGuide, -6000, lg.lineGuide, 6000];
      const points =
        lg.orientation === 'H'
          ? [curStage.x(), lg.lineGuide, curStage.x() + layerRect.width, lg.lineGuide]
          : [lg.lineGuide, curStage.y(), lg.lineGuide, curStage.y() + layerRect.height];
      const line = new Konva.Line({
        name: 'snapping-line',
        points: points,
        stroke: '#14C9C9',
        strokeWidth: 1,
        // dash: [4, 6],
      });
      snapLineLayer.add(line);
      snapLineLayer.batchDraw();
    });
  }

  // 删除吸附指引线
  removeSnapGuideLine(viewId: number = this.viewId): void {
    this.stageObj[viewId].findOne('.snapLineLayer')?.destroy();
  }
}

export default Snap;
