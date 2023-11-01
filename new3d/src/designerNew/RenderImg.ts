import {ArrIndex, Designer, DetailImgObj} from "./types";
import {getViews, imageOnload, loadFont} from "./designerLogicProcess";
import {convertColorDetailMajorImageData, imgToFormData, radiusRect} from "./utils";
import Konva from "./dependence/konva7.2.1";
import {zw_Mesh2D} from "../utils/createMesh";
import {zw_PerspT} from "../utils/perspective-transform";
import {composeDetail3D} from "../composeDetail3D";
import {DesignerGlobals} from './base'

interface RenderImg extends Designer {}

//16*16 三角形面片进行拟合
const FISH_DIV = 16;
const FISH_DIV_h = 16;

class RenderImg {

  getPartCheckedList() {
    for (const item of this.productData.spu_details) {
      for (const det of item.detail_parts) {
        if (det.is_default === 1) {
          for (const it of det.items) {
            if (it.is_default == 1) {
              //默认颜色尺码
              this.partCheckedList.push({
                partId: item.part_id,
                childPartId: det.part_detail_id,
                colorId: it.color_id,
                sizeId: it.size_id,
              });
              break;
            }
          }
        }
      }
    }
  }

  async getDetailImages({indexList, colorId, imageOrCanvas = 'image', workOrder = false, destroyThreeDAppCallback}
                          : {indexList: Array<number>, colorId: number, imageOrCanvas: string, workOrder: boolean, destroyThreeDAppCallback}) {
    this.indexList = indexList;
    this.layerToImageOrCanvas = 'both'
    for(let item of this.productData.views) {
      this.getCanvasImage(item.id);
    }
    const detailImgList = await this.getDetailImgs(this.indexList, colorId, workOrder, destroyThreeDAppCallback);
    // Promise.all(promises).then(async () => {
    if (imageOrCanvas == 'canvas') {
      return this.viewImgArr
    } else {
      let canvasImgArr = []
      for (const item of detailImgList) {
        let canvasImgObj = {
          index: item.index,
          colorId: item.colorId,
          position: item.position,
          master: item.master,
          isUserDefined: item.isUserDefined,
          src: '',
          error: item.error
        }
        if (item.isUserDefined) {
          let boardImg: string = await this.drawBoardImg({
            detailImages: item.boardObj,
            baseWidth: item.baseWidth,
          });
          //自定义底板是画好一整张图
          canvasImgObj.src = boardImg
        } else {
          const canvas = document.createElement('canvas');
          canvas.width = 600;
          canvas.height = 600;
          const context = canvas.getContext('2d');
          // context.fillStyle = 'rgba(0,0,0,.04)';
          // context.fillRect(0, 0, canvas.width, canvas.height);
          await imageOnload(item.image, context);
          for (const src of item.canvasArr) {
            await imageOnload(src, context);
          }
          await imageOnload(item.maskImg, context);
          canvasImgObj.src = canvas.toDataURL()
        }
        canvasImgArr.push(canvasImgObj)
      }
      canvasImgArr.forEach(item => {
        item.formData = imgToFormData(item)
      })
      return canvasImgArr
    }
  }

  getDetailImgs(indexList: ReadonlyArray<number>, colorId: number, workOrder: boolean = false, destroyThreeDAppCallback) {
    return new Promise<Array<DetailImgObj>>(async (resolve) => {
      if (this.isDestroy) return;
      let detailImgList: Array<DetailImgObj> = [];
      for (const index of indexList) {
        let colors = null
        if(workOrder) { //工单图只有一张
          this.destroy3DModel();
          convertColorDetailMajorImageData(this.productData, colorId)
          colors = this.productData.colorDetailMajorImage.find((item: any) => item.id == colorId);
        } else {
          colors = this.productData.colors.find((item: any) => item.id == colorId);
        }
        try{
          colors
        } catch(e) {
          console.error('当前产品不存在传入的颜色');
          return
        }
        await this.updateCurrentDetail(index, colors, destroyThreeDAppCallback).then(
          (imgObj: DetailImgObj) => {
            imgObj.colorId = colorId
            detailImgList.push(imgObj);
          }
        );
      }
      resolve(detailImgList);
    });
  }

  async drawBoardImg({ detailImages, baseWidth }): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = baseWidth;
    canvas.height = baseWidth;
    const ctx = <CanvasRenderingContext2D>canvas.getContext('2d');
    for (const item of detailImages.boardArr) {
      if (item.detail.type == 5) break; //type=5 布局
      ctx.save();
      if (!item.bgColor && !item.isText) {
        const layoutIndex = detailImages.boardArr.findIndex((b) => {
          return b.detail.type == 5;
        }); //存在布局
        if (layoutIndex != -1) {
          for (const layout of detailImages.boardArr[layoutIndex].detail.layoutData) {
            if (layout.layoutId == item.layoutId) {
              radiusRect(
                parseFloat(layout.x),
                parseFloat(layout.y),
                parseFloat(layout.width),
                parseFloat(layout.height),
                parseFloat(layout.radius),
                ctx
              );
              ctx.clip();
            }
          }
        }
      }
      if (!item.transform) item.transform = 'matrix(1,0,0,1,0,0)'; //背景色没传矩阵
      const m = item.transform.substring(7, item.transform.length - 1).split(',');
      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      if (item.bgColor) {
        ctx.fillStyle = item.bgColor;
        ctx.fillRect(item.left, item.top, item.width, item.height);
      } else if (item.isText) {
        await this.drawText({ data: item.detail, ctx });
      } else {
        if (item.image) {
          await this.drawImage({ url: item.image, data: item, ctx });
        }
        if (item.canvasImgArr) {
          for (const canvasimg of item.canvasImgArr) {
            await this.drawImage({ url: canvasimg, data: item, ctx });
          }
        }
        if (item.maskImg) {
          await this.drawImage({ url: item.maskImg, data: item, ctx });
        }
      }
      ctx.restore();
    }
    return canvas.toDataURL();
  }

  destroy3DModel({
                   detailImages,
                   deleteNum = -1,
                   isDeleteLarge = false,
                 }: {
    detailImages?: any;
    deleteNum?: number;
    isDeleteLarge?: boolean;
  } = {}) {
    let _deleteNum = deleteNum;
    for (let i = 0; i < DesignerGlobals.threeDApp.length; i++) {
      const app = DesignerGlobals.threeDApp[i];
      _deleteNum -= app.modelNum;
      let drawApp = app.drawApp;
      const code = app.code;
      if (isDeleteLarge && code.indexOf('-large-') == -1) continue; //只删大图模型，小图不删
      drawApp.destroy();
      drawApp = null;
      DesignerGlobals.threeDApp.splice(i, 1);
      i--;
      if (deleteNum >= 0) {
        if (code.indexOf('is3dModel') == -1 && code.indexOf('mainImage') == -1) {
          const colorId = code.split('colorId-')[1].split('-')[0];
          const renderIndex = code.split('renderIndex-')[1].split('-')[0];
          if (code.indexOf('large') == -1) {
            detailImages[colorId][renderIndex].rendered = false;
          }
        }
        if (_deleteNum <= 0) break;
      }
    }
  }

  updateCurrentDetail(index: number, colors, destroyThreeDAppCallback) {
    return new Promise(async (resolve) => {
      if (this.isDestroy) return;
      let detail: any;
      if (!colors.detail.length) {
        detail = colors.views[index];
      } else {
        detail = colors.detail[index];
      }
      const detailObj: any = {};
      if (detail.isUserDefined == 1) {
        //自定义底板
        detailObj.boardArr = [];
        detailObj.baseWidth = detail.base_width;
        detailObj.boardImg = '';
        for (const de of detail.detail) {
          detailObj.boardArr.push({
            maskImg: de.texture,
            image: de.image,
            bgColor: de.bgColor,
            type: de.parts ? de.parts[0].type : null,
            transform: de.transform,
            left: 0,
            top: 0,
            width: detail.base_width,
            height: detail.base_width,
            radius: 0,
            isText: de.type == 3 ? true : false,
            detail: de,
            layoutId: de.layoutId,
            // parts: de.parts
          });
        }
      }
      if (this.productData.hasDetail) {
        if (detail.isUserDefined == 1) {
          let i = 0;
          for (const de of detail.detail) {
            if (de.type == 1 || de.type == 2) {
              //底板类型 1: 底板图  2：底板模型 4: 背景图
              if (de.parts) {
                await this.createDetailCanvas({
                  detailImg: de,
                  baseWidth: detail.base_width,
                  renderIndex: index,
                  colorId: colors.id,
                  borderIndex: i,
                  destroyThreeDAppCallback,
                }).then((imgObj: DetailImgObj) => {
                  detailObj.boardArr[i].canvasImgArr = imgObj.canvasArr;
                });
              }
            }
            i += 1;
          }
          // await this.drawBoardImg({
          //   detailImages: detailObj,
          //   baseWidth: detail.base_width,
          // });
          resolve({ isUserDefined: 1, boardObj: detailObj, index, baseWidth: detail.base_width, position: detail.position, master: detail.master });
        } else {
          this.createDetailCanvas({
            detailImg: detail,
            baseWidth: this.productData.base_width,
            renderIndex: index,
            colorId: colors.id,
            destroyThreeDAppCallback,
          }).then((imgObj: DetailImgObj) => {
            resolve(imgObj);
          });
        }
      } else {
        for (const item of this.viewImgArr) {
          if (item.id == detail.id) {
            const curS = this.getCurStageLayer(detail.id);
            const layer = curS.layer;
            const designContainerGroup = curS.designContainerGroup.clone();

            designContainerGroup.findOne('.print_area_border_outer').destroy();

            const ratio = layer.getAttrs().ratio;
            let printArea = null;
            for (const view of this.productData.views) {
              if (view.id == detail.id) {
                printArea = view.printArea;
              }
            }
            const pixelRatio = 700 / (this.canvasSize / layer.scaleX()); //细节图大图width: 700
            if (printArea && printArea.soft_svg) {
              await (() => {
                return new Promise<void>((resolve) => {
                  designContainerGroup.clipFunc((ctx) => {
                    ctx.save();
                    ctx.translate(-designContainerGroup.x(), -designContainerGroup.y());
                    ctx.scale(1 / ratio, 1 / ratio);
                    new Konva.Path({
                      data: printArea.soft_svg,
                      stroke: '',
                      strokeWidth: 1,
                      // name: "auxiliaryPath pointoutPrint-area",
                    })._sceneFunc(ctx);
                    ctx.restore();
                    resolve();
                  });
                  const canvas = designContainerGroup.toCanvas();
                  designContainerGroup._drawChildren('drawScene', canvas, 'top');
                });
              })();
            }
            const src = designContainerGroup.toDataURL({
              x: 0,
              y: 0,
              pixelRatio,
              width: this.canvasSize / layer.scaleX(),
              height: this.canvasSize / layer.scaleX(),
              // pixelRatio: 1200 / (layerBg.width()*layer.scaleX())
            });
            designContainerGroup.destroy();
            if (detail.isUserDefined == 1) {
              let i = 0;
              for (let k = 0; k < detail.detail.length; k++) {
                detailObj.boardArr[i].canvasImgArr = [src];
                // this.$set(detailImages[colorId][index].boardArr[i], "canvasImgArr", [src]);
                i += 1;
              }
              // await this.drawBoardImg({
              //   detailImages: detailObj,
              //   baseWidth: detail.base_width,
              // });
              resolve({ isUserDefined: 1, boardObj: detailObj, index, baseWidth: detail.base_width });
            } else {
              resolve({ image: detail.image, maskImg: detail.texture, canvasArr: [src], index});
            }
          }
        }
      }
    });
  }

  drawImage({ url, data, ctx }) {
    return new Promise<void>((resolve, reject) => {
      if (this.isDestroy) return;
      const img = new Image();
      img.src = url;
      img.setAttribute('crossOrigin', 'anonymous');
      img.onload = () => {
        // ctx.save()
        // let m = data.nodeTransform.m
        // console.log('item.nodeTransform.m.slice(',')', data.nodeTransform.m.join(','))
        // ctx.rect(layout.left, layout.top, layout.width, layout.height)

        // ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5])
        ctx.drawImage(img, 0, 0, data.width, data.height);
        // ctx.restore()
        resolve();
      };
      img.onerror = () => {
        reject();
      };
    });
  }

  drawText({ data, ctx }) {
    return new Promise<void>(async (resolve) => {
      if (this.isDestroy) return;
      // let canvas = document.createElement('canvas')
      // canvas.width = baseWidth
      // canvas.height = baseWidth
      // let ctx = canvas.getContext('2d')
      // let m = data.transform.substring(7, data.transform.length -1).split(',')
      // ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5])
      /*等待所有字体加载完成*/
      await loadFont(data.tspans[0].pFontFamily, this.dataProcessor);
      ctx.textAlign = data.tspans[0].textAnchor;
      ctx.fillStyle = data.tspans[0].fill;
      ctx.strokeStyle = data.strokeValue;
      ctx.font = `${data.tspans[0].fontSize} ${data.tspans[0].fontFamily}`;
      ctx.lineWidth = data.strokeWidth;
      ctx.lineJoin = 'round';
      data.tspans.map((item) => {
        ctx.fillText(item.content, item.x, item.y);
        if (parseFloat(data.strokeWidth)) {
          ctx.strokeText(item.content, item.x, item.y);
        }
      });
      // ctx.restore()
      // console.log('&&&&&', detailImages[colorId][renderIndex].boardArr[boardIndex])
      // this.$set(
      //   detailImages[colorId][renderIndex].boardArr[boardIndex],
      //   "canvasImgArr",
      //   [canvas.toDataURL()]
      // );
      resolve();
    });
  }

  createDetailCanvas({
                       detailImg,
                       baseWidth,
                       renderIndex,
                       colorId,
                       borderIndex = -1,
                       destroyThreeDAppCallback,
                     }) {
    return new Promise((resolve) => {
      if (this.isDestroy) return;
      const imgObj: DetailImgObj = {
        image: detailImg.image,
        maskImg: detailImg.texture,
        canvasArr: [],
        index: renderIndex,
        colorId,
        position: detailImg.position,
        master: detailImg.master
      };
      const parts = detailImg.parts;
      // 所有异步处理数组
      const canvasImgArr: Array<string> = [];
      const promises: Array<Promise<void>> = [];
      let threeDetailFlag = false; //3D图是否渲染完
      for (const part of parts) {
        if (part.type == 0) {
          //画布图
          for (const item of this.viewImgArr) {
            if (item.id == part.target_view_id) {
              const canvasConfig = part.canvas_config;
              const views = getViews(part.target_view_id, this.productData);
              const promise = this.initCanvas(
                canvasConfig,
                item.viewDesign,
                views.print_area,
                part.mask?.image_url
              ).then((src: string) => {
                canvasImgArr.push(src);
              });

              promises.push(promise);
              break;
            }
          }
        } else if (part.type == 1) {
          //遮罩图
          // let img =
          // '<img class="visualization-mask" src="' +
          // part.cover_img.image_url +
          // '">';
          // visualizationCanvas.append(img);
          imgObj.maskImg = part.cover_img?.image_url;
        } else if (part.type == 2) {
          if (part.detail3D) {
            //兼容模型被删除的情况
            //3D图
            if (threeDetailFlag) continue; //3D所有part效果合成一张
            threeDetailFlag = true;
            const promise = this.create3DDetail(
              detailImg,
              baseWidth,
              renderIndex,
              colorId,
              borderIndex,
              destroyThreeDAppCallback
            ).then((src: string) => {
              canvasImgArr.push(src);
            });
            promises.push(promise);
          }
        }
      }
      Promise.all(promises).finally(() => {
        imgObj.canvasArr = canvasImgArr;
        resolve(imgObj);
      });
    });
  }

  initCanvas(canvasConfig, src: string, printArea, clipImg) {
    return new Promise<string>((resolve) => {
      if (this.isDestroy) return;
      const canvas: HTMLCanvasElement = document.createElement('canvas');
      //后台基于600px计算
      canvas.width = 600;
      canvas.height = 600;
      const ctx = <CanvasRenderingContext2D>canvas.getContext('2d');
      let dots: Array<{
        x: number;
        y: number;
      }> = [];
      let dotscopy;
      const img = new Image();
      img.setAttribute('crossOrigin', 'anonymous');
      img.src = src;
      let img2;
      if (clipImg) {
        img2 = new Image();
        img2.setAttribute('crossOrigin', 'anonymous');
        img2.src = clipImg;
      }

      const WIDTH = parseInt(((printArea.width / printArea.view_width) * 600).toString());
      const HEIGHT = parseInt(((printArea.height / printArea.view_width) * 600).toString());
      const meshObj = zw_Mesh2D.createMapMesh(WIDTH, HEIGHT, FISH_DIV, FISH_DIV_h);
      img.onload = function () {
        const img_w = WIDTH;
        const img_h = HEIGHT;
        const left = parseInt(((printArea.offset_x / printArea.view_width) * 600).toString());
        const top = parseInt(((printArea.offset_y / printArea.view_width) * 600).toString()) || 0.5;
        dots = [
          {
            x: left,
            y: top,
          },
          {
            x: left + img_w,
            y: top,
          },
          {
            x: left + img_w,
            y: top + img_h,
          },
          {
            x: left,
            y: top + img_h,
          },
        ];
        //保存一份不变的拷贝
        dotscopy = [
          {
            x: left,
            y: top,
          },
          {
            x: left + img_w,
            y: top,
          },
          {
            x: left + img_w,
            y: top + img_h,
          },
          {
            x: left,
            y: top + img_h,
          },
        ];
        meshObj.move(left, top);
        if (canvasConfig) {
          dots = JSON.parse(canvasConfig);
        }
        render();
      };

      function render() {
        let srcCorners: ArrIndex = [];
        let dstCorners: ArrIndex = [];
        let perspT: any = {};

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        srcCorners = [
          dotscopy[0].x,
          dotscopy[0].y,
          dotscopy[1].x,
          dotscopy[1].y,
          dotscopy[2].x,
          dotscopy[2].y,
          dotscopy[3].x,
          dotscopy[3].y,
        ];

        dstCorners = [
          dots[0].x,
          dots[0].y,
          dots[1].x,
          dots[1].y,
          dots[2].x,
          dots[2].y,
          dots[3].x,
          dots[3].y,
        ];
        /* 透视变化矩阵计算 */
        perspT = zw_PerspT(srcCorners, dstCorners);
        for (let i = 0; i < meshObj.points.length; i++) {
          const newPoint = perspT.transform(meshObj.points[i].x, meshObj.points[i].y);
          meshObj.points[i].x = newPoint[0];
          meshObj.points[i].y = newPoint[1];
        }
        /**
         * 兼容Safari
         * 在Safari使用globalCompositeOperation，会使浏览器绘图阻塞导致卡顿
         * 解决办法：在有透明颜色的时候才使用此属性
         */
        // if(_this.hasOpacity({viewId: _this.viewId})) {
        //   ctx.globalCompositeOperation = "destination-atop";
        // }
        if (navigator.userAgent.toLowerCase().match(/version\/([\d.]+).*safari/) == null) {
          ctx.globalCompositeOperation = 'destination-atop';
        } else {
          ctx.globalCompositeOperation = 'lighter';
        }
        meshObj.drawImageToContext(img, ctx);
        // ctx.drawImage(img, 0, 0)

        if (clipImg) {
          if (img2.complete) {
            maskImg();
            createCanvasImage();
          } else {
            img2.onload = function () {
              maskImg();
              createCanvasImage();
            };
          }
        } else {
          createCanvasImage();
        }
      }

      function createCanvasImage() {
        const src = canvas.toDataURL('image/png', 1.0);
        // canvasImage.attr("src", src);
        resolve(src);
      }

      function maskImg() {
        ctx.save();
        //重新画的时候找个属性要去掉，不然都是已找个属性是操作
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(img2, 0, 0, 600, 600);
        ctx.restore();
      }
    });
  }

  async create3DDetail(
    detailImg,
    baseWidth,
    renderIndex,
    colorId,
    borderIndex,
    destroyThreeDAppCallback
  ) {
    // 图片尺寸
    const canvasSize = 600;
    // 模型数据
    const modelOptions = detailImg.parts;
    const faceListMap = {};
    for (const item of this.viewImgArr) {
      faceListMap[item.id] = item.viewDesignCanvas;
    }
    const code = `${this.productData.code}-${colorId}-${renderIndex}-${borderIndex}`;
    let drawApp: any;
    for (const app of DesignerGlobals.threeDApp) {
      if (app.code == code) {
        drawApp = app.drawApp;
        break;
      }
    }
    return new Promise((resolve) => {
      if (this.isDestroy) return;
      if (drawApp) {
        drawApp.updateFaceListMap(faceListMap, (src) => {
          resolve(src);
        });
      } else {
        const modelNum = modelOptions.length;
        let modelNumTotal = modelNum;
        for (const app of DesignerGlobals.threeDApp) {
          modelNumTotal += app.modelNum;
        }
        /**
         * @param destroyThreeDAppCallback
         * 删除模型回调
         * 有：表示外层想自己控制模型数量
         * 无：表示内层控制，每新加模型就把上一次的模型删除
         */
        if (destroyThreeDAppCallback) {
          destroyThreeDAppCallback(modelNumTotal); //把当前的模型数量传出去，由外层控制最大模型数量，决定是否删除模型
        } else {
          this.destroy3DModel();
        }
        // 内存最大模型数量
        // const modelLimit = 10;
        // let excessNum = modelNumTotal - modelLimit;
        // if (excessNum >= 0) {
        //   for (let i = 0; i < threeDApp.length; i++) {
        //     const app = threeDApp[i];
        //     excessNum -= app.modelNum;
        //     let drawApp = app.drawApp;
        //     drawApp.destroy();
        //     drawApp = null;
        //     threeDApp.splice(i, 1);
        //     i--;
        //     if (excessNum <= 0) break;
        //   }
        // }
        const drawApp = new composeDetail3D({
          baseWidth: baseWidth,
          canvasSize,
          modelOptions,
          faceListMap,
          canvas: null,
          container: null,
          partIds: this.partCheckedList,
          type: 5,
          callBack(src) {
            resolve(src);
          },
        });
        DesignerGlobals.threeDApp.push({ code, drawApp, modelNum });
      }
    });
  }

  setthreeDApp(arr) {
    DesignerGlobals.threeDApp = arr
  }
}

export default RenderImg