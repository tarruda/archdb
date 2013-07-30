/// <reference path="../../util.ts"/>
/// <reference path="../../private_api.ts"/>
/// <reference path="../../open.ts"/>

class DomStorage implements DbStorage {
  uid: number;
  prefix: string;

  constructor(options: any) {
    this.uid = this.getItem('u', 'uid') || 0;
    this.prefix = options.prefix || '';
  }

  get(key: string, cb: ObjectCb) {
    cb(null, this.getItem('k', key));
  }

  set(key: string, obj: any, cb: DoneCb) {
    this.setItem('k', key, obj);
    cb(null);
  }

  saveIndexNode(obj: any, cb: RefCb) {
    this.save('n', obj, cb);
  }

  getIndexNode(ref: ObjectRef, cb: ObjectCb) {
    cb(null, this.getItem('n', ref.valueOf()));
  }

  saveIndexData(obj: any, cb: RefCb) {
    this.save('d', obj, cb);
  }

  getIndexData(ref: ObjectRef, cb: ObjectCb) {
    cb(null, this.getItem('d', ref.valueOf()));
  }

  flush(cb: DoneCb) { cb(null); }

  close(cb: DoneCb) { cb(null); }

  private save(ns: string, value: any, cb: RefCb) {
    var ref = new ObjectRef(++this.uid);

    this.setItem(ns, ref.valueOf(), value);
    cb(null, ref);
  }

  private getItem(ns: string, key: string) {
    var str = localStorage.getItem(this.prefix + key);
    if (!str) return null;
    return denormalize(JSON.parse(str));
  }

  private setItem(ns: string, key: string, value: any) {
    localStorage.setItem(this.prefix + key, JSON.stringify(normalize(value)));
  }
}

registerBackend('dom', DomStorage);
