/// <reference path="../../util.ts"/>
/// <reference path="../../private_api.ts"/>
/// <reference path="../../open.ts"/>

class DomStorage implements DbStorage {
  _uid: number;

  constructor() {
    this._uid = this.getItem('uid') || 0;
  }

  get(type: DbObjectType, ref: string, cb: ObjectCb) {
    cb(null, this.getItem(ref));
  }

  set(type: DbObjectType, ref: string, obj: any, cb: DoneCb) {
    this.setItem(ref, obj);
    cb(null);
  }

  del(type: DbObjectType, ref: string, cb: ObjectCb) {
    throw new Error('not implemented');
  }

  save(type: DbObjectType, obj: any, cb: RefCb) {
    var setCb = () => cb(null, ref);
    var ref = this.uid().toString();

    this.set(type, ref, obj, setCb);
  }

  private uid(): number {
    var rv = ++this._uid;
    this.setItem('uid', rv);
    return rv;
  }

  private getItem(key: string) {
    var str = localStorage.getItem(key);
    if (!str) return null;
    return denormalize(JSON.parse(str));
  }

  private setItem(key: string, value: any) {
    localStorage.setItem(key, JSON.stringify(normalize(value)));
  }
}

registerBackend('dom', DomStorage);
