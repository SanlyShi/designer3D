import Color from '../utils/color';
// @ts-ignore
import Konva from './dependence/konva7.2.1'
import { View } from './types';
export const overallDesignView: View = {
  // en_name: "整体设计",
  // width: 700, //java接口去除，保持统一性去除
  // height: 700,
  id: 9999,
  name: "整体设计",
  point_svg: "",
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
export const formateColor = ({ color }) => {
  if (!color || color == 'transparent') {
    return {
      value: '',
      alpha: '',
      color: '',
    };
  } else {
    const formateColor = new Color({
      enableAlpha: false,
      format: 'hex',
    });
    formateColor.fromString(color);
    return {
      value: formateColor.value,
      alpha: formateColor._alpha / 100,
      color: color,
    };
  }
};

export const calcTwoTransform = (transform, rad) => {
  let rotationTran = new Konva.Transform();
  rotationTran.rotate(rad);
  let invertTran = rotationTran.copy().invert();
  let mulTransform = invertTran.multiply(transform);
  return {
    gTransform: `matrix(${rotationTran.m[0]}, ${rotationTran.m[1]}, ${rotationTran.m[2]}, ${rotationTran.m[3]}, ${rotationTran.m[4]}, ${rotationTran.m[5]})`,
    transform: `matrix(${mulTransform.m[0]}, ${mulTransform.m[1]}, ${mulTransform.m[2]}, ${mulTransform.m[3]}, ${mulTransform.m[4]}, ${mulTransform.m[5]})`,
  };
};

export function transModelData(data) {
  const model = {};
  
  data?.map((d) => {
    let sigleObj = {};
    d.model_data.uv_list.forEach((u) => {
      u['faceList'] = u.face_list;
    });
    sigleObj = Object.assign(
      {},
      {
        detail3d: Object.assign(
          {},
          {
            model_id: d.model_id,
            parts: d.model_parts,
          }
        ),
        modelData: Object.assign(
          {},
          {
            baseFiles: d.model_data.base_files,
            enable_hdr: d.model_data.enable_hdr,
            position: d.model_data.position,
            renderParams: d.model_data.render_params,
            uvList: d.model_data.uv_list,
          }
        ),
        colorsData: {},
      }
    );
    d.colors_data.map((c) => {
      const obj = Object.assign(
        {},
        {
          id: c.id,
          data: Object.assign(
            {},
            {
              designColorCode: c.design_color_code,
              designColorType: c.design_color_type,
              designColorUrl: c.design_color_url,
              textureMap: c.texture_map,
            }
          ),
        }
      );
      sigleObj['colorsData'][c.id] = obj;
    });
    if (d.color_id) {
      model[d.color_id] = sigleObj;
    } else {
      model['default'] = sigleObj;
    }
  });
  return model;
}
export function transPartSpuData(data) {
  const spuData = {};
  spuData['spu_details'] = data.spu_parts;
  spuData['pack_list'] = data.brand_pack_list?.map((b) => {
    const obj = Object.assign(
      {},
      {
        id: b.attr_id,
        img: b.img_url,
        is_default: b.is_default,
        name: b.name,
        price: b.price,
      }
    );
    return obj;
  });
  spuData['custom_logo_list'] = data.custom_logo_list?.map((b) => {
    const obj = Object.assign(
      {},
      {
        id: b.attr_id,
        code: b.code,
        image_url: b.image_url,
        name: b.name,
        price: b.price,
      }
    );
    return obj;
  });
  return Object.assign(spuData, { show_custom_logo_icon: data.show_custom_logo_icon });
}

export function transActiveColorSize(data) {
  const czObj = {};
  data.forEach((item) => {
    czObj[item.color] = item.sizes;
  });
  return czObj;
}

export function transViews(data) {
  return data.map((a) => {
    a.print_area = a.print_area || {};
    a.pointout_print_areas = a.pointout_print_areas || {};
    return a;
  });
}

export function transView(viewData) {
  if (viewData.printArea && !viewData.print_area) {
    viewData.print_area = viewData.printArea;
    viewData.print_area.view_width = viewData.printArea.viewWidth;
  }
  if (viewData.pointoutPrintAreas && !viewData.pointout_print_areas) {
    viewData.pointout_print_areas = viewData.pointoutPrintAreas;
  }
  if (viewData.printAreaImage && !viewData.print_area_image) {
    viewData.print_area_image = viewData.printAreaImage;
  }
  return viewData;
}

export function convert3dData(modelOptions) {
  return modelOptions.map((modelOption) => {
    if (!modelOption.detail_3d) {
      return modelOption;
    }
    return {
      ...modelOption,
      detail3D: {
        ...modelOption.detail_3d,
        baseFiles: modelOption.detail_3d.zipfiles,
        renderParams: modelOption.detail_3d.render_params,
        uvList: modelOption.detail_3d.uv_list.map((uv) => ({
          ...uv,
          customBase: {
            designColorCode: uv.design_color_custom_base.design_color_code,
            designColorType: uv.design_color_custom_base.design_color_type,
            designColorUrl: uv.design_color_custom_base.design_color_url,
          },
          faceList: uv.face_list,
        })),
        textureMap: modelOption.detail_3d.texture_map,
      },
      distortParams: modelOption.distort_params,
    };
  });
}

export const convertProductData = (data) => {
  data.active_color_size = transActiveColorSize(data.active_color_size);
  data.views = transViews(data.views);
  data.colors = data.colors.map((color) => {
    return {
      ...color,
      detail: color.detail.map((de) => {
        if (de.is_user_defined == 1) {
          de.detail = de.detail.map((_de) => {
            if (_de.type == 5) {
              //布局
              _de.layoutData = _de.layout_data;
            } else if (_de.type == 1 || _de.type == 2) {
              //底板, 1: 底板图  2：底板模型
              _de.layoutId = _de.layout_id;
              if (_de.parts && _de.parts[0].type == 2) {
                _de.parts = convert3dData(_de.parts);
              }
            } else if (_de.type == 3) {
              //文字
              _de.strokeValue = _de.stroke_value;
              _de.strokeWidth = _de.stroke_width;
            } else if (_de.type == 4) {
              //背景色
              _de.bgColor = _de.bg_color;
            } else if (_de.type == 6) {
              //图片
              _de.layoutId = _de.layout_id;
            }
            return _de;
          });
          return de;
        } else if (de.parts && de.parts[0].type == 2) {
          return {
            ...de,
            parts: convert3dData(de.parts),
          };
        } else {
          return de;
        }
      }),
    };
  });
  data.show_3d_model = transModelData(data.show_3d_model);
  data.pack_list = data.pack_list?.map((b) => {
    const obj = Object.assign(
      {},
      {
        id: b.attr_id,
        img: b.img_url,
        is_default: b.is_default,
        name: b.name,
        price: b.price,
      }
    );
    return obj;
  });
  data.custom_logo_list = data.custom_logo_list?.map((b) => {
    const obj = Object.assign(
      {},
      {
        id: b.attr_id,
        code: b.code,
        image_url: b.image_url,
        name: b.name,
        price: b.price,
      }
    );
    return obj;
  });
  data.hasDetail = data.colors.findIndex(i => i.detail?.length) != -1
  return data;
};

export const convertColorDetailMajorImageData = (data, colorId) => {
  data.colorDetailMajorImage = data.colorDetailMajorImage.map((color) => {
    return {
      ...color,
      detail: color.detail.map((de) => {
        if (de.is_user_defined == 1) {
          de.detail = de.detail.map((_de) => {
            if (_de.type == 5) {
              //布局
              _de.layoutData = _de.layout_data;
            } else if (_de.type == 1 || _de.type == 2) {
              //底板, 1: 底板图  2：底板模型
              _de.layoutId = _de.layout_id;
              if (_de.parts && _de.parts[0].type == 2) {
                _de.parts = convert3dData(_de.parts);
              }
            } else if (_de.type == 3) {
              //文字
              _de.strokeValue = _de.stroke_value;
              _de.strokeWidth = _de.stroke_width;
            } else if (_de.type == 4) {
              //背景色
              _de.bgColor = _de.bg_color;
            } else if (_de.type == 6) {
              //图片
              _de.layoutId = _de.layout_id;
            }
            return _de;
          });
          return de;
        } else if (de.parts && de.parts[0].type == 2) {
          return {
            ...de,
            parts: convert3dData(de.parts),
          };
        } else {
          return de;
        }
      }),
    };
  });
  // 小程序工单图是在保存的时候细节图取完了才取，保存完已经不在设计器页面了，所以这里转换productData数据没有影响
  data.hasDetail = data.colorDetailMajorImage.findIndex(i => i.id == colorId && i.detail?.length) != -1
}

export const imgToFormData = (item) => {
  var base64String = item.src;
  //这里对base64串进行操作，去掉url头，并转换为byte
  var bytes = window.atob(base64String.split(',')[1]);
  var array = [];
  for(var i = 0; i < bytes.length; i++){
    array.push(bytes.charCodeAt(i));
  }
  var blob = new Blob([new Uint8Array(array)], {type: 'image/png'});
  var fd = new FormData();
  fd.append('file', blob, Date.now() + '.png');
  return fd
}

export const radiusRect = (left, top, width, height, r, ctx) => {
  const pi = Math.PI;
  ctx.beginPath();
  ctx.arc(left + r, top + r, r, -pi, -pi / 2);
  ctx.arc(left + width - r, top + r, r, -pi / 2, 0);
  ctx.arc(left + width - r, top + height - r, r, 0, pi / 2);
  ctx.arc(left + r, top + height - r, r, pi / 2, pi);
  ctx.closePath();
}

export function loadImgs(
  urls: Array<string> = [],
  crossOrigin?: string
): Promise<Array<HTMLImageElement | null>> {
  const loadImg = (url: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      if (!url) resolve(null);
      const image = new Image();
      image.src = url;
      image.setAttribute('crossOrigin', crossOrigin || 'anonymous');
      image.onload = () => {
        resolve(image);
      };
      image.onerror = () => {
        resolve(null);
      };
    });
  };
  const promises = urls.map((url: string): Promise<HTMLImageElement | null> => loadImg(url));
  return Promise.all(promises);
}

export const imageCompression = async (src, maxWidth) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const [newImage]: Array<any> = await loadImgs([src]);
  if(newImage.width > maxWidth) {
    canvas.width = maxWidth
    canvas.height = maxWidth / (newImage.width / newImage.height)
    ctx.drawImage(newImage, 0,0,canvas.width, canvas.height)
    return {
      src: canvas.toDataURL(),
      originImage: newImage
    }
  } else {
    return {
      src,
      originImage: newImage
    }
  }
}