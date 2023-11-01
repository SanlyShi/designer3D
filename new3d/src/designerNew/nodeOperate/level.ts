import { Designer } from "../types";

interface Level extends Designer {}

class Level {
  changeLevel(
    dir: string,
    node: any = this.curNode,
    isAddHistory: boolean = true
  ): void {
    if (!node) return;
    if (node.hasName("isBg")) return;
    const layer = node.getLayer();
    const pNode = node.getParent();
    const optNode = pNode?.hasName("repeatImgGroup") ? pNode : node;
    dir == "down" ? optNode.moveDown() : optNode.moveUp();
    layer.findOne(".isBg")?.moveToBottom();
    layer.findOne(".bgRect")?.moveToBottom();
    // layer.findOne('.print_area_border_outer')?.moveToTop();
    layer.batchDraw();

    const viewId = layer.getAttrs()?.viewId;
    this.updateLevelInfo();
    isAddHistory &&
      this.addHistoryBySystem("图层排序", viewId, {
        nodeId: node.getAttrs().historyId,
      });
  }

  updateLevelInfo(node: any = this.curNode) {
    if (!node) {
      this.levelInfo = { total: 0, index: -1 };
      return this.levelInfo;
    }
    const layer = node.getLayer();
    let designNodes = layer.find(".design");
    if (!designNodes || node.hasName("bgRect") || node.hasName("isBg")) {
      this.levelInfo = { total: 0, index: -1 };
      return this.levelInfo;
    }
    designNodes = Array.from(designNodes).filter(
      (n: any) => !n.hasName("isBg") && !n.hasName("bgRect")
    );
    const total = designNodes.length;
    const index = designNodes.findIndex((n) => n._id == node._id);
    this.levelInfo = { total, index };
    return this.levelInfo;
  }

  getNodeLevel(node: any = this.curNode){
    return this.levelInfo;
  }

  baseMoveToTop(stage: any): void {
    stage.findOne(".product_type_view")?.moveToBottom();
    stage.findOne(".product_type_BaseMap")?.moveToTop();
    stage.findOne(".pointoutPrint-area")?.moveToTop();
    stage.findOne(".printAreaClip")?.moveToTop();
    stage.findOne(".print_area_border_outer")?.moveToTop();
  }
}

export default Level;
