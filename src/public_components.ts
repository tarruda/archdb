/// <reference path="./components.ts"/>

interface RevisionCb { (err: Error, rev: Revision); }

interface KvCb { (key: any, value: any); }

interface Database {
  checkout(cb: RevisionCb);
}

interface Revision {
}

interface Index {
  set(key: any, value: any, cb: ObjectCb);
  del(key: any, cb: ObjectCb);
  find(query: any): Cursor;

}

interface Cursor {
  each(eachCb: KvCb, cb: DoneCb);
}
