import Base from "./base"
import Controller from "./controller"
import DataTransformer from "./DataTransformer"
import DesignerEvent from './event'
import GetCanvasInfo from "./getCanvasInfo"
import Helper from './helper'
import Snap from "./snap"
import History from "./history"
import nodeCrub from "./nodeOperate/crub"
import Maximize from "./nodeOperate/maximize"
import Level from "./nodeOperate/level"
import Flip from "./nodeOperate/flip"
import Tile from "./nodeOperate/tile"
import Filter from "./nodeOperate/filter"
import Replace from "./nodeOperate/replace"
import Clip from "./nodeOperate/clip"
import RenderImg from "./RenderImg"
import Template from './template'

applyMixins(Base, [
  Controller,
  DataTransformer,
  DesignerEvent,
  GetCanvasInfo,
  Helper,
  Snap,
  History,
  nodeCrub,
  Maximize,
  Level,
  Flip,
  Tile,
  Filter,
  Replace,
  Clip,
  RenderImg,
  Template
]);

// This can live anywhere in your codebase:
function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
        Object.create(null)
      );
    });
  });
  Object.defineProperty(
    derivedCtor.prototype,
    'constructor',
    Base.prototype.constructor
  );
}

export default Base