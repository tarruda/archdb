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
  uid: number;
  kvDir: string;
  writes: JobQueue;
  indexOffset: number;
  dataOffset: number;
  indexFd: number;
  dataFd: number;

  constructor(options: any) {
    var kvDir, dataDir, indexFile, dataFile;
    var dirPath = path.resolve(options.path);

    // do we need to run the asynchronous versions of these fs
    // operations in the constructor?
    kvDir = path.join(dirPath, 'kv');
    dataDir = path.join(dirPath, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
    if (!fs.existsSync(kvDir)) fs.mkdirSync(kvDir);
    indexFile = path.join(dataDir, 'index');
    dataFile = path.join(dataDir, 'objects');
    this.indexFd = fs.openSync(indexFile, 'a+');
    this.dataFd = fs.openSync(dataFile, 'a+');
    this.indexOffset = fs.fstatSync(this.indexFd).size;
    this.dataOffset = fs.fstatSync(this.dataFd).size;
    this.kvDir = kvDir;
    this.writes = new JobQueue();
    this.uid = 0;
  }

  get(type: DbObjectType, ref: string, cb: ObjectCb) {
    var readFileCb = (err: Error, buf: NodeBuffer) => {
      if (err) return cb(err, null);
      cb(null, new msgpack.Decoder().decode(buf));
    };
    var readCb = (err: Error) => {
      if (err) return cb(err, null);
      cb(null, new msgpack.Decoder().decode(buffer));
    };
    var pos, buffer, fd, fullPath;

    if (type === DbObjectType.Other) {
      fullPath = path.join(this.kvDir, ref);
      return fs.readFile(fullPath, readFileCb);
    }

    pos = parseInt(ref, 16);
    buffer = new Buffer(BLOCK_SIZE);
    fd = type === DbObjectType.IndexData ? this.indexFd : this.dataFd;

    fs.read(fd, buffer, 0, BLOCK_SIZE, pos, readCb);
  }

  set(type: DbObjectType, ref: string, obj: any, cb: DoneCb) {
    var writeCb = (err: Error) => {
      if (err) return cb(err);
      fs.rename(tmpPath, fullPath, mvCb);
    };
    var mvCb = (err: Error) => {
      return cb(err);
    };
    var fullPath = path.join(this.kvDir, ref);
    var tmpFile = new Date().getTime().toString() + this.uid++;
    var tmpPath = path.join(this.kvDir, tmpFile);

    fs.writeFile(tmpPath, new msgpack.Encoder().encode(obj), null, writeCb);
  }

  del(type: DbObjectType, ref: string, cb: ObjectCb) {
    throw new Error('not implemented');
  }

  save(type: DbObjectType, obj: any, cb: RefCb) {
    var job = (appendCb) => {
      fs.write(fd, buffer, 0, buffer.length, null, appendCb);
    };
    var appendCb = (err: Error, written: number) => {
      if (err) return cb(err, null);
      if (type === DbObjectType.IndexData) this.indexOffset += written;
      else this.dataOffset += written;
      cb(null, pos);
    };
    var pos, fd, buffer, dif, pad = '0000000000000000';

    if (type === DbObjectType.IndexData) {
      fd = this.indexFd;
      pos = this.indexOffset;
    } else {
      fd = this.dataFd;
      pos = this.dataOffset;
    }

    buffer = new msgpack.Encoder().encode(obj);
    // normalize to an even number of hex characters
    pos = pos.toString(16);
    if (dif = (pad.length - pos.length)) {
      pos = pad.slice(0, dif) + pos;
    }

    this.writes.add(appendCb, job);
  }
}

registerBackend('fs', FsStorage);
