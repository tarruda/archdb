class MemoryStorage implements DbStorage {
  uid: number;
  rootId: string;
  data: Object;

  constructor() {
    this.uid = 1;
    this.rootId = null;
    this.data = {};
  }

  get(id: string, cb: DbObjectCallback) {
    cb(null, this.data[id]);
  }

  save(obj: DbObject, cb: IdCallback) {
    var id: string = (this.uid++).toString();
    this.data[id] = obj;
    cb(null, id);
  }

  getRootId(cb: IdCallback) {
    cb(null, this.rootId);
  }

  setRootId(id: string, cb: DoneCallback) {
    this.rootId = id;
    cb(null);
  }
}
