// @ts-ignore
import deleteBtn from '../assets/image/btn-delete.png'
// @ts-ignore
import rotateBtn from '../assets/image/btn-rotate.png'
// @ts-ignore
import lockBtn from '../assets/image/btn-lock.png'
export default {
  canvas: {
    width: 300,
    height: 300,
    x: 0,
    y: 0,
    animation: true, //切换面是否开启动画
  },
  controler: {
    // konva提供的配置项
    borderStroke: '#6CD0FF',
    borderStrokeWidth: 2,
    anchorStroke: '#ADB8BF',
    anchorSize: 12,
    anchorCornerRadius: 12,
    rotateEnabled: true,
    rotateAnchorOffset: 10,
    ignoreStroke: true,
    keepRatio: true,
    centeredScaling: true,
    enabledAnchors: [
      'top-left',
      // 'top-center',
      'top-right',
      // 'middle-right',
      // 'middle-left',
      'bottom-left',
      // 'bottom-center',
      'bottom-right',
    ],
    // 自定义配置项
    // 旋转位置，默认right, [top, bottom, left, right, top-left, top-right, bottom-left, bottom-right]
    // rotateAnchorPosition: 'right',
    // 旋转按钮大小，默认24
    // rotateAnchorSize: 24,
    // 旋转按钮大小圆角大小，默认12
    // rotateCornerRadius: 12,
    'top-left': {
      name: 'delete',
      icon: deleteBtn,
      size: 24,
    },
    'top-right': {
      name: 'edit',
      icon: lockBtn,
      size: 24,
    },
    'bottom-left': {
      name: 'transform',
      icon: '',
    },
    'bottom-right': {
      name: 'transform',
      icon: '',
    },
    left: {
      name: 'transform',
      icon: '',
    },
    top: {
      name: 'transform',
      icon: '',
    },
    bottom: {
      name: 'transform',
      icon: '',
    },
    right: {
      name: 'rotate',
      icon: rotateBtn,
      size: 24,
      offset: 10,
    },
  },
  default: {
    isShowAuxiliaryLine: true, // 是否显示设计辅助线
    isShowSafeLine: true, // 是否显示全幅安全线
    isShowBaseMap: true, // 是否显示底图
    isShowTexture: true, // 是否显示肌理图
    printArea: { // 印刷区域
      stroke: '#14C9C9', 
      strokeWidth: 3
    },
    color: '', // 默认颜色
    view: '', // 默认面
    nodeSnap: {
      enable: true, // 是否启用元素吸附
      offset: 10, // 元素吸附临界值
    },
    history: {
      enable: true, // 是否启用历史记录
      max: 20, // 最大支持记录步数
      isCustom: false, // 历史记录是否由用户自定义, 默认使用指纹自带记录的规则
    },
    // 模糊提示
    vagueTips: {
      enable: true,
    },
    // 变形提示
    transformTips: {
      enable: true,
    },
    // 未铺满提示
    overspreadTips: {
      enable: true,
      canvasEnable: true, // 是否在画布上创建未铺满区域
    },
  },
};
