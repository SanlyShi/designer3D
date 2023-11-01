import { Designer } from "../types";
import { loadImgs } from "../utils";
import { linkageDesign } from "../designerLogicProcess";
import Konva from "../dependence/konva7.2.1";

interface Replace extends Designer {}

class Replace {
  /**
   * @param isLocalImg：替换本地图片，还没上传到服务器，没有滤镜效果
   * @return
   */
  async replaceImage({
    imageData,
    viewId = this.viewId,
    oldNode,
    isLocalImg = false,
    isAddHistory = true,
    callback = null
  }): Promise<any> {
    const currentStage = this.stageObj[viewId];
    const designLayer = currentStage.findOne(".designLayer");
    const ratio = designLayer.getAttrs().ratio;
    const imgSize = this.imgSizeCalculate(imageData, viewId);
    const imageWidth = imgSize.width || 0;
    const imageHeight = imgSize.height || 0;
    const nodeAttrs = oldNode.getAttrs();
    let oldImgWidth = oldNode.width() * oldNode.scaleX();
    let oldImgHeight = oldNode.height() * oldNode.scaleY();
    const isClip = nodeAttrs.isclip;
    if (isClip) {
      const { imgAttrs, pathAttrs } = nodeAttrs.clipData;
      oldImgWidth =
        (oldImgWidth * (imgAttrs.width * imgAttrs.scaleX)) /
        (pathAttrs.width * pathAttrs.scaleX);
      oldImgHeight =
        (oldImgHeight * (imgAttrs.height * imgAttrs.scaleY)) /
        (pathAttrs.height * pathAttrs.scaleY);
    }
    const oldMaxLength =
      oldImgWidth > oldImgHeight ? oldImgWidth : oldImgHeight;
    const newMaxLength = imageWidth > imageHeight ? imageWidth : imageHeight;
    const replaceScale = oldMaxLength / (newMaxLength / ratio);

    const [newImage]: Array<any> = await loadImgs([imageData.designImg3]);
    oldNode.setAttrs({
      image: newImage,
      scaleX: replaceScale * (imageWidth / ratio / newImage.width),
      scaleY: replaceScale * (imageHeight / ratio / newImage.height),
      offsetX: newImage.width / 2,
      offsetY: newImage.height / 2,
      // initScaleX: imageWidth / ratio / newImage.width,
      // initScaleY: imageHeight / ratio / newImage.height,
      widthMM: imageWidth,
      heightMM: imageHeight,
      maxImgSize: imgSize.viewerSize,
      imageData: imageData,
      flipImgUrl: imageData.designImg3,
      isclip: false, // 替换图片先去除裁剪属性，后面再应用
    });
    if(callback) callback()
    oldNode.addName("toReplace");
    if (nodeAttrs.xFlip) {
      await this.flipImage({
        type: "leftRightMirror",
        node: oldNode,
        isReduction: true,
        isAddHistory: false,
      });
      oldNode.setAttr("xFlip", true);
    }
    if (nodeAttrs.yFlip) {
      await this.flipImage({
        type: "upDownMirror",
        node: oldNode,
        isReduction: true,
        isAddHistory: false,
      });
      oldNode.setAttr("yFlip", true);
    }
    // 保持原图的滤镜效果
    if (!isLocalImg && nodeAttrs.render_id) {
      const filterRet = await this.changeImageFilter(
        {
          node: oldNode,
          render_code: nodeAttrs.rendercode,
          params: {
            gallery_id: imageData.code,
            xFlip: nodeAttrs.xFlip ? 1 : 0,
            yFlip: nodeAttrs.yFlip ? 1 : 0,
          },
        },
        false
      );
      if (filterRet?.data?.url2) {
        await this.replaceFilter({
          url: filterRet.data.url2,
          node: oldNode,
          isReduction: true,
          isAddHistory: false,
        });
      }
    }
    if (isClip) {
      let clipData = nodeAttrs.clipData;
      const changeScaleX = clipData.imgAttrs.width / oldNode.width();
      const changeScaleY = clipData.imgAttrs.height / oldNode.height();
      clipData.imgAttrs.originImg = oldNode.getAttrs().flipImgUrl;
      clipData.imgAttrs.width = oldNode.width();
      clipData.imgAttrs.height = oldNode.height();
      clipData.imgAttrs.scaleX = clipData.imgAttrs.scaleX * changeScaleX;
      clipData.imgAttrs.scaleY = clipData.imgAttrs.scaleY * changeScaleY;
      let url = await this.getClipImage(clipData);
      const [clipImage] = await loadImgs([url]);
      oldNode.image(clipImage);
      oldNode.setAttrs({
        offsetX: clipImage.width / 2,
        offsetY: clipImage.height / 2,
        isclip: true,
        clipData,
      });
    }
    await this.drawRepeatType(
      oldNode.getAttrs().tileType,
      oldNode,
      oldNode.getAttrs().spacingH,
      oldNode.getAttrs().spacingV,
      false
    );
    viewId == this.viewId && this.anchorGroupForceUpdate(viewId);

    isAddHistory &&
      this.addHistoryBySystem("替换图片", viewId, {
        nodeId: oldNode.getAttrs().historyId,
      });
    return oldNode;
  }

  async localImageAdd({src, viewId}) {
    let galleryData = {
      width: 0,
      height: 0,
      size: {
        width: 0,
        height: 0,
      },
      code: '',
      designImg: '',
      designImg2: '',
      designImg3: '',
    }
    const [newImage]: Array<any> = await loadImgs([src]);
    galleryData.designImg = src
    galleryData.designImg3 = src
    galleryData.size = {
      width: newImage.width,
      height: newImage.height
    }
    const node = await this.addImage({
      imageData: galleryData,
      viewId,
    })
    this.getCanvasImage(viewId, 'canvas');
    
    return {canvasObj: this.viewImgArr, node}
  }

  async updateImage({src = '', imageData = null, node = null, nodeId = 0, isLocalImg = false, originWidth = 0, originHeight = 0} = {}) {
    this.changeNodeList = []
    if(src) {
      //替换图片
      imageData = {}
      const [newImage]: Array<any> = await loadImgs([src]);
      imageData.designImg3 = src
      /**
       * originWidth,originHeight: 本地上传的图片会经过压缩，src是压缩后的图片，宽高是小的，所以要传原始图的宽高，否则会提示图片模糊
       */
      if(originWidth) {
        imageData.size = {
          width: originWidth,
          height: originHeight
        };
      } else {
        imageData.size = {
          width: newImage.width,
          height: newImage.height
        };
      }
    }
    let viewId = 0, curNode = null
    if(nodeId) {
      for(const view of this.productData.views) {
        const stage = this.stageObj[`${view.id}`]
        const layer = stage.findOne('.designLayer')
        layer.find('.designImg').forEach(node => {
          /**
           * conf_id: 模板数据后台给了每个节点的唯一id
           * _id: 自己添加的图片使用konva生成的id对应
           */
          if(node.getAttrs().conf_id === nodeId) {
            curNode = node
            viewId = view.id
          }
        })
      }
    } else {
      curNode = node || this.curNode
      viewId = this.viewId
    }
    const designObj = linkageDesign(this.productData, this.stageObj, viewId, curNode)
    for(let _viewId in designObj) {
      for(let item of designObj[_viewId]) {
        this.changeNodeList.push({ //简版有取消编辑图片的功能，所以要存住编辑之前的数据
          view: item.view,
          oldNode: item.node,
          oldNodeAttrs: JSON.parse(JSON.stringify(item.node.getAttrs())),
        })
        await this.replaceImage({imageData, viewId: item.id, oldNode: item.node, isLocalImg}).then((node: any) => {
          if(item.id == this.viewId) {
            curNode = node
            this.anchorGroupForceUpdate()
          }
          if(node.uploadImgId) {
            node.uploadImgId = ''
            node.File = ''
          }
        })
        // this.getCanvasImage(item.id);
      }
    }
    return { designObj }
  }
  /**
   * 
   * @param isReplaceImage 简版执行editImage编辑图片之前有可能替换了图片，替换图片时已经给changeNodeList赋值
   */
  async editImage({container, nodeId, isReplaceImage = false, viewId, callBack}) {
    this.changeView(viewId)
    if(!isReplaceImage) this.changeNodeList = []
    let curNode = null
    this.viewId = viewId
    for(const view of this.productData.views) {
      const stage = this.stageObj[`${view.id}`]
      const layer = stage.findOne('.designLayer')
      layer.find('.designImg').forEach(node => {
        /**
         * conf_id: 模板数据后台给了每个节点的唯一id
         * _id: 自己添加的图片使用konva生成的id对应
         */
        if(node.getAttrs().conf_id === nodeId) {
          this.changeNodeDisplayOnCanvas(false, layer, [node])
          curNode = node
          this.addController([node])
          if(!isReplaceImage) {
            const designObj = linkageDesign(this.productData, this.stageObj, viewId, node)
            for(let _viewId in designObj) {
              for(let item of designObj[_viewId]) {
                this.changeNodeList.push({
                  view: item.view,
                  oldNode: item.node,
                  oldNodeAttrs: JSON.parse(JSON.stringify(item.node.getAttrs())),
                })
              }
            }
          }
        }
      })
    }
    // if(!this.stageObj[`updateImgStage`]) {
    //   await this.createStageForUpdateImage(container, viewId)
    // } else {
    //   this.hideController()
    // }
    // this.stageObj[`updateImgStage`].findOne(".designLayer").find('.designImg').forEach(node => {
    //   if(node.getLayer().findOne(`.repeatImgGroup${node._id}`)) {
    //     node.getLayer().findOne(`.repeatImgGroup${node._id}`).destroy()
    //   }
    //   node.destroy()
    // })
    // let updateNode = null
    // await this.addImageForUpdateImage(0, curNode).then((node: any) => {
    //   updateNode = node
    //   this.drawRepeatType(
    //     node.getAttrs().tileType,
    //     node,
    //     node.getAttrs().spacingH,
    //     node.getAttrs().spacingV,
    //   )
    // })
    callBack({canvasObj: this.getKonvaCanvasOrImage(0, 'canvas')})
  }
  editText({nodeId = 0, viewId, text, callBack}) {
    this.viewId = viewId
    for(const view of this.productData.views) {
      const stage = this.stageObj[`${view.id}`]
      const layer = stage.findOne('.designLayer')
      layer.find('.designText').forEach(node => {
        if((node.getAttrs().conf_id && node.getAttrs().conf_id === nodeId) || node._id === nodeId) {
          this.setNodeText(text, node)
        }
      })
      this.getCanvasImage(view.id, 'canvas');
    }
    callBack({canvasObj: this.viewImgArr})
  }
  createStageForUpdateImage(container, viewId) {
    return new Promise<void>(async (resolve) => {
      let div = document.createElement('div')
      div.setAttribute('id', 'controlImgCanvas')
      div.style.width = '100%'
      div.style.height = '100%'
      container.appendChild(div)
      this.stageObj[`updateImgStage`] = new Konva.Stage({
        container: div,
        width: div.clientWidth,
        height: div.clientHeight
      })
      const currentView = this.productData.views.filter((item) => {
        return item.id == viewId;
      })[0]
      const ratio = currentView.width / container.clientWidth
      const currentStage = this.stageObj[`updateImgStage`]
      const designLayer = new Konva.Layer({
        x: 0,
        y: 0,
        name: "designLayer",
      })
      designLayer.setAttrs({
        ratio: ratio,
        printAreaId: currentView.printArea.id,
        viewId: 'updateImgStage',
        softSvg: currentView.printArea.soft_svg,
      })
      const designContainerGroup = new Konva.Group({
        x: currentView.printArea.offset_x / ratio,
        y: currentView.printArea.offset_y / ratio,
        width: currentView.printArea.width / ratio,
        height: currentView.printArea.height / ratio,
        name: "designContainerGroup",
      })
      const designContainer = new Konva.Rect({
        x: 0,
        y: 0,
        width: currentView.printArea.width / ratio,
        height: currentView.printArea.height / ratio,
        name: "print_area_border_outer",
      })
      designContainerGroup.add(designContainer);
      designLayer.add(designContainerGroup);
      currentStage.add(designLayer);
      designLayer.batchDraw();
      designContainerGroup.clip({
        x: 0,
        y: 0,
        width: designContainerGroup.width(),
        height: designContainerGroup.height(),
      })
      resolve()
    })
  }
  addImageForUpdateImage(viewId, node) {
    return new Promise<void>(resolve => {
      let recordData = node.getAttrs()
      let controlImgCanvas = document.getElementById('controlImgCanvas')
      let editImgConteiner: any = controlImgCanvas.parentNode
      let currentStage = this.stageObj[`updateImgStage`];
      let designLayer = currentStage.findOne(".designLayer");
      let designContainerGroup = designLayer.findOne(".designContainerGroup");
      Konva.Image.fromURL(recordData.flipImgUrl, async (image) => {
        //保存记录还原、切换产品保留图片状态
        image.setAttrs(recordData);
        image.setAttrs({
          associateNodeId: node._id
        })
        let recordDataLayerScale = recordData.layerScale || 1;
        const canvasRatio = (editImgConteiner.clientWidth / this.canvasSize)
        image.scaleX(recordData.scaleX * canvasRatio);
        image.scaleY(recordData.scaleY * canvasRatio);
        // image.scaleX(imageWidth / ratio / image.width() * userScale.x);
        // image.scaleY(imageHeight / ratio / image.height() * userScale.y);
        image.x(editImgConteiner.clientWidth / this.canvasSize * image.x())
        image.y(editImgConteiner.clientWidth / this.canvasSize * image.y())

        image.offsetX(image.width() / 2);
        image.offsetY(image.height() / 2);

        image.setAttrs({
          stageWidth: editImgConteiner.clientWidth,
          layerScale: designLayer.scaleX()
        })
        if(recordData.isclip) await this.implementClip(image, recordData.flipImgUrl, recordData.clipData)
        designContainerGroup.add(image);

        
        // this.viewNodeObj[viewId].childrens.push({
        //   type: 'image',
        //   node: image,
        //   id: konvaId,
        //   isVagueData: picException.isVagueData,
        //   transformData: picException.transformData
        // })
        resolve(image)
        designLayer.batchDraw();
        this.addController([image]);
        // image.on("transform dragmove", (e) => {
        //   this.anchorGroupFourceupdate({ node: e.target, viewId });
        // })
      });
    })
  }
  async transformEndImage({callBack}) {
    await this.changeAllLayerImgForUpdateImage()
    for(let item of this.productData.views) {
      this.getCanvasImage(item.id, 'canvas');
    }
    callBack({canvasObj: this.viewImgArr})
  }
  async confirmEditImage({galleryArr, callBack}) {
    /**
     * 简版设计器
     * 已登陆情况下confirmEditImage直接上传图片，只有一张
     * 未登录情况下编辑图片点确定不会上传图片也不会调用此方法，而是在登陆后多张图片一起上传，上传完成后调用此方法，故galleryArr是个数组
     */
    for(let g of galleryArr) {
      for(let item of this.productData.views) {
        const stage = this.stageObj[`${item.id}`]
        const layer = stage.findOne('.designLayer')
        for(let node of layer.find('.designImg')) {
          const nodeAttrs = node.getAttrs()
          if (g.nodeId === nodeAttrs.conf_id) {
            const designObj = linkageDesign(this.productData, this.stageObj, item.id, node)
            for(let _viewId in designObj) {
              for(let item of designObj[_viewId]) {
                //确认使用图片时，图片已上传至后台，可以使用图片滤镜
                await this.replaceImage({imageData: g.galleryData, viewId: item.id, oldNode: node, isLocalImg: false})
              }
            }
          }
        }
      }
    }
    callBack({canvasObj: this.getKonvaCanvasOrImage(0, 'canvas')})
  }
  async cancelEditImage({callBack}) {
    /**
     * 取消编辑，图片要回到编辑前的状态
     */
    for(let item of this.changeNodeList) {
      const oldNodeAttrs = item.oldNodeAttrs
      await this.replaceImage({imageData: oldNodeAttrs.imageData, viewId: item.view.id, oldNode: item.oldNode, isLocalImg: false, callback: () => {
        item.oldNode.scaleX(oldNodeAttrs.scaleX);
        item.oldNode.scaleY(oldNodeAttrs.scaleY);
        item.oldNode.x(oldNodeAttrs.x);
        item.oldNode.y(oldNodeAttrs.y);
        item.oldNode.rotation(oldNodeAttrs.rotation);
      }})
      this.getCanvasImage(item.view.id, 'canvas');
    }
    callBack({canvasObj: this.viewImgArr})
  }
  async changeAllLayerImgForUpdateImage() {
    const updateImgLayer = this.stageObj[`updateImgStage`].findOne('.designLayer')
    const curNode = updateImgLayer.findOne('.designImg')
    const viewId = curNode.getLayer().getAttrs().viewId
    let associateNode = null
    // for(const view of this.productData.views) {
    //   if(view.id == viewId) {
    //     const stage = this.stageObj[`${view.id}`]
    //     const layer = stage.findOne('.designLayer')
    //     layer.find('.designImg').forEach(node => {
    //       if(node._id == curNode.getAttrs().associateNodeId) {
    //         associateNode = node
    //       }
    //     })
    //   }
    // }
    //updateImgStage 画布平铺
    this.drawRepeatType(
      curNode.getAttrs().tileType,
      curNode,
      curNode.getAttrs().spacingH,
      curNode.getAttrs().spacingV,
    )
    // updateImgStage编辑的图片对比原画布的位置
    for(let item of this.changeNodeList) {
      if(item.view.id == viewId) {
        this.diffViewTheSameDesign({
          currentView: item.view,
          associateProductView: item.view,
          currentRecordData: curNode.getAttrs(),
          associateNode: item.node,
          type: 'image'
        })
        associateNode = item.node
      }
      
    }
    // 简版背景图片才有联动，前一步已算出图片在原画布的位置，这一步算联动的背景图的位置
    for(let item of this.changeNodeList) {
      if(item.view.id != viewId) {
        item.node.setAttrs({
          scaleX: associateNode.scaleX(),
          scaleY: associateNode.scaleY(),
          x: associateNode.x(),
          y: associateNode.y(),
          rotation: associateNode.rotation()
        })
      }
      //正常产品画布平铺
      await this.drawRepeatType(
        item.node.getAttrs().tileType,
        item.node,
        item.node.getAttrs().spacingH,
        item.node.getAttrs().spacingV,
      )
    }
    // const designObj = linkageDesign(this.productData, this.stageObj, viewId, associateNode)
    // for(let _viewId in designObj) {
    //   for(let item of designObj[_viewId]) {
    //     // this.getCanvasImage(item.id);
    //     this.diffViewTheSameDesign({
    //       currentView: item.view,
    //       associateProductView: item.view,
    //       currentRecordData: curNode.getAttrs(),
    //       associateNode: item.node,
    //       type: 'image'
    //     })
        
    //     //正常产品画布平铺
    //     await this.drawRepeatType(
    //       item.node.getAttrs().tileType,
    //       item.node,
    //       item.node.getAttrs().spacingH,
    //       item.node.getAttrs().spacingV,
    //     )
    //   }
    // }
  }
}

export default Replace;
