import {Designer} from "./types";

interface History extends Designer {}

// @ts-ignore
class History {

  /**
   * @description 添加操作记录
   * @param {*} name 操作名称, 如添加图片, 图层排序等
   * @param {*} viewId 添加记录的面
   * @param {*} options 记录参数, 如节点的操作需要传节点的id, 背景色需要传颜色等
   * @return {*}
   */
  addHistory(name, viewId = this.viewId, options?: any): void {
    if(!this.defaultSetting.history.enable) return;

    const productConfig = this.getProductConfiguration({ viewId, isSaveProduct: false });
    if (name == 'init') delete this.historyListMap[viewId];
    // 存储图层顺序，图层排序的时候复原
    const designLayer = this.stageObj[viewId].findOne('.designLayer');
    const nodesIndex = {};
    designLayer.find('.design').forEach((n) => {
      const historyId = n.getAttrs().historyId;
      const $repeatObj = designLayer.findOne(`.repeatImgGroup${n._id}`);
      nodesIndex[historyId] = $repeatObj ? $repeatObj.zIndex() : n.zIndex();
    });
    if (!this.historyListMap[viewId]) this.historyListMap[viewId] = [];
    this.historyListMap[viewId].push({
      viewId,
      name,
      nodeId: options?.nodeId || '',
      data: productConfig.cfgs,
      nodesIndex,
    });
    // 超过最大记录数，去掉旧的记录
    if(this.historyListMap[viewId].length > this.defaultSetting.history.max){
      this.historyListMap[viewId].shift();
    }
    this.historyStepMap[viewId] = this.historyListMap[viewId].length - 1;
    this.emit('addHistory')
  }

  /**
   * @description: 根据平台默认规则添加操作记录
   */  
  addHistoryBySystem(name, viewId = this.viewId, options?: any): void {
    if(this.defaultSetting.history.isCustom) return;
    this.addHistory(name, viewId, options);
  }

  /**
   * @description: 根据用户自定义添加操作记录，若不想使用平台的添加规则，则调用该方法
   */ 
  addHistoryByUser(name, viewId = this.viewId, options?: any): void {
    if(!this.defaultSetting.history.isCustom) return;
    this.addHistory(name, viewId, options);
  }

  /**
   * @description: 还原操作记录
   * @param {*} viewId 要还原的面
   * @param {*} flag -1撤销, 1重做
   * @return {*}
   */
  async restoreHistory(flag, viewId = this.viewId): Promise<void> {
    if(this.historyFreeze) return;
    this.historyFreeze = true;
    const historyList = this.historyListMap[viewId];
    const curStep = this.historyStepMap[viewId];
    const curData = historyList[curStep];
    if((curStep <= 0 && flag == -1) || (curStep >= historyList.length-1 && flag == 1)) {
      this.historyFreeze = false;
      return;
    }
    const restoreStep = flag == -1 ? curStep - 1 : curStep + 1;
    const restoreData = historyList[restoreStep];
    const { layer } = this.getCurStageLayer(viewId);

    const _deleteNode = (node) => {
      node.destroy();
      layer.find(`.repeatImgGroup${node._id}`)?.destroy();
    };
    const _updateIndex = () => {
      layer.find('.design')?.forEach((n) => {
        const hid = n.getAttrs().historyId;
        const pnode = n.getParent();
        if(pnode?.hasName('repeatImgGroup')) n = pnode;
        n.zIndex(restoreData.nodesIndex[hid]);
      });
    }

    const optData = flag == -1 ? curData : restoreData;
    if (optData?.nodeId) {
      const nodeConf = restoreData.data?.find((n) => n.konvaAttrs.historyId == optData.nodeId);
      const designNodes = Array.from(layer.find('.design'));
      const changingNode = designNodes?.find((n:any) => n.getAttrs().historyId == optData.nodeId);
      // 如果要还原回去的记录中有该节点，则改变节点属性(销毁重建), 如果没有则删除节点
      changingNode && _deleteNode(changingNode);
      if (nodeConf) {
        const nodeAttrs = nodeConf.konvaAttrs;
        if (nodeAttrs.name.indexOf('designImg') > -1) {
          if (nodeAttrs.isclip) nodeAttrs.flipImgUrl = nodeAttrs.clipData.imgAttrs.originImg;
          const image = await this.addImage({
            imageData: nodeAttrs.imageData,
            viewId,
            isSetBg: nodeAttrs.name.indexOf('isBg') > -1,
            recordData: nodeAttrs,
          });
          await this.drawRepeatType(nodeAttrs.tileType, image, nodeAttrs.spacingH, nodeAttrs.spacingV, false);
        } else if (nodeAttrs.name.indexOf('designText') > -1) {
          if (!nodeAttrs.scaleX || isNaN(nodeAttrs.scaleX)) nodeAttrs.scaleX = 1;
          if (!nodeAttrs.scaleY || isNaN(nodeAttrs.scaleY)) nodeAttrs.scaleY = 1;
          await this.addText({ viewId, recordData: nodeAttrs });
        }
        // 更新排序
        _updateIndex();
      }
    } else {
      // 非操作节点的还原, 如清空、背景色等
      const name = optData.name;
      if (name == '清空') {
        flag == -1 ? await this.restoreAllDesign(viewId, restoreData) : this.emptyDesign(viewId, false);
      } else if (name.indexOf('背景色') > -1) {
        const bgnodeConf = restoreData?.data?.find(n => n.type=='bgColor');
        layer.find('.bgRect')?.destroy();
        if(bgnodeConf){
          await this.addBgColor({
            color: bgnodeConf.color.value,
            viewId,
            isAddHistory: false
          })
        }
      } else if(name.indexOf('排序') > -1){
        _updateIndex();
      }
    }
    this.historyStepMap[viewId] = restoreStep;
    this.unselectAll();
    layer.batchDraw();
    this.historyFreeze = false;
    this.emit('restoreHistory')
  }

  /**
   * @description: 还原所有操作，用于清空后还原
   * @param {number} viewId
   * @param {*} data
   * @return {*}
   */  
  async restoreAllDesign(viewId: number = this.viewId, data): Promise<void> {
    const {layer} = this.getCurStageLayer(viewId);
    this.emptyDesign(viewId, false);
    const cfgs = data.data, nodesIndex = data.nodesIndex;
    const promiseArr: Array<Promise<any>> = [];
    const restoreCfg = async (nodeAttrs) => {
      if(nodeAttrs.name.indexOf('designImg') > -1){
        nodeAttrs.flipImgUrl = nodeAttrs.imageData.designImg3;
        const image = await this.addImage({
          imageData: nodeAttrs.imageData,
          viewId,
          isSetBg: nodeAttrs.name.indexOf('isBg') > -1,
          recordData: nodeAttrs
        });
        await this.drawRepeatType(nodeAttrs.tileType, image, nodeAttrs.spacingH, nodeAttrs.spacingV, false);
      } else if(nodeAttrs.name.indexOf('designText') > -1){
        await this.addText({ viewId, recordData: nodeAttrs });
      } else if(nodeAttrs.name.indexOf('bgRect') > -1){
        await this.addBgColor({ color: nodeAttrs.fill, viewId, isAddHistory: false });
      }
    }
    cfgs?.forEach((cfg) => { promiseArr.push(restoreCfg(cfg)) })
    await Promise.all(promiseArr);
    // 更新层级
    layer.find('.design')?.forEach((n) => {
      const hid = n.getAttrs().historyId;
      const pnode = n.getParent();
      if(pnode?.hasName('repeatImgGroup')) n = pnode;
      n.zIndex(nodesIndex[hid]);
    });
    layer.batchDraw();
  }

  getHistoryListMap(){
    return this.historyListMap;
  }

  getHistoryStepMap(){
    return this.historyStepMap;
  }
}

export default History