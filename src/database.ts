/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>

class Database {
  queue: JobQueue;

  constructor(private storage: DbStorage, private masterRoot: string) {
    this.queue = new JobQueue();
  } 
}
