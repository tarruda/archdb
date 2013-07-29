/// <reference path="./msgpack.ts"/>
/// <reference path="../../util.ts"/>
/// <reference path="../../private_api.ts"/>
/// <reference path="../../open.ts"/>
/// <reference path="../../custom_errors.ts"/>
/// <reference path="../../declarations/node.d.ts"/>

import fs = require('fs');
import path = require('path');

var BLOCK_SIZE = 4096;

class FsStorage implements DbStorage {
  tmpId: number;
  kvDir: string;
  dataWrites: JobQueue;
  nodeWrites: JobQueue;
  nodeOffset: number;
  dataOffset: number;
  nodeFd: number;
  dataFd: number;

  constructor(options: any) {
    var kvDir, dataDir, nodeFile, dataFile;
    var dirPath = path.resolve(options.path);

    // do we need to run the asynchronous versions of these fs
    // operations in the constructor?
    kvDir = path.join(dirPath, 'kv');
    dataDir = path.join(dirPath, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
    if (!fs.existsSync(kvDir)) fs.mkdirSync(kvDir);
    nodeFile = path.join(dataDir, 'node');
    dataFile = path.join(dataDir, 'objects');
    this.nodeFd = fs.openSync(nodeFile, 'a+');
    this.dataFd = fs.openSync(dataFile, 'a+');
    this.nodeOffset = fs.fstatSync(this.nodeFd).size;
    this.dataOffset = fs.fstatSync(this.dataFd).size;
    this.kvDir = kvDir;
    this.nodeWrites = new JobQueue();
    this.dataWrites = new JobQueue();
    this.tmpId = 0;
  }

  get(key: string, cb: ObjectCb) {
    var readCb = (err: Error, buffer: NodeBuffer) => {
      if (err) return cb(err, null);
      cb(null, msgpack.decode(buffer, null, cb));
    };
    var fullPath;

    fullPath = path.join(this.kvDir, key);
    fs.readFile(fullPath, readCb);
  }

  set(key: string, obj: any, cb: DoneCb) {
    var writeCb = (err: Error) => {
      if (err) return cb(err);
      fs.rename(tmpPath, fullPath, cb);
    };
    var fullPath = path.join(this.kvDir, key);
    var tmpFile = new Date().getTime().toString() + this.tmpId++;
    var tmpPath = path.join(this.kvDir, tmpFile);

    fs.writeFile(tmpPath, msgpack.encode(obj), null, writeCb);
  }

  saveIndexNode(obj: any, cb: RefCb) {
    this.saveFd(this.nodeFd, this.nodeOffset, this.nodeWrites, obj, cb);
  }

  getIndexNode(ref: ObjectRef, cb: ObjectCb) {
    this.getFd(this.nodeFd, ref, cb);
  }

  saveIndexData(obj: any, cb: RefCb) {
    this.saveFd(this.dataFd, this.dataOffset, this.dataWrites, obj, cb);
  }

  getIndexData(ref: ObjectRef, cb: ObjectCb) {
    this.getFd(this.dataFd, ref, cb);
  }

  private saveFd(fd: number, pos: number, queue: JobQueue, obj: any,
      cb: RefCb) {
    var job = (appendCb) => {
      fs.write(fd, buffer, 0, buffer.length, null, appendCb);
    };
    var appendCb = (err: Error, written: number) => {
      if (err) return cb(err, null);
      if (fd === this.nodeFd) this.nodeOffset += written;
      else this.dataOffset += written;
      cb(null, new ObjectRef(pos));
    };
    var buffer;

    buffer = msgpack.encode(obj);
    queue.add(appendCb, job);
  }

  private getFd(fd: number, ref: ObjectRef, cb: ObjectCb) {
    var readMore = (count: number, cb: msgpack.ReadMoreCb) => {
      moreCb = cb;
      count = Math.max(count, BLOCK_SIZE);
      buffer = new Buffer(count);
      fs.read(fd, buffer, 0, count, pos, readMoreCb);
    };
    var readMoreCb = (err: Error, bytesRead: number) => {
      if (err) return moreCb(err, null);
      pos += bytesRead;
      moreCb(null, buffer);
    };
    var readCb = (err: Error, bytesRead: number) => {
      if (err) return cb(err, null);
      pos += bytesRead;
      msgpack.decode(buffer, readMore, cb);
    };
    var buffer, pos, moreCb;
  
    pos = ref.valueOf();
    buffer = new Buffer(BLOCK_SIZE);
    fs.read(fd, buffer, 0, BLOCK_SIZE, pos, readCb);
  }
}

registerBackend('fs', FsStorage);
