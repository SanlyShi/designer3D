import {Designer, SaveData} from "./types";
import {calcTwoTransform, formateColor} from "./utils";
import Konva from "./dependence/konva7.2.1";

interface DataTransformer extends Designer {}

class DataTransformer {

  imgSizeCalculate(imageData: { size: { width: number; height: number } }, viewId: number) {
    const viewerSize = this.convertSizeToMm(
      { width: imageData.size.width, height: imageData.size.height },
      this.productData.dpi
    );
    const defaultConfig = this.getDesigneConfiguration({ viewId: viewId }),
      defaultScale = this.convertDefaultScale(viewerSize, defaultConfig.config),
      defaultScaleHeight = this.convertDefaultScaleHeight(
        viewerSize.height * defaultScale,
        defaultConfig.config.height
      );

    //防止除不尽
    const iw =
      viewerSize.width * defaultScale * defaultScaleHeight > defaultConfig.config.width
        ? defaultConfig.config.width
        : viewerSize.width * defaultScale * defaultScaleHeight;
    const ih =
      viewerSize.height * defaultScale * defaultScaleHeight > defaultConfig.config.height
        ? defaultConfig.config.height
        : viewerSize.height * defaultScale * defaultScaleHeight;
    return { width: iw, height: ih, viewerSize: viewerSize };
  }

  private convertSizeToMm(designeSize: object, dpi: number) {
    const pixelToMm = function (pixel: number, dpi: number) {
      return (pixel * 25.4) / dpi;
    };
    return {
      height: pixelToMm(designeSize['height'], dpi),
      width: pixelToMm(designeSize['width'], dpi),
    };
  }

  private getDesigneConfiguration({ viewId }) {
    const rel = this.cacheProductPrintAreas;
    let _rel;
    for (let i = 0, ii = rel.length; i < ii; i++) {
      if (rel[i].defaultViews == viewId) {
        _rel = rel[i];
        break;
      }
    }

    return _rel;
  }

  private convertDefaultScale(size: object, _size: object) {
    if (size['width'] > _size['width']) {
      return _size['width'] / size['width'];
    } else {
      return 1;
    }
  }

  private convertDefaultScaleHeight(curViewerSizeHeight: number, defaultConfigHeight: number) {
    if (curViewerSizeHeight > defaultConfigHeight) {
      return defaultConfigHeight / curViewerSizeHeight;
    }
    return 1;
  }

  getProductConfiguration({
                                    isSaveProduct = true,
                                    viewId,
                                  }: {
    isSaveProduct?: boolean;
    viewId?: number;
  }): any {
    var productViews = this.productData.views,
      cfgs: Array<SaveData> = [],
      products: any = {
        color_id: '',
        view_id: this.viewId,
        product_type_id: this.productData.code,
        cfgs: []
      }
    let part_cfg_list = []
    this.partCheckedList.forEach(item => { //部件spu的id
      this.productData.spu_details.forEach(spu => {
        if(spu.part_id == item.partId) {
          spu.detail_parts.forEach(de => {
            if(de.part_detail_id == item.childPartId) {
              de.items.forEach(items => {
                if(items.color_id == item.colorId && items.size_id == item.sizeId) {
                  part_cfg_list.push(items.id)
                }
              })
            }
          })
        }
      })
    })
    products.part_cfg = part_cfg_list.join(',')
    if(viewId) {
      productViews = [productViews.find(item => item.id == viewId)]
    }
    for (let item of productViews) {
      let stage = this.stageObj[item.id];
      let layer = stage.findOne(".designLayer");
      let designImg = layer.find(".designImg") || [],
        designText = layer.find(".designText") || [],
        bgRectGroup = layer.find(".bgRect") || [];
      if (designImg.length + designText.length + bgRectGroup.length > 0) {
        for (let node of bgRectGroup) {
          //背景色
          if (node.visible()) {
            let colorData = formateColor({ color: node.fill() });
            let konvaAttrs = Object.assign({}, node.getAttrs(), {
              stageWidth: this.canvasSize * layer.scaleX(),
              layerScale: layer.scaleX(),
            });
            cfgs.push({
              color: {
                value: colorData.value,
                fillOpacity: colorData.alpha,
              },
              print_area_id: layer.getAttrs().printAreaId,
              view_id: item.id,
              type: "bgColor",
              konvaAttrs,
            });
          }
        }
        for (let node of layer.find(".design")) {
          if (node.visible() && node.hasName("designImg")) {
            cfgs.push(
              this.getDesignesConfiguration({
                node,
                viewId: item.id,
                layer,
                isSaveProduct
              })
            );
          } else if (node.visible() && node.hasName("designText")) {
            cfgs.push(
              this.getTextConfiguration({
                node,
                viewId: item.id,
                layer,
                isSaveProduct
              })
            );
          }
        }
      }
    }

    // if(viewId) {
    //   designsInfoMap = { [viewId]: this.getDesignsInfo(viewId) }
    // } else {
    //   designsInfoMap = this.getDesignsInfo()
    // }
    // // if (viewId) designsInfoMap = { [viewId]: designsInfoMap[viewId] }
    // Object.entries(designsInfoMap).forEach(([key, val]) => {
    //   if(Number(key) !== 9999) {
    //     const {layer} = this.getCurStageLayer(Number(key));
    //     for(let item of val.nodes) {
    //       let node = item.node
    //       if(node.visible()) {
    //         switch(item.type) {
    //           case 'bgcolor':
    //             const colorData = formateColor({ color: node.fill() });
    //             const konvaAttrs = {
    //               stageWidth: this.canvasSize * layer.scaleX(),
    //               layerScale: layer.scaleX(),
    //             }
    //             cfgs.push({
    //               color: {
    //                 value: colorData.value,
    //                 fillOpacity: colorData.alpha,
    //               },
    //               print_area_id: layer.getAttrs().printAreaId,
    //               view_id: Number(key),
    //               type: 'bgColor',
    //               konvaAttrs,
    //             });
    //             break;
    //           case 'image':
    //             cfgs.push(
    //               this.getDesignesConfiguration({
    //                 node,
    //                 viewId: Number(key),
    //                 layer,
    //                 isSaveProduct,
    //               })
    //             );
    //             break;
    //           case 'text':
    //             cfgs.push(
    //               this.getTextConfiguration({
    //                 node,
    //                 viewId: Number(key),
    //                 layer,
    //                 isSaveProduct
    //               })
    //             );
    //             break;
    //         }
    //       }
    //     }
    //   }
    // })

    products.cfgs = cfgs;
    if(this.templateCode) products.template_code = this.templateCode
    return products;
  }

  private getDesignesConfiguration({ node, viewId, layer, isSaveProduct }) {
    const nodeAttrs = JSON.parse(JSON.stringify(node.getAttrs()));
    const layerAttrs = layer.getAttrs();
    //传mm的宽高给后端，矩阵也需要用mm
    let pxToMmScaleX = (layerAttrs.ratio * node.width()) / nodeAttrs.widthMM,
      pxToMmScaleY = (layerAttrs.ratio * node.height()) / nodeAttrs.heightMM;
    let clipWidth,
      clipHeight,
      clipData,
      designImg2 = nodeAttrs.flipImgUrl;
    if (nodeAttrs.isclip) {
      clipData = nodeAttrs.clipData;
      const { imgAttrs, pathAttrs } = clipData;
      designImg2 = clipData.imgAttrs.originImg;
      clipWidth =
        ((pathAttrs.width * pathAttrs.scaleX) / (imgAttrs.width * imgAttrs.scaleX)) *
        nodeAttrs.widthMM;
      clipHeight =
        ((pathAttrs.height * pathAttrs.scaleY) / (imgAttrs.height * imgAttrs.scaleY)) *
        nodeAttrs.heightMM;
      clipData.imgAttrs.originImg = isSaveProduct ? '' : clipData.imgAttrs.originImg;
      pxToMmScaleX = (layerAttrs.ratio * node.width()) / clipWidth;
      pxToMmScaleY = (layerAttrs.ratio * node.height()) / clipHeight;
    }
    const designeTransform = node.getTransform();
    const designeTransformCopy = designeTransform.copy();
    designeTransformCopy.scale(pxToMmScaleX, pxToMmScaleY);
    // let rotateNodePoint = this.getRotateNodePoint({ node, layer });
    designeTransformCopy.m[4] = designeTransformCopy.m[4] * layerAttrs.ratio;
    designeTransformCopy.m[5] = designeTransformCopy.m[5] * layerAttrs.ratio;
    // let matrix = JSON.parse(JSON.stringify(designeTransformCopy.m));
    // matrix[4] = matrix[4] * layerAttrs.ratio; //px转mm
    // matrix[5] = matrix[5] * layerAttrs.ratio;

    const twoTransform = calcTwoTransform(designeTransformCopy, (node.rotation() * Math.PI) / 180);

    //konva数据还原
    delete nodeAttrs.image;
    if (isSaveProduct) {
      // nodeAttrs.imageData.designImg = '';
      // nodeAttrs.imageData.designImg2 = '';
      // nodeAttrs.imageData.designImg3 = ''; //旧版翻转图片跳到新版传过来的是base64
      nodeAttrs.flipImgUrl = ''; //base64太大，传不了
      designImg2 = '';
    }
    nodeAttrs.stageWidth = this.canvasSize * layer.scaleX();
    nodeAttrs.layerScale = layer.scaleX();
    const designeData: SaveData = {
      image: {
        gallery_id: nodeAttrs.imageData.code,
        designImg2,
        // transform:
        //   nodeAttrs.tileType != ""
        //     ? `matrix(${Math.abs(node.scaleX()) * pxToMmScaleX},0,0,${Math.abs(
        //         node.scaleY() * pxToMmScaleY
        //       )},0,0)`
        //     : "matrix(1,0,0,1,0,0)",
        // gTransform: `matrix(${matrix.join(",")})`,
        // height: nodeAttrs.heightMM / (nodeAttrs.heightMM / layerAttrs.ratio / node.height()), // 后台使用这个值计算，前台添加图片时对原图进行了缩放，为了使transform正确，这里要把传给后端的宽高缩放
        // width: nodeAttrs.widthMM / (nodeAttrs.widthMM / layerAttrs.ratio / node.width()),
        transform: twoTransform.transform,
        gTransform: twoTransform.gTransform,
        height: nodeAttrs.heightMM,
        width: nodeAttrs.widthMM,
        opacity: 1,
        tileType: nodeAttrs.tileType,
        hspacing: nodeAttrs.spacingH,
        vspacing: nodeAttrs.spacingV,
        isBg: node.hasName('isBg') ? 1 : 0,
        // offset_x: rotateNodePoint.VStart * layerAttrs.ratio,
        // offset_y: rotateNodePoint.HStart * layerAttrs.ratio,
        offset_x: (node.x() - (node.width() * Math.abs(node.scaleX())) / 2) * layerAttrs.ratio,
        offset_y: (node.y() - (node.height() * Math.abs(node.scaleY())) / 2) * layerAttrs.ratio,
        rotate: node.rotation(),
        name: nodeAttrs.imageData.name,
        size: nodeAttrs.imageData.size,
        rendercode: nodeAttrs.rendercode || '',
        render_id: nodeAttrs.render_id || '',
        xFlip: nodeAttrs.xFlip,
        yFlip: nodeAttrs.yFlip,
        risk_gallery: nodeAttrs.imageData.risk_gallery,
        risk_word: [],
        channel_id: nodeAttrs.imageData.channel_id
      },
      dpi: 100,
      view_id: viewId,
      print_area_id: layerAttrs.printAreaId,
      type: 'design',
      konvaAttrs: isSaveProduct ? this.imageStructural(nodeAttrs) : nodeAttrs,
    };
    if (nodeAttrs.isclip) {
      designeData.image.isclip = true;
      designeData.image.clipData = clipData;
      designeData.image.clipWidth = clipWidth;
      designeData.image.clipHeight = clipHeight;
    }
    if (!isSaveProduct) {
      designeData.image.designImg = nodeAttrs.imageData.designImg3;
      // matrix[3] = matrix[3] / (nodeAttrs.heightMM / layerAttrs.ratio / node.height())
      // matrix[0] = matrix[0] / (nodeAttrs.widthMM / layerAttrs.ratio / node.width());
      // designeData.image.gTransform = `matrix(${matrix.join(",")})`
      designeData.image.height = nodeAttrs.heightMM;
      designeData.image.width = nodeAttrs.widthMM;
    }
    return designeData;
  }

  private getTextConfiguration({ node, viewId, layer, isSaveProduct }) {
    const text = node.findOne('Text');
    node.setAttrs(this.textAttrToLabel({ node }));
    const nodeAttrs = JSON.parse(JSON.stringify(node.getAttrs()));
    const layerAttrs = layer.getAttrs();
    const designeTransform = node.getTransform();
    const rotateNodePoint = this.getRotateNodePoint({ node, layer });
    const matrix = JSON.parse(JSON.stringify(designeTransform.m));
    const angle = (node.rotation() * Math.PI) / 180;
    // matrix[5] = (matrix[5] + (node.height() * node.scaleY() - node.height()) - 6.35 * layerAttrs.ratio) * layerAttrs.ratio + text.fontSize() * layerAttrs.ratio;
    // matrix[5] = (matrix[5] + (node.height() * node.scaleY() - node.height())) * layerAttrs.ratio / layerAttrs.backRatio + text.fontSize() * layerAttrs.ratio / layerAttrs.backRatio;
    // matrix[5] =
    //   (matrix[5] +
    //     ((text.lineHeight() * text.fontSize()) / 2) * node.scaleY()) *
    //   layerAttrs.ratio;
    // matrix[5] = (matrix[5]) * layerAttrs.ratio;

    nodeAttrs.stageWidth = this.canvasSize * layer.scaleX();
    nodeAttrs.layerScale = layer.scaleX();

    const tspanListData: Array<any> = [];
    let textAnchorX = 0,
      textAnchor = 'start';
    for (let i = 0; i < text.text().split('\n').length; i++) {
      const item = text.text().split('\n')[i];
      const createText = new Konva.Text({
        text: item,
        scaleX: nodeAttrs.scaleX,
        scaleY: nodeAttrs.scaleY,
        fontSize: text.fontSize(),
      });
      if (i == 0) {
        matrix[4] =
          (matrix[4] - createText.height() * node.scaleY() * Math.sin(angle)) * layerAttrs.ratio; //px转mm
        matrix[5] =
          (matrix[5] + createText.height() * node.scaleY() * Math.cos(angle)) * layerAttrs.ratio;
        // console.log('####', `matrix(${matrix.join(",")})`, Math.cos(angle), text.fontSize() * layerAttrs.ratio)
        // console.log("@@@@", createText.height() * node.scaleY(), Math.sin(angle), layerAttrs.ratio)
      }

      const createTextWidth = nodeAttrs.width;
      switch (text.align()) {
        case 'left':
          textAnchorX = 0;
          textAnchor = 'start';
          break;
        case 'center':
          textAnchorX = (createTextWidth / 2) * layerAttrs.ratio;
          textAnchor = 'middle';
          break;
        case 'right':
          textAnchorX = createTextWidth * layerAttrs.ratio;
          textAnchor = 'end';
          break;
      }
      const colorData = formateColor({ color: text.fill() });
      tspanListData.push({
        content: item,
        fill: colorData.value,
        fillOpacity: colorData.alpha,
        fontFamily: text.fontFamily(),
        fontSize: text.fontSize() * layerAttrs.ratio + 'px',
        fontStyle: text.fontStyle().indexOf('italic') != -1 ? 'italic' : '',
        fontWeight: text.fontStyle().indexOf('bold') != -1 ? 'bold' : '',
        textDecoration: text.textDecoration(),
        textAnchor: textAnchor,
        x: textAnchorX,
        y:
          i == 0
            ? 0
            : (createText.height() * Math.abs(node.scaleY()) * i * layerAttrs.ratio) /
            Math.abs(node.scaleY()),
      });
    }
    const colorData = formateColor({ color: text.stroke() });
    const textData = {
      text: {
        tspans: tspanListData,
        x: 0,
        y: 0,
        transform: `matrix(${matrix.join(',')})`,
        gTransform: `matrix(1,0,0,1,0,0)`,
        handleGroupTransform: `matrix(1,0,0,1,0,0)`,
        width: rotateNodePoint.width * layerAttrs.ratio,
        height: rotateNodePoint.height * layerAttrs.ratio,
        textBg: formateColor({ color: node.findOne('Rect').fill() }).value,
        textBgX: 0,
        textBgY: 0,
        textBgWidth: 0,
        textBgheight: 0,
        stroke: colorData.value,
        strokeOpacity: colorData.alpha,
        strokeWidth: text.strokeWidth() * layerAttrs.ratio + 'px',
        strokeValue: node.strokeValue,
        // dominantBaseline: "hanging",
        strokeMiterLimit: 10,
        // fontStyle: text.fontStyle().indexOf("italic") != -1 ? "italic" : "",
        // fontWeight: text.fontStyle().indexOf("bold") != -1 ? "bold" : "",
        // textDecoration: text.textDecoration()
      },
      dpi: 100,
      print_area_id: layerAttrs.printAreaId,
      view_id: viewId,
      type: 'text',
      konvaAttrs: isSaveProduct ? this.textStructural(nodeAttrs) : nodeAttrs,
    };

    // var filterBg = element.select(".filterBg");
    // var textPathG = element.select(".textPathG");
    // if (filterBg) {
    //   var textBg = filterBg.select("feFlood").attr("flood-color");
    //   textData.text.textBg = textBg;
    // }
    // if (textPathG) {
    //   var textPathGTransform = textPathG.transform().localMatrix.toString();
    //   var pathTransform = textPathG
    //     .select("path")
    //     .transform()
    //     .localMatrix.toString();
    //   var pathD = textPathG.select("path").attr("d");
    //   textData.text.textPathGTransform = textPathGTransform;
    //   textData.text.pathTransform = pathTransform;
    //   textData.text.pathD = pathD;
    //   var sliderLeft =
    //     $(element.node).data("sliderLeft") / $(".text-slider").width();
    //   textData.text.sliderLeft = sliderLeft;
    //   textData.text.dy = text.attr("dy");
    // }
    // textData.text.stroke = text.attr('stroke')
    // textData.text.strokeWidth = text.attr('stroke-width')
    // textData.text.strokeValue = $(text.node).data('strokeValue')

    return textData;
  }

  private textAttrToLabel({ node }) {
    const layer = node.getLayer();
    const nodeAttr = JSON.parse(JSON.stringify(node.getAttrs()));
    const text = node.findOne('Text');
    nodeAttr.designText = text.text();
    (nodeAttr.designFill = node.findOne('Rect').fill()),
      (nodeAttr.proStrokeWidth = text.strokeWidth());
    nodeAttr.proStroke = text.stroke();
    nodeAttr.textColor = text.fill();
    nodeAttr.proFontFamily = text.fontFamily();
    nodeAttr.proFontSize = text.fontSize();
    // nodeAttr.canvasFontSize =
    //   (text.fontSize() * layer.scaleX()) / (stage.width() / 547.2);
    nodeAttr.proFontStyle = text.fontStyle();
    nodeAttr.proTextDecoration = text.textDecoration();
    nodeAttr.textAlign = text.align();
    nodeAttr.stageWidth = this.canvasSize * layer.scaleX();
    nodeAttr.layerScale = layer.scaleX();
    nodeAttr.strokeValue = node.strokeValue;
    return nodeAttr;
  }

  textStructural(attrs) {
    let konvaAttrs: any = this.structuralKonvaAttrs(attrs)
    konvaAttrs.designFill = attrs.designFill
    konvaAttrs.designText = attrs.designText
    konvaAttrs.proFontFamily = attrs.proFontFamily
    konvaAttrs.proFontSize = attrs.proFontSize
    konvaAttrs.proFontStyle = attrs.proFontStyle
    konvaAttrs.proStroke = attrs.proStroke
    konvaAttrs.proStrokeWidth = attrs.proStrokeWidth
    konvaAttrs.strokeValue = attrs.strokeValue
    konvaAttrs.textAlign = attrs.textAlign
    konvaAttrs.textColor = attrs.textColor
    konvaAttrs.rotation = attrs.rotation || 0
    return konvaAttrs
  }

  //只存前端需要的字段
  private structuralKonvaAttrs(attrs) {
    let konvaAttrs: any = {}
    konvaAttrs.layerScale = attrs.layerScale
    konvaAttrs.offsetX = attrs.offsetX
    konvaAttrs.offsetY = attrs.offsetY
    konvaAttrs.scaleX = attrs.scaleX
    konvaAttrs.scaleY = attrs.scaleY
    konvaAttrs.x = attrs.x
    konvaAttrs.y = attrs.y
    konvaAttrs.width = attrs.width
    konvaAttrs.height = attrs.height
    if(attrs.skewX) { //文字斜体
      konvaAttrs.skewX = attrs.skewX
      konvaAttrs.skewY = attrs.skewY
    }
    konvaAttrs.stageWidth = attrs.stageWidth
    return konvaAttrs
  }

  imageStructural(attrs) {
    let konvaAttrs: any = this.structuralKonvaAttrs(attrs)
    if(attrs.isclip) {
      konvaAttrs.isclip = attrs.isclip
      konvaAttrs.clipData = attrs.clipData
    }
    return konvaAttrs
  }

  convertDefaultConfig({ width, height }) {
    if (!this.productData['design_width']) {
      this.productData['design_width'] = '100';
    }
    const designWidthRatio: number = Number(this.productData['design_width']) / 100;

    if (!this.productData.design_height) {
      this.productData.design_height = '0';
    }

    const designHeightRatio: number = 1 - Math.abs(Number(this.productData.design_height)) / 100;

    const defaultWidth = parseInt(width),
      defaultHeight = parseInt(height),
      scaledWidth = defaultWidth * designWidthRatio,
      scaledHeight = defaultHeight * designHeightRatio;

    let flag: string;
    if (this.productData.design_height.indexOf('-') == -1) {
      flag = 'top';
    } else {
      flag = 'bottom';
    }

    return {
      defaultWidth: defaultWidth,
      defaultHeight: defaultHeight,
      width: scaledWidth,
      height: scaledHeight,
      x: (defaultWidth - scaledWidth) / 2,
      y: defaultHeight - scaledHeight,
      flag: flag,
    };
  }

  private imgFullAllDesign() {
    let productConfig = this.getProductConfiguration({});
    let viewIdLength = this.productData.views.length;
    let vagueDesignId = [],
      vagueDesignName = [],
      saveProductObj = {
        is_overspread: 1, //1：铺满  -1: 未铺满
        is_vague: -1 //1: 模糊  -1: 清晰
      };
    let designsInfoMap = this.getDesignsInfo()
    let overspreadObj = {};
    let copyCfgs = JSON.parse(JSON.stringify(productConfig.cfgs));
    for (let i = 0; i < viewIdLength; i++) {
      let viewId = this.productData.views[i].id,
        viewName = this.productData.views[i].name;
      let layer = this.getCurStageLayer(viewId).layer;
      let printAreaRect = layer.findOne(".print_area_border_outer");
      Object.entries(designsInfoMap).forEach(([key, val]) => {
        if(key === viewId) {
          // @ts-ignore
          val.nodes.forEach(item => {
            if(item.type === 'image' && item.node.visible()) {
              if(item.vagueData.type != 0) {
                vagueDesignId.push(viewId); //存在图片模糊的面
              }
              if (this.productData.imgFull == 1) {
                //全幅产品，设计未铺满设计区域
                let rotateNodePoint = this.getRotateNodePoint({
                  node: item.node,
                  layer,
                });
                let minX = rotateNodePoint.VStart,
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

                let cfgsIndex = copyCfgs.findIndex((item) => {
                  return item.view_id == viewId;
                });
                if (
                  cfgsIndex != -1 &&
                  (copyCfgs[cfgsIndex].type == "bgColor" ||
                    (copyCfgs[cfgsIndex].image &&
                      copyCfgs[cfgsIndex].image.tileType != ""))
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
          })
        }
      })
    }

    //图片铺满
    let noOverspreadName = [];
    for (let i in overspreadObj) {
      if (overspreadObj[i].leftNum < 0) overspreadObj[i].leftNum = 0;
      if (overspreadObj[i].topNum < 0) overspreadObj[i].topNum = 0;
      if (overspreadObj[i].rightNum > overspreadObj[i].printAreaWidth)
        overspreadObj[i].rightNum = overspreadObj[i].printAreaWidth;
      if (overspreadObj[i].bottomNum > overspreadObj[i].printAreaHeight)
        overspreadObj[i].bottomNum = overspreadObj[i].printAreaHeight;

      let designWidthRatio =
        (overspreadObj[i].rightNum - overspreadObj[i].leftNum) /
        overspreadObj[i].printAreaWidth;
      let designHeightRatio =
        (overspreadObj[i].bottomNum - overspreadObj[i].topNum) /
        overspreadObj[i].printAreaHeight;
      if (designWidthRatio < 0.98 || designHeightRatio < 0.98) {
        noOverspreadName.push(
          `${overspreadObj[i].viewName.substr(0, 1)}`
        );
      }
    }
    if (noOverspreadName.length > 0) {
      saveProductObj.is_overspread = -1;
    }

    //图片模糊
    for (let views of this.productData.views) {
      if (
        vagueDesignId.some((item) => {
          return views.id == item;
        })
      ) {
        vagueDesignName.push(`${views.name.substr(0, 1)}`);
      }
    }
    if (vagueDesignName.length > 0) {
      saveProductObj.is_vague = 1;
    }
    return saveProductObj
  }

  public getSaveData({isSaveProduct = true} = {}) {
    let saveProductObj = this.imgFullAllDesign()
    let productConfig = this.getProductConfiguration({ isSaveProduct });
    productConfig.is_overspread = saveProductObj.is_overspread;
    productConfig.is_vague = saveProductObj.is_vague;
    let cfgs = productConfig.cfgs || [];
    for (let i = 0; i < cfgs.length; i++) {
      let cfg = cfgs[i];
      if (cfg.type == "design") {
        cfg.image.designImg2 = "";
      }
    }
    return productConfig
  }

  getDesignsInfo(viewId?: number){
    if(viewId) {
      this.updateDesignsInfo(viewId)
    } else {
      this.productData.views.forEach(item => {
        this.updateDesignsInfo(item.id)
      })
    }
    return viewId ? this.designsInfoMap[viewId] : this.designsInfoMap;
  }
}

export default DataTransformer