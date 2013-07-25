/// <reference path="./private_api.ts"/>
/// <reference path="./util.ts"/>
/// <reference path="./open.ts"/>

class MemoryStorage implements DbStorage {
  uid: number;
  masterRef: string;
  data: Object;

  constructor() {
    this.uid = 1;
    this.masterRef = null;
    this.data = {};
    this.data[DbObjectType.Other] = {};
    this.data[DbObjectType.IndexNode] = {};
    this.data[DbObjectType.IndexData] = {};
  }

  get(type: DbObjectType, ref: string, cb: ObjectCb) {
    cb(null, denormalize(this.data[type][ref]));
  }

  set(type: DbObjectType, ref: string, obj: any, cb: DoneCb) {
    this.data[type][ref] = normalize(obj);
    cb(null);
  }

  del(type: DbObjectType, ref: string, cb: ObjectCb) {
    var rv = this.data[type][ref];

    delete this.data[type][ref];
    cb(null, rv);
  }

  save(type: DbObjectType, obj: any, cb: RefCb) {
    var setCb = () => cb(null, ref);
    var ref = (this.uid++).toString();

    this.set(type, ref, obj, setCb);
  }
}

registerBackend('memory', MemoryStorage);
