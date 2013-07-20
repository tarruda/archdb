/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>
/// <reference path="./local_revision.ts"/>

class LocalDatabase implements Database {
  storage: DbStorage;
  masterRef: string;
  queue: JobQueue;
  uidGenerator: UidGenerator;

  constructor(storage: DbStorage, masterRef: string) {
    this.storage = storage;
    this.masterRef = masterRef;
    this.queue = new JobQueue();
    this.uidGenerator = new UidGenerator();
  }

  checkout(cb: RevisionCb) {
    var suffix = this.uidGenerator.generate().hex.slice(0, 7);
    return new LocalRevision(this, this.masterRef, suffix);
  }
}

