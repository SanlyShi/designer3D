export interface ProductData {
  colors?,
  views?,
  spu_details?,
  [key: string]: any;
}

export interface CanvasConfig {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  animation: boolean, //切换面是否开启动画
}

export interface View {
  id: number;
  name?: string;
  print_area: {
    id?: string | number;
    view_width: number;
    width: number;
    height: number;
    offset_x: number;
    offset_y: number;
    soft_svg: string;
  };
  print_area_image?: string;
  point_svg?: string;
  pointout_print_areas?: any;
}

type ClipAttr = {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
  originImg: string;
  xFlip?: boolean;
  yFlip?: boolean;
};

export interface ClipData {
  clipPath: {
    code: string | number;
    image: string;
  };
  imgAttrs: ClipAttr;
  pathAttrs: ClipAttr;
}

export interface Percent {
  left: number;
  top: number;
}

export interface PictureException {
  text?: string;
  type?: number;
  title?: string;
  desc?: string;
  bgColor?: string
}

export interface SaveData {
  dpi?: number;
  image?: any;
  text?: any;
  color?: any;
  konvaAttrs: any;
  print_area_id: string;
  type: string;
  view_id: number;
  id?: number;
  nodeId?: number;
}

export interface HistoryListMap {
  [key: number]: Array<any>;
}

export interface FontObj {
  hasNormalFontType: string;
  hasBoldFontType: string;
  hasItalicFontType: string;
  hasBoldAndItalicFontType: string;
  id: number;
  label: string;
  value: string;
  src: string;
  weight: string;
  style: string;
}

export interface ArrIndex {
  [key: number]: number 
}
export interface DetailImgObj {
  image: string;
  maskImg: string;
  canvasArr: Array<string>;
  index: number;
  position?: number,
  colorId: number;
  master?: number;
  isUserDefined?: number;
  boardImg?: string;
  baseWidth?: number;
  boardObj?: any;
  error?: number; //1：没有工单图
}
export interface CanvasImgs {
  id: number;
  name?: string;
  viewDesign?: string;
  viewDesignCanvas?: Element;
}
export interface PartCheckedObj {
  partId: number;
  childPartId: number;
  colorId: number;
  sizeId: number;
}

export type TemplateData = {
  cfg?,
  views?,
}

export type DataProcessorType = {
  getProductData,
  getTemplateData?
}

export enum ProgramType {
  MINI_PROGRAM = 'MINI_PROGRAM',
  SIMPLE = 'SIMPLE',
  PROFESSIONAL = 'PROFESSIONAL'
}

export interface Controller {
  transformer
  anchorGroup

  controllerConfig
  initTransformer
  hideController
  addController
  anchorGroupForceUpdate
}

export interface DesignerEvent {
  events
}

export interface Helper {
  checkOverSpread
  convertDefaultConfig
  addDesignLayerCont
  dataProcessor
  reCombinKonvaJson
  getCanvasImage
  imgSizeCalculate
  updateDesignsInfo
  getProductViewImgUrl
  diffViewTheSameDesign
}

export interface Snap {
  nodeSnapping
  removeSnapGuideLine
}

export interface History {
  addHistoryBySystem
  addHistoryByUser
  historyListMap
  historyStepMap
  historyFreeze
}

export interface DataTransformer {
  getProductConfiguration
  calcDesignArea
  getDesignsInfo
}

export interface Crub {
  addElement
  unselectAll
  selectNode
  addImage
  addText
  setNodeText
  changeNodeDisplayOnCanvas
}

export interface Clip {
  getClipImage
  getFlipPath
  getClipPercent
  updateClipData
  implementClip
}

export interface Flip {
  flip
  flipImage
  flipText
}

export interface Level {
  changeLevel
  updateLevelInfo
  baseMoveToTop
}

export interface Tile {
  drawRepeatType
}

export interface Maximize {
  imgMaximization
}

export interface Filter{
  changeImageFilter
  replaceFilter
}

export interface Replace {
  replaceImage
  updateImage
}

export interface RenderImg {
  getPartCheckedList
  partCheckedList
  indexList
}

export interface Template {
  addTemplate
}

export interface GetCanvasInfo {
  levelInfo
  getLineGuideStops
  getSnappingGuides
  getNodeSnappingEdges
  getRotateNodePoint
  getKonvaCanvasOrImage
}

export interface Designer extends
  Controller,
  DesignerEvent,
  Helper,
  Snap,
  Crub,
  RenderImg,
  Template,
  GetCanvasInfo,
  DataTransformer,
  History,
  Clip,
  Flip,
  Level,
  Tile,
  Maximize,
  Filter,
  Replace
{
  emit
  on

  defaultSetting

  getCurStageLayer

  curNode
  viewId
  stageObj
  options
  productData
  templateCode
  templateData
  colorId
  konvaJson
  viewImgArr
  canvasSize
  layerToImageOrCanvas
  cacheProductPrintAreas
  designsInfoMap
  emptyDesign
  addBgColor
  changeView

  isDestroy
  changeNodeList
}

