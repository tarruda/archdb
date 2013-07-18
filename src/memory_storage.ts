/// <reference path="./components.ts"/>

class MemoryStorage implements DbStorage {
  uid: number;
  rootId: string;
  data: Object;

  constructor() {
    this.uid = 1;
    this.rootId = null;
    this.data = {};
  }

  get(id: string, cb: ObjectCb) {
    cb(null, this.data[id]);
  }

  save(obj: DbObject, cb: IdCb) {
    var id: string = (this.uid++).toString();
    if (obj.normalize) this.data[id] = obj.normalize();
    else this.data[id] = obj;
    cb(null, id);
  }

  getRootId(cb: IdCb) {
    cb(null, this.rootId);
  }

  setRootId(id: string, cb: DoneCb) {
    this.rootId = id;
    cb(null);
  }
}
