/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>

class LocalDatabase implements Database {
  queue: JobQueue;
  uidGenerator: UidGenerator;

  constructor(private storage: DbStorage, private masterRef: string) {
    this.queue = new JobQueue();
    this.uidGenerator = new UidGenerator();
  }

  checkout(cb: RevisionCb) {
  
  }
}

