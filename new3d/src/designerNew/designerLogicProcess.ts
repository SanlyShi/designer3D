import {
  View,
  PictureException,
  ProgramType,
  ProductData,
  DataProcessorType,
  TemplateData,
  FontObj
} from './types';
let startLoadFont = false;
let fontList: Array<FontObj> = [];
const overallDesignView = {
  en_name: "整体设计",
  // width: 700, //java接口去除，保持统一性去除
  // height: 700,
  id: 9999,
  name: "整体设计",
  pointSvg: "",
  pointout_print_areas: [],
  print_area_image: "",
  print_area: {
    // viewWidth: 700,
    view_width: 700,
    width: 700,
    height: 700,
    id: 9999,
    offset_x: 0,
    offset_y: 0,
    soft_svg: "",
  },
};

class DataProcessor {
  protected requestMethod
  protected publicPath
  protected env
  constructor(requestMethod, env) {
    this.requestMethod = requestMethod
    this.env = env

    const publicPathMap = {
      // development: '/merchant-gw',
    }
    this.publicPath = publicPathMap[env] || ''
  }

  async getProductData(code): Promise<ProductData> {
    const {requestMethod, publicPath} = this
    const [baseInfo, viewsInfo, colorsInfo, modelInfo, partPackInfo] = await Promise.all([
      requestMethod.get({url: `${publicPath}/pty-itg/v1/${code}`}),
      requestMethod.get({url: `${publicPath}/pty-itg/v1/views/${code}`}),
      requestMethod.get({url: `${publicPath}/pty-itg/v1/color_detail_effect_image_setting/${code}`}),
      requestMethod.get({url: `${publicPath}/pty-itg/v1/3d/models/${code}?is_custom=1`}),
      requestMethod.get({url: `${publicPath}/pty-itg/v1/parts/${code}?is_custom=1`}),
    ]);

    return Object.assign(baseInfo || {}, {
      active_color_size: baseInfo.active_color_size,
      defaultValues: baseInfo.default_values,
      hasDetail: colorsInfo.findIndex((i) => i.detail.length) != -1,
      imgFull: baseInfo.img_full,
      views: viewsInfo,
      colors: colorsInfo,
      show_3d_model: modelInfo,
      spu_details: partPackInfo.spu_parts,
      pack_list: partPackInfo.brand_pack_list,
      custom_logo_list: partPackInfo.custom_logo_list,
      show_custom_logo_icon: partPackInfo.show_custom_logo_icon,
    });
  }

  getFontList() {
    startLoadFont = true;

    const fontPublicPathMap = {
      development: 'http://test.zwdc.com',
      test: 'https://sandbox2.zhiwendiy.com',
      sandbox: 'https://sandbox2.zhiwendiy.com',
      pre: 'https://www.hicustom.com',
      production: 'https://www.hicustom.com',
    }
    const fontPublicPath = fontPublicPathMap[this.env] || ''

    return new Promise<void>((resolve) => {
      this.requestMethod.get({url: `${fontPublicPath}/v1/FontFamily?mediaType=json`}).then((res: any) => {
        const data: any = Object.values(res);
        const fontFamilyList: Array<FontObj> = [];
        for (const el of data) {
          const obj: FontObj = {
            hasNormalFontType: '',
            hasBoldFontType: '',
            hasItalicFontType: '',
            hasBoldAndItalicFontType: '',
            id: 0,
            label: '',
            value: '',
            src: '',
            weight: '',
            style: '',
          };
          const fontFamilieId = el.id;
          // let { id, fonts, lang, name, weight } = el;
          obj.id = fontFamilieId;
          obj.label = el.name;
          const font = el.fonts[0];
          const { id, name, style, ttf, weight, woff } = font;
          const fontName = name + '_' + fontFamilieId + '_' + id + '_' + font.name;
          if (style == 'normal' && weight == 'normal') {
            obj.hasNormalFontType = fontName;
          } else if (style == 'normal' && weight == 'bold') {
            obj.hasBoldFontType = fontName;
          } else if (style == 'italic' && weight == 'normal') {
            obj.hasItalicFontType = fontName;
          } else if (style == 'italic' && weight == 'bold') {
            obj.hasBoldAndItalicFontType = fontName;
          }
          let src = '';
          if (ttf && woff) {
            src = 'url("' + woff + '") format("woff"),' + 'url("' + ttf + '") format("truetype")';
          } else if (ttf && !woff) {
            src = 'url("' + ttf + '") format("truetype")';
          } else if (!ttf && woff) {
            src = 'url("' + woff + '") format("woff")';
          }
          obj.value = fontName;
          obj.src = src;
          obj.weight = weight;
          obj.style = style;
          fontFamilyList.push(obj);
        }
        fontList = fontFamilyList;
        resolve();
      });
    });
  }
}

// 小程序
class MiniProgramDataProcessor extends DataProcessor implements DataProcessorType {
  constructor(requestMethod, env) {
    super(requestMethod, env)
  }

  async getTemplateData(code): Promise<TemplateData> {
    const {requestMethod, publicPath} = this
    const data = await requestMethod.post({
      url: `${publicPath}/pgc-itg/v1/c/template/detail`,
      data: {codes: [code],show_config:true}
    })
    return data[0]
  }
}

// 简版设计器
class SimpleDataProcessor extends DataProcessor implements DataProcessorType {
  constructor(requestMethod, env) {
    super(requestMethod, env)
  }
}

function createDateProcessor({type, requestMethod, env}) {
  if (type === ProgramType.MINI_PROGRAM) {
    return new MiniProgramDataProcessor(requestMethod, env)
  } else if(type === ProgramType.SIMPLE){
    return new SimpleDataProcessor(requestMethod, env)
  }
}

function getViews(viewId: number, productData) {
  let views: View = {
    id: 0,
    print_area: {
      view_width: 0,
      width: 0,
      height: 0,
      offset_x: 0,
      offset_y: 0,
      soft_svg: '',
    },
  };
  for (let i = 0; i < productData.views.length; i++) {
    if (productData.views[i].id == viewId) {
      views = productData.views[i];
      break;
    }
  }

  return views;
}

function ClearBr({ str, type }) {
  switch (type) {
    case 1: //去除换行
      str = str.replace(/<\/?.+?>/g, '');
      str = str.replace(/[\r\n]/g, '');
      break;
    case 2: //去除空格
      str = str.replace(/\s+/g, '');
      break;
    default:
      str = str.replace(/<\/?.+?>/g, '');
      str = str.replace(/[\r\n]/g, '');
      str = str.replace(/\s+/g, '');
      break;
  }

  return str;
}

/**
 * image：图片
 * canvas：canvas
 * both：两者都要
 */
function needImageOrcanvas(productData): string {
  let needCanvas = false, need2dImg = false
  for (let colorItem of productData.colors) {
    if (colorItem.detail) {
      for (let det of colorItem.detail) {
        if(det.parts) {
          for (let part of det.parts) {
            if (part.type == 2) {
              //存在3d图
              needCanvas = true;
            }else if(part.type == 0) {
              //存在3d图
              need2dImg = true;
            }
          }
        }
      }
    }
  }
  if(need2dImg && needCanvas) {
    return 'both'
  } else  if(need2dImg) {
    return 'image'
  } else {
    return 'canvas'
  }
}

function loadFont(fontFamily, dataProcessor) {
  return new Promise<void>(async (resolve) => {
    await checkGetFontList(dataProcessor);
    const fontObj: FontObj = fontList.find((item) => item.value == fontFamily);
    if (document.fonts && !checkFont(fontObj.value)) {
      const fontFace = new FontFace(fontObj.value, fontObj.src, {
        weight: fontObj.weight,
        style: fontObj.style,
      });
      fontFace
        .load()
        .then(function (loadedFontFace) {
          document.fonts.add(loadedFontFace);
          if (loadedFontFace.family == fontObj.value) {
            resolve();
          }
        })
        .catch(() => {})
        .finally(() => {
          resolve();
        });
    } else {
      resolve();
    }
  });
}
function checkGetFontList(dataProcessor) {
  return new Promise<void>((resolve) => {
    if (!startLoadFont) {
      dataProcessor.getFontList()
    }
    if (!fontList.length) {
      const interval = setInterval(() => {
        if (fontList.length) {
          resolve();
          clearInterval(interval);
        }
      }, 100);
    } else {
      resolve();
    }
  });
}
function checkFont(name: string) {
  const values = document.fonts.values();
  let isHave = false;
  let item = values.next();
  while (!item.done && !isHave) {
    const fontFace = item.value;
    if (fontFace.family == name) {
      isHave = true;
    }
    item = values.next();
  }
  return isHave;
}
function imageOnload(src, ctx) {
  return new Promise((resolve) => {
    if (src != '') {
      const image = new Image();
      image.src = src;
      image.setAttribute('crossOrigin', 'anonymous');
      image.onload = function (e) {
        if (ctx) {
          ctx.drawImage(image, 0, 0, 600, 600);
        }
        resolve('');
      };
      image.onerror = function () {
        resolve('');
      };
    } else {
      resolve('');
    }
  });
}
function isRisk(data: object) {
  if(!data['risk_gallery']) return false;
  const highRiskIds = [1, 3, 4, 6]; //1涉政, 3涉黄, 4暴恐, 6不良场景
  const isHighRisk = data['risk_gallery'].risk.reduce((prev, cur) => {
    return prev || highRiskIds.includes(cur.id);
  }, false);
  return (data['risk_word'].length && data['risk_word'][0].level == 5) || isHighRisk;
}
function linkageDesign(product, stageObj, thisViewId, curNode, isLockOperation = false) {
  const isGroup = Array.isArray(curNode);
  let designArr = []
  if(isGroup) {
    [].forEach.call(curNode, item => {
      designArr = designArr.concat(_linkageDesign(product, stageObj, thisViewId, item, isLockOperation))
    });
  } else {
    designArr = _linkageDesign(product, stageObj, thisViewId, curNode, isLockOperation)
  }
  let designObj = {}
  for(let item of designArr) {
    if(!designObj[item.id]) {
      designObj[item.id] = []
    }
    designObj[item.id].push(item)
  }
  return designObj
}

function _linkageDesign(product, stageObj, thisViewId, curNode, isLockOperation) {
  let designArr = [];
  let productViews = JSON.parse(JSON.stringify(product.views));
  if (thisViewId == 9999) {
    productViews.unshift(overallDesignView);
  }
  productViews.forEach((item) => {
    const stage = stageObj[item.id];
    const layer = stage.findOne(".designLayer");
    let node = null;
    if (product.imgFull && product.bg_ind == -1 && curNode.hasName("isBg")) {  //全副产品是否支持独立背景设计 => bg_ind: 1：支持独立设计，-1：不支持
      //背景
      //模板会出现非全副模板用于全副产品，导致背景图不是所有面都有背景图
      if (layer.findOne(".isBg")) {
        if (isLockOperation || !layer.findOne(".isBg").isLock) {
          //isLockOperation：操作锁定 || 非锁定
          node = layer.findOne(".isBg");
        }
      }
    } else if (thisViewId == 9999) {
      //整体设计
      layer.find(".overallDesign").forEach((design) => {
        if (
          design.getAttrs().overallDesignId ==
          curNode.getAttrs().overallDesignId
        ) {
          if (isLockOperation || !design.isLock) {
            node = design;
          }
        }
      });
    } else if (item.id == thisViewId) {
      //当前面设计
      node = curNode;
    }
    if (
      thisViewId != 9999 &&
      !curNode.hasName("isBg") &&
      thisViewId == item.id
    ) {
      //非背景图的整体设计 移动单独面，取消联动性
      layer.find(".overallDesign").forEach((design) => {
        design.removeName("overallDesign");
        let attrs = design.getAttrs();
        delete attrs.overallDesignId;
        design.setAttrs(attrs);
      });
    }
    if (node) {
      designArr.push({ id: item.id, node, layer, stage, view: item });
    }
  });
  return designArr;
}

export {
  ClearBr,
  getViews,
  createDateProcessor,
  needImageOrcanvas,
  loadFont,
  imageOnload,
  isRisk,
  linkageDesign
};
