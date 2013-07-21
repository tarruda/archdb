interface DoneCb { (err: Error); }

interface RowCb { (record: Row); }

interface RowErrCb { (err: Error, record: Row); }

interface RowArrayCb { (err: Error, array: Array<Row>); }

interface ObjectCb { (err: Error, obj: any); }

interface RevisionCb { (err: Error, rev: Revision); }

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
  each(eachCb: RowCb, cb: DoneCb);
  all(cb: RowArrayCb);
  one(cb: RowErrCb);
  pause();
  resume();
  close();
}

class Row {
  constructor(public key: any, public value: any, public ref: ObjectRef) { }
}

class ObjectRef {
  constructor(public ref: string) { }
}
