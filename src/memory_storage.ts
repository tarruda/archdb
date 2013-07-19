/// <reference path="./components.ts"/>

class MemoryStorage implements DbStorage {
  uid: number;
  masterRef: string;
  data: Object;

  constructor() {
    this.uid = 1;
    this.masterRef = null;
    this.data = {};
  }

  get(ref: string, cb: ObjectCb) {
    cb(null, this.data[ref]);
  }

  save(obj: DbObject, cb: RefCb) {
    var ref: string = (this.uid++).toString();
    if (obj.normalize) this.data[ref] = obj.normalize();
    else this.data[ref] = obj;
    cb(null, ref);
  }

  getMasterRef(cb: RefCb) {
    cb(null, this.masterRef);
  }

  setMasterRef(ref: string, cb: DoneCb) {
    this.masterRef = ref;
    cb(null);
  }
}
