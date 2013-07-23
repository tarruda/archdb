/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>
/// <reference path="./local_revision.ts"/>

class LocalDatabase implements Database {
  storage: DbStorage;
  masterRef: string;
  queue: JobQueue;
  uidGenerator: UidGenerator;
  sequences: any;
  updatedSequences: any;

  constructor(storage: DbStorage) {
    var sequencesJob = (cb) => {
      this.storage.get(DbObjectType.Other, 'sequences', cb);
    };
    var sequencesCb = (err: Error, sequences: any) => {
      this.sequences = sequences;
    };
    var masterRefJob = (cb) => {
      this.storage.get(DbObjectType.Other, 'masterRef', cb);
    };
    var masterRefCb = (err: Error, masterRef: string) => {
      this.masterRef = masterRef;
    };

    this.storage = storage;
    this.masterRef = masterRef;
    this.queue = new JobQueue();
    this.uidGenerator = new UidGenerator();
    this.updatedSequences = {};
    this.sequences = null;

    this.queue.add(sequencesCb, sequencesJob);
    this.queue.add(masterRefCb, masterRefJob);
  }

  begin(cb: TransactionCb) {
    var suffix = this.uidGenerator.generate().hex.slice(0, 7);
    cb(null, new LocalRevision(this, this.storage, this.masterRef, suffix));
  }
}

