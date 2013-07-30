/// <reference path="./private_api.ts"/>
/// <reference path="./util.ts"/>
/// <reference path="./open.ts"/>

class MemoryStorage implements DbStorage {
  uid: number;
  kv: any;
  indexData: any;
  indexNode: any;

  constructor() {
    this.uid = 1;
    this.kv = {};
    this.indexData = {};
    this.indexNode = {};
  }

  get(key: string, cb: ObjectCb) {
    cb(null, denormalize(this.kv[key]));
  }

  set(key: string, obj: any, cb: DoneCb) {
    this.kv[key] = normalize(obj);
    cb(null);
  }

  saveIndexNode(obj: any, cb: RefCb) {
    this.save(this.indexNode, obj, cb);
  }

  getIndexNode(ref: ObjectRef, cb: ObjectCb) {
    cb(null, denormalize(this.indexNode[ref.valueOf()]));
  }

  saveIndexData(obj: any, cb: RefCb) {
    this.save(this.indexData, obj, cb);
  }

  getIndexData(ref: ObjectRef, cb: ObjectCb) {
    cb(null, denormalize(this.indexData[ref.valueOf()]));
  }

  flush(cb: DoneCb) { cb(null); }

  private save(hash: any, obj: any, cb: RefCb) {
    var ref = new ObjectRef(this.uid++);

    hash[ref.valueOf()] = normalize(obj);
    cb(null, ref);
  }
}

registerBackend('memory', MemoryStorage);
