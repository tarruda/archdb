/// <reference path="./msgpack.ts"/>
/// <reference path="../../custom_errors.ts"/>
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
  dataWrites: util.JobQueue;
  nodeWrites: util.JobQueue;
  nodeOffset: number;
  dataOffset: number;
  nodeFd: number;
  dataFd: number;
  metadataFd: number;
  metadata: any;
  metadataOffset: number;
  metadataLength: number;
  metadataCbs: Array<{ cb: ObjectCb; key: string; }>;
  tmpMetadata: any;

  constructor(options: any) {
    var metadataDecodeCb = (err: Error, md: any) => {
      var mdGet;
      this.metadata = md;
      if (this.tmpMetadata) {
        for (var k in this.tmpMetadata) {
          this.metadata[k] = this.tmpMetadata[k];
        }
        this.tmpMetadata = null;
      }
      if (this.metadataCbs) {
        while (this.metadataCbs.length) {
          mdGet = this.metadataCbs.shift();
          mdGet.cb(null, md[mdGet.key]);
        }
        this.metadataCbs = null;
      }
    };
    var nodeFile, dataFile, metadataFile, buffer;
    var dataDir = path.resolve(options.path);

    nodeFile = path.join(dataDir, 'nodes');
    dataFile = path.join(dataDir, 'data');
    metadataFile = path.join(dataDir, 'metadata');
    this.nodeFd = fs.openSync(nodeFile, 'a+');
    this.dataFd = fs.openSync(dataFile, 'a+');
    this.nodeOffset = fs.fstatSync(this.nodeFd).size;
    this.dataOffset = fs.fstatSync(this.dataFd).size;
    this.nodeWrites = new util.JobQueue();
    this.dataWrites = new util.JobQueue();
    this.tmpId = 0;
    if (fs.existsSync(metadataFile)) {
      this.metadataCbs = null;
      this.tmpMetadata = null;
      // read metadata
      // the metadata file header is stored in the first 8 bytes of the file,
      // and is composed of two 32-bit unsigned integers which correspond to:
      // - offset where the metadata body begins
      // - length of the metadata body
      this.metadataFd = fs.openSync(metadataFile, 'r+');
      buffer = new Buffer(8);
      fs.readSync(this.metadataFd, buffer, 0, buffer.length, 0);
      this.metadataOffset = buffer.readUInt32BE(0);
      this.metadataLength = buffer.readUInt32BE(4);
      buffer = new Buffer(this.metadataLength);
      fs.readSync(this.metadataFd, buffer, 0, this.metadataLength,
          this.metadataOffset);
      msgpack.decode(buffer, null, metadataDecodeCb);
    } else {
      this.metadataFd = fs.openSync(metadataFile, 'w+');
      this.metadataOffset = 8;
      this.metadataLength = 0;
      this.metadata = {};
    }
  }

  set(key: string, obj: any, cb: DoneCb) {
    if (!this.metadata) {
      this.tmpMetadata = this.tmpMetadata || {};
      this.tmpMetadata[key] = util.normalize(obj);
    } else {
      this.metadata[key] = util.normalize(obj);
    }
    cb(null);
  }

  get(key: string, cb: ObjectCb) {
    if (!this.metadata) {
      this.metadataCbs = this.metadataCbs || [];
      this.metadataCbs.push({cb: cb, key: key});
    } else {
      if (!this.metadata[key]) return cb(null, null);
      cb(null, util.denormalize(this.metadata[key]));
    }
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

  flush(cb: DoneCb) {
    var bodyWriteCb = (err: Error) => {
      if (err) return cb(err);
      fs.fsync(this.dataFd, syncDataCb);
    };
    var syncDataCb = (err: Error) => {
      if (err) return cb(err);
      fs.fsync(this.nodeFd, syncNodesCb);
    };
    var syncNodesCb = (err: Error) => {
      if (err) return cb(err);
      fs.fsync(this.metadataFd, syncBodyCb);
    };
    var syncBodyCb = (err: Error) => {
      var header;
      if (err) return cb(err);
      // now that everything is synced, we make the flush as atomic as
      // possible by writing/syncing the metadata header separately
      // lets hope we don't get a power failure or system crash while
      // the operating system is in middle of writing the 8 bytes :)
      header = new Buffer(8);
      header.writeUInt32BE(pos, 0);
      header.writeUInt32BE(body.length, 4);
      fs.write(this.metadataFd, header, 0, header.length, 0, headerWriteCb);
    };
    var headerWriteCb = (err: Error) => {
      if (err) return cb(new custom_errors.FatalError('Failed to write metadata header'));
      fs.fsync(this.metadataFd, headerSyncCb);
    };
    var headerSyncCb = (err: Error) => {
      if (err) return cb(new custom_errors.FatalError('Failed to sync metadata header'));
      this.metadataOffset = pos;
      this.metadataLength = body.length;
      cb(null);
    };
    var pos;
    var body = msgpack.encode(this.metadata);

    // save the metadata body first. if the buffer fits
    // before the current metadata offset, then save at the beginning
    // (offset 8, after the header), else save after the current
    // metadata body
    if (8 + body.length < this.metadataOffset) pos = 8;
    else pos = this.metadataOffset + this.metadataLength;
    fs.write(this.metadataFd, body, 0, body.length, pos, bodyWriteCb);
  }

  close(cb: DoneCb) {
    var closeCb = (err: Error) => {
      if (err) return cb(err);
      if (!--remainingFds) cb(null);
    };
    var remainingFds = 3;
  
    fs.close(this.metadataFd, closeCb);
    fs.close(this.nodeFd, closeCb);
    fs.close(this.dataFd, closeCb);
  }

  private saveFd(fd: number, pos: number, queue: util.JobQueue, obj: any,
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
    var readCb = (err: Error, bytesRead: number) => {
      if (err) return cb(err, null);
      pos += bytesRead;
      msgpack.decode(buffer, readMore, cb);
    };
    var readMore = (count: number, cb: msgpack.ReadMoreCb) => {
      continueCb = cb;
      count = Math.max(count, BLOCK_SIZE);
      buffer = new Buffer(count);
      fs.read(fd, buffer, 0, count, pos, readMoreCb);
    };
    var readMoreCb = (err: Error, bytesRead: number) => {
      if (err) return continueCb(err, null);
      pos += bytesRead;
      continueCb(null, buffer);
    };
    var buffer, pos, continueCb;
  
    pos = ref.valueOf();
    buffer = new Buffer(BLOCK_SIZE);
    fs.read(fd, buffer, 0, buffer.length, pos, readCb);
  }
}

registerBackend('fs', FsStorage);
