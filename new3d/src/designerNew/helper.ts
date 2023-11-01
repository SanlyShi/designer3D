import {DataProcessorType, Designer, PictureException, SaveData, View} from "./types";
import {isRisk} from "./designerLogicProcess";
import Konva from "./dependence/konva7.2.1";
import {loadImgs} from "./utils";

interface Helper extends Designer {}

class Helper {

  /**
   * @description 未铺满检测
   * @param {*} viewId 面
   * @param {*} isArea 是否创建红色区域块
   * @return {*}
   */
  public checkOverSpread(viewId: number = this.viewId, isArea = true) {
    this.stageObj[viewId]?.find('.overspreadPath')?.destroy();
    const overspreadData: any = {};
    if (this.productData.imgFull == 1) {
      const productConfig = this.getProductConfiguration({ viewId, isSaveProduct: false });
      const { overspreadObj } = this.calcDesignArea(productConfig);
      if (overspreadObj[viewId]) {
        const { stage, layer } = this.getCurStageLayer(viewId);
        const printArea = stage.findOne('.print_area_border_outer');
        const ratio = layer.getAttrs().ratio;
        // 当任意一边距离印刷区域的距离介于对应长/宽的0-10%之间，判断为未铺满
        const limitWidth1 = printArea.width() * 0.1,
          limitWidth2 = printArea.width() * 0.9,
          limitHeight1 = printArea.height() * 0.1,
          limitHeight2 = printArea.height() * 0.9;
        if (
          (Math.floor(overspreadObj[viewId].leftNum) > 0 &&
            overspreadObj[viewId].leftNum < limitWidth1) ||
          (Math.floor(overspreadObj[viewId].topNum) > 0 &&
            overspreadObj[viewId].topNum < limitHeight1) ||
          (overspreadObj[viewId].rightNum > limitWidth2 &&
            Math.floor((printArea.width() - overspreadObj[viewId].rightNum) * ratio) > 0) ||
          (overspreadObj[viewId].bottomNum > limitHeight2 &&
            Math.floor((printArea.height() - overspreadObj[viewId].bottomNum) * ratio) > 0)
        ) {
          overspreadData.type = 1;
          overspreadData.title = '图片未铺满设计区域';
          overspreadData.desc = `图片未铺满设计区域，产品生产可能存在留白！`;
          if (this.defaultSetting?.overspreadTips?.canvasEnable && isArea) {
            this.createOverSpreadArea(overspreadObj[viewId], viewId);
          }
        }
      }
    }
    return overspreadData;
  }

  // 绘制未铺满提示区域
  private createOverSpreadArea(overspreadData, viewId = this.viewId) {
    const curS = this.getCurStageLayer(viewId);
    const printArea = curS.designRect;
    const outerW = printArea.width(),
      outerH = printArea.height();
    const limitWidth1 = outerW * 0.1,
      limitWidth2 = outerW * 0.9,
      limitHeight1 = outerH * 0.1,
      limitHeight2 = outerH * 0.9;
    let innerOffsetX = 0,
      innerOffsetY = 0,
      innerW,
      innerH;
    if (overspreadData.leftNum > 0 && overspreadData.leftNum < limitWidth1) {
      innerOffsetX = overspreadData.leftNum;
    }
    if (overspreadData.topNum > 0 && overspreadData.topNum < limitHeight1) {
      innerOffsetY = overspreadData.topNum;
    }
    if (overspreadData.rightNum > limitWidth2 && overspreadData.rightNum < outerW) {
      innerW = overspreadData.rightNum - innerOffsetX;
    } else {
      innerW = outerW - innerOffsetX;
    }
    if (overspreadData.bottomNum > limitHeight2 && overspreadData.bottomNum < outerH) {
      innerH = overspreadData.bottomNum - innerOffsetY;
    } else {
      innerH = outerH - innerOffsetY;
    }
    const pathData = `M0,0 h${outerW} v${outerH} h-${outerW} z M${innerOffsetX},${innerOffsetY} v${innerH} h${innerW} v-${innerH} z`;
    const path = new Konva.Path({
      name: 'overspreadPath',
      data: pathData,
      fill: '#f00',
      opacity: 0.4,
    });
    curS.designContainerGroup.add(path);
    curS.layer.batchDraw();
  }

  async addDesignLayerCont({ layer, view, ratio, type }): Promise<any> {
    switch (type) {
      case 1: //设计辅助线
        let auxiliaryPath = '';
        const [image] = await loadImgs([view.point_svg]);
        auxiliaryPath = new Konva.Image({
          name: 'auxiliaryPath printAreaClip',
          x: 0,
          y: 0,
          image,
          width: this.canvasSize,
          height: this.canvasSize,
          listening: false,
        });
        layer.add(auxiliaryPath);
        return auxiliaryPath;
      case 2: //全幅安全线
        const fulllSafeLine = new Konva.Path({
          x: 0,
          y: 0,
          data: view.pointout_print_areas.soft_svg,
          stroke: 'red',
          dash: [5, 5],
          scale: {
            x: 1 / ratio,
            y: 1 / ratio,
          },
          strokeScaleEnabled: false,
          name: 'auxiliaryPath pointoutPrint-area',
          listening: false,
        });
        layer.add(fulllSafeLine);
        return fulllSafeLine;
      case 3: //底图
        const { productViewImg } = this.getProductViewImgUrl(this.colorId, view.id);
        let viewBaseImg = '';
        if (productViewImg) {
          const [image] = await loadImgs([productViewImg]);
          viewBaseImg = new Konva.Image({
            name: 'product_type_view',
            x: 0,
            y: 0,
            image,
            width: this.canvasSize,
            height: this.canvasSize,
            listening: false,
          });
          layer.add(viewBaseImg);
        }
        return viewBaseImg;
      case 4: //肌理图
        const { productTextureImg } = this.getProductViewImgUrl(this.colorId, view.id);
        let textureImg = '';
        if (productTextureImg) {
          const [image] = await loadImgs([productTextureImg]);
          textureImg = new Konva.Image({
            name: 'product_type_BaseMap',
            x: 0,
            y: 0,
            image,
            width: this.canvasSize,
            height: this.canvasSize,
            listening: false,
          });
          layer.add(textureImg);
        }
        return textureImg;
    }
  }

  // 获取底图和肌理图地址
  getProductViewImgUrl(colorId: number, viewId: number) {
    const colorItem = this.productData?.colors.find((c) => c.id == colorId);
    const viewItem = colorItem?.views.find((v) => v.id == viewId);
    return {
      productViewImg: viewItem?.image,
      productTextureImg: viewItem?.texture,
    };
  }

  reCombinKonvaJson(saveData: Array<SaveData>, views: Array<View>, productData) {
    return new Promise<void>(async (resolve) => {
      if (saveData.length) {
        const filterData = [];
        let riskImg = 0;
        for (const item of saveData) {
          /**
           * 简版切换自定义底板，需要把当前模板通过getSaveData()存起来，getSaveData()取到的值已经过滤掉了风险词图片，这里即使风险词信息是空的也没影响
           * 重新打开这个模板的时候，image就会缺少风险词信息，isRisk()内部会报错，
           * 这里补上
           */
          // if (item.image && !item.image.risk_gallery) {
          //   item.image.risk_gallery = {};
          //   item.image.risk_gallery.risk = [];
          //   item.image.risk_word = [];
          //   item.konvaAttrs.imageData.risk_gallery = {};
          //   item.konvaAttrs.imageData.risk_gallery.risk = [];
          //   item.konvaAttrs.imageData.risk_word = [];
          // }
          if (item['image'] && isRisk(item['image'])) {
            riskImg++;
          } else {
            filterData.push(item);
          }
        }
        if (riskImg > 0) {
          console.error('图片信息异常，无法使用');
        }
        saveData = filterData;
        if (saveData[0].konvaAttrs) {
          for (const item of saveData) {
            if (!this.konvaJson[item.view_id]) this.konvaJson[item.view_id] = [];
            if (item.type == 'design') {
              // 从小程序版开始不保存imageData
              if(!item.konvaAttrs.imageData) {
                item.konvaAttrs.imageData = {}
                item.konvaAttrs.imageData.risk_gallery = item.image.risk_gallery
                item.konvaAttrs.imageData.risk_word = item.image.risk_word
                item.konvaAttrs.imageData.size = item.image.size
                item.konvaAttrs.imageData.code = item.image.gallery_id
                item.konvaAttrs.imageData.name = item.image.name
              }
              if(item.image.channel_id) {
                item.konvaAttrs.imageData.channel_id = item.image.channel_id
              }
              item.konvaAttrs.spacingH = item.image.hspacing
              item.konvaAttrs.spacingV = item.image.vspacing
              item.konvaAttrs.xFlip = item.image.xFlip
              item.konvaAttrs.yFlip = item.image.yFlip
              item.konvaAttrs.rendercode = item.image.rendercode
              item.konvaAttrs.render_id = item.image.render_id
              item.konvaAttrs.tileType = item.image.tileType
              item.konvaAttrs.rotation = item.image.rotate
              //旧版图片翻转designImg2保存的是base64，跳到新版保存的时候要把base64删除，这里要加回上图片地址才能添加图片
              //item.konvaAttrs.imageData.designImg如果有值，就是从localStorage保存的noLoginDesign
              //如果没值就是从接口请求的模板来的
              if (!item.konvaAttrs.imageData.designImg) {
                item.konvaAttrs.imageData.designImg = item.image.designImg;
                item.konvaAttrs.imageData.designImg2 = item.image.designImg2;
                // if (this.needDetailImg) {
                item.konvaAttrs.imageData.designImg3 = item.image.designImg;
                // } else {
                //   item.konvaAttrs.imageData.designImg3 = item.image.designImg3;
                // }
              }
            } else if(item.type == 'bgColor') {
              item.konvaAttrs.fill = item.color.value
            }
            this.konvaJson[item.view_id].push({ node: item.konvaAttrs, item });
          }
          const _konvaJson = JSON.parse(JSON.stringify(this.konvaJson));
          // 模板，根据当前面重组数据结构
          if (views && views.length) {
            for (let i = 0; i < productData.views.length; i++) {
              const curView = productData.views[i];
              if (!this.konvaJson[curView.id]) this.konvaJson[curView.id] = [];
              // 模板映射关系，单面应用到所有，多面按顺序
              const tempId: number = views.length === 1 ? views[0].id : views[i]?.id;
              this.konvaJson[curView.id] = _konvaJson[tempId]
                ? JSON.parse(JSON.stringify(_konvaJson[tempId]))
                : [];
              this.konvaJson[curView.id].forEach((designAttrs) => {
                this.diffViewTheSameDesign({
                  currentView: productData.views[i],
                  associateProductView: views.length === 1 ? views[0] : views[i],
                  currentRecordData: designAttrs.node,
                  associateNodeAttrs: designAttrs.node,
                  fromCustomProducts: true,
                  type: designAttrs.node.name.indexOf('designText') ? 'text' : 'image',
                });
              });
            }
          }
          resolve();
        } else {
          // await this.oldDataRestore(
          //   saveData,
          //   this.productData,
          // ).then((newD: Array<SaveData>) => {
          //   for (let item of newD) {
          //     if (!this.konvaJson[item.view_id])
          //       this.konvaJson[item.view_id] = [];
          //     this.konvaJson[item.view_id].push({ node: item.konvaAttrs, id: item.id });
          //   }
          //   resolve()
          // });
        }
      } else {
        resolve();
      }
    });
  }

  diffViewTheSameDesign({
                          currentView,
                          associateProductView,
                          currentRecordData,
                          associateNode = null,
                          associateNodeAttrs = null,
                          fromCustomProducts = false,
                          type = 'image',
                        }) {
    const recordDataLayerScale = currentRecordData.layerScale || 1;
    const currentProductView = currentView;

    // fromCustomProducts 从定制产品来，无需再算一遍canvasRatio，只需要算不同面印刷区域的差异，因为从定制产品来后面还需要执行addImage会计算canvasRatio
    const canvasRatio = fromCustomProducts ? 1 : this.canvasSize / currentRecordData.stageWidth;
    const associateProductViewRatio =
      associateProductView.width / (currentRecordData.stageWidth / recordDataLayerScale);
    const twoViewOffsetXDistance =
      associateProductView.printArea.offset_x -
      currentProductView.print_area.offset_x *
      (associateProductView.width / currentProductView.print_area.view_width);
    const twoViewOffsetYDistance =
      associateProductView.printArea.offset_y -
      currentProductView.print_area.offset_y *
      (associateProductView.width / currentProductView.print_area.view_width);
    const attrs = {
      scaleX: type == 'text' ? currentRecordData.scaleX : currentRecordData.scaleX * canvasRatio,
      scaleY: type == 'text' ? currentRecordData.scaleY : currentRecordData.scaleY * canvasRatio,
      x: (currentRecordData.x + twoViewOffsetXDistance / associateProductViewRatio) * canvasRatio,
      y: (currentRecordData.y + twoViewOffsetYDistance / associateProductViewRatio) * canvasRatio,
      rotation: currentRecordData.rotation,
      spacingH:
        (currentProductView.print_area.view_width / associateProductView.width) *
        currentRecordData.spacingH,
      spacingV:
        (currentProductView.print_area.view_width / associateProductView.height) *
        currentRecordData.spacingV,
    };

    if (associateNode) {
      associateNode.setAttrs({
        scaleX: attrs.scaleX,
        scaleY: attrs.scaleY,
        x: attrs.x,
        y: attrs.y,
        rotation: attrs.rotation,
      });
    } else if (associateNodeAttrs) {
      associateNodeAttrs.scaleX = attrs.scaleX;
      associateNodeAttrs.scaleY = attrs.scaleY;
      associateNodeAttrs.x = attrs.x;
      associateNodeAttrs.y = attrs.y;
      associateNodeAttrs.rotation = attrs.rotation;
      associateNodeAttrs.ratio = associateProductView.width / 100;
      associateNodeAttrs.spacingH = attrs.spacingH;
      associateNodeAttrs.spacingV = attrs.spacingV;
    }
  }

  private checkVague(node = this.curNode): any {
    if (!node.getLayer() || node.hasName('designText')) return;
    const layerAttrs = node.getLayer().getAttrs();
    const nodeAttrs = node.getAttrs();
    const scaleX = Math.abs(node.scaleX()),
      scaleY = Math.abs(node.scaleY());
    const maxImgSize = nodeAttrs.maxImgSize;
    const newImgWidth = node.width() * scaleX * layerAttrs.ratio,
      newImgHeight = node.height() * scaleY * layerAttrs.ratio;
    if (nodeAttrs.isclip) {
      const { imgAttrs, pathAttrs } = nodeAttrs.clipData;
      maxImgSize.width =
        maxImgSize.width *
        ((pathAttrs.width * pathAttrs.scaleX) / (imgAttrs.width * imgAttrs.scaleX));
      maxImgSize.height =
        maxImgSize.height *
        ((pathAttrs.height * pathAttrs.scaleY) / (imgAttrs.height * imgAttrs.scaleY));
    }
    const vagueData: PictureException = { type: 0 },
      transformData: PictureException = { type: 0 };
    //放大程度
    if (newImgWidth > maxImgSize.width || newImgHeight > maxImgSize.height) {
      const magnificationW = newImgWidth / maxImgSize.width;
      const magnificationH = newImgHeight / maxImgSize.height;
      const magnificationMax = Math.max(magnificationW, magnificationH);
      if (magnificationMax > 1.01 && magnificationMax <= 1.5) {
        vagueData.type = 1;
        vagueData.title = '图片轻微模糊';
        vagueData.desc = '图片像素不足放大，轻微影响生产印刷清晰度！';
      } else if (magnificationMax > 1.5 && magnificationMax <= 2) {
        vagueData.type = 2;
        vagueData.title = '图片比较模糊';
        vagueData.desc = '图片像素不足放大，比较影响生产印刷清晰度！';
      } else if (magnificationMax > 2) {
        vagueData.type = 3;
        vagueData.title = '图片严重模糊';
        vagueData.desc = '图片像素不足放大，严重影响生产印刷清晰度！';
      }
    }
    //变形程度
    const oriWHRatio = maxImgSize.width / maxImgSize.height;
    const nowWHRatio = newImgWidth / newImgHeight;
    let defRatio: number;
    if (oriWHRatio > nowWHRatio) {
      defRatio = oriWHRatio / nowWHRatio;
    } else {
      defRatio = nowWHRatio / oriWHRatio;
    }
    if (defRatio >= 1.09 && defRatio < 1.5) {
      transformData.type = 1;
      transformData.title = '图片轻微变形';
      transformData.desc = '图片拉伸变形指数1-1.5倍，请注意已经导致图案变形！';
    } else if (defRatio >= 1.5 && defRatio < 2) {
      transformData.type = 2;
      transformData.title = '图片比较变形';
      transformData.desc = '图片拉伸变形指数1.5-2倍，请注意已经导致图案变形！';
    } else if (defRatio >= 2) {
      transformData.type = 3;
      transformData.title = '图片严重变形';
      transformData.desc = '图片拉伸变形指数2倍以上，请注意图案变形严重！';
    }
    return { vague: vagueData, transform: transformData };
  }

  // 计算各个面的设计到印刷区域的距离
  calcDesignArea(productConfig) {
    const overspreadObj = {};
    const copyCfgs = productConfig.cfgs;
    this.productData.views.forEach((item) => {
      const viewId = item.id,
        viewName = item.name;
      const layer = this.getCurStageLayer(viewId).layer;
      const printAreaRect = layer.findOne('.print_area_border_outer');
      for (const img of layer.find('.designImg')) {
        if (img.visible()) {
          const rotateNodePoint = this.getRotateNodePoint({
            node: img,
            layer,
          });
          const minX = rotateNodePoint.VStart,
            minY = rotateNodePoint.HStart,
            maxX = rotateNodePoint.VEnd,
            maxY = rotateNodePoint.HEnd;
          if (overspreadObj[viewId] == undefined) {
            overspreadObj[viewId] = {
              viewName: viewName,
              leftNum: minX,
              topNum: minY,
              rightNum: maxX,
              bottomNum: maxY,
              printAreaWidth: printAreaRect.width(),
              printAreaHeight: printAreaRect.height(),
            };
          }

          const cfgsIndex = copyCfgs.findIndex((item) => {
            return item.view_id == viewId;
          });
          if (
            cfgsIndex != -1 &&
            (copyCfgs[cfgsIndex].type == 'bgColor' ||
              (copyCfgs[cfgsIndex].image && copyCfgs[cfgsIndex].image.tileType != ''))
          ) {
            overspreadObj[viewId].leftNum = 0;
            overspreadObj[viewId].topNum = 0;
            overspreadObj[viewId].rightNum = printAreaRect.width();
            overspreadObj[viewId].bottomNum = printAreaRect.height();
          }

          if (minX < overspreadObj[viewId].leftNum) {
            overspreadObj[viewId].leftNum = minX;
          }
          if (minY < overspreadObj[viewId].topNum) {
            overspreadObj[viewId].topNum = minY;
          }
          if (maxX > overspreadObj[viewId].rightNum) {
            overspreadObj[viewId].rightNum = maxX;
          }
          if (maxY > overspreadObj[viewId].bottomNum) {
            overspreadObj[viewId].bottomNum = maxY;
          }
          copyCfgs.splice(cfgsIndex, 1);
        }
      }
    });
    return { overspreadObj };
  }

  updateDesignsInfo(viewId = this.viewId, isArea=false): void{
    const {layer} = this.getCurStageLayer(viewId);
    if(!this.designsInfoMap[viewId]) this.designsInfoMap[viewId] = {};
    const designs = layer.find('.design');
    let nodes = [], hasBg = false, overspreadData = null;
    designs.forEach(item => {
      if(item.hasName('bgRect')) {
        nodes.push({
          node: item,
          type: 'bgcolor'
        });
        hasBg = true;
      } else if(item.hasName('designImg')){
        const {vagueData, transformData} = this.checkVague(item);
        nodes.push({
          node: item,
          type: 'image',
          vagueData,
          transformData
        });
      } else if(item.hasName('designText')){
        nodes.push({
          node: item,
          type: 'text'
        });
      }
    });
    this.designsInfoMap[viewId].nodes = nodes;

    if(nodes.length && !hasBg){
      overspreadData = this.checkOverSpread(viewId, isArea);
      this.designsInfoMap[viewId].overspreadData = overspreadData;
    }
  }

  async localImageUpdate({src, File, imageData, originWidth, originHeight}) {
    let { designObj } = await this.updateImage({src, imageData, isLocalImg: true, originWidth, originHeight})
    const time = new Date().getTime()
    for(let _viewId in designObj) {
      for(let item of designObj[_viewId]) {
        item.node.File = File
        item.node.uploadImgId = time
      }
    }
  }
}

export default Helper