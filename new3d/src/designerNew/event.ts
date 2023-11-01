import {Designer} from "./types";

interface DesignerEvent extends Designer {}

// @ts-ignore
class DesignerEvent {

  on(type, cb) {
    if (!this.events[type]) {
      this.events[type] = [];
    }
    this.events[type].push(cb);
  }
  emit(type, args?) {
    const cbs = this.events[type];
    if (cbs) {
      cbs.forEach((cb) => {
        cb(args);
      });
    }
  }
}

export default DesignerEvent