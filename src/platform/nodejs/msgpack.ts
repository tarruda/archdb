/// <reference path="../../util.ts"/>
/// <reference path="../../private_api.ts"/>
/// <reference path="../../open.ts"/>
/// <reference path="../../declarations/node.d.ts"/>

/*
 * This module implements a MessagePack serializer/deserializer for usage
 * with the FsStorage backend. 
 * Based on
 * https://github.com/msgpack/msgpack-javascript/blob/master/msgpack.base.js
 * But uses reserved type codes for Uid, ObjectRef, Date and RegExp.
 * undefined values are normalized to null
 */
module MessagePack {

  function encodeRec(chunks: Array, obj: any): number {
    var buf, len, keys, hi32, lo32, int64;
    var type = typeOf(obj), rv = 1;

    switch (type) {

      case ObjectType.Null:
        chunks.push(new Buffer([0xc0]));
        break;
      case ObjectType.Boolean:
        chunks.push(new Buffer([obj ? 0xc3 : 0xc2]));
        break;
      case ObjectType.Number:
        if (obj !== obj ||
            obj === Infinity || obj === -Infinity ||
            Math.floor(obj) !== obj) {
          // double
          buf = new Buffer(9);
          buf.write(0xcb);
          buf.writeDoubleBE(obj, 1);
          chunks.push(buf);
          rv = 9;
          break;
        }
        int64 = false;
        // integers
        if (obj >= 0) {
          // positive
          if (obj < 0x80) {
            // fixnum
            buf = new Buffer([obj]);
          } else if (obj < 0x100) {
            // uint8
            buf = new Buffer([0xcc, obj]);
            rv = 2;
          } else if (obj < 0x10000) {
            // uint16
            buf = new Buffer([0xcd, obj >> 8, obj & 0xff]);
            rv = 3;
          } else if (obj < 0x100000000) {
            // uint32
            buf = new Buffer([0xce, obj >>> 24, (obj >>> 16) & 0xff,
                (obj >>> 8) & 0xff, obj & 0xff]);
            rv = 5;
          } else {
            int64 = true;
          }
        } else {
          // negative
          if (obj >= -0x20) {
            // fixnum
            buf = new Buffer([0xe0 + obj + 32]);
          } else if (obj > -0x80) {
            // int8
            buf = new Buffer([0xd0, obj + 0x100]); 
            rv = 2;
          } else if (obj > -0x8000) {
            // int16
            obj += 0x10000
            buf = new Buffer([0xd1, obj >>> 8, obj & 0xff]);
            rv = 3;
          } else if (obj > -0x8000) {
            // int32
            obj += 0x100000000
            buf = new Buffer([0xd2, obj >>> 24, (obj >>> 16) & 0xff,
                (obj >>> 8) & 0xff, obj & 0xff]);
            rv = 5;
          } else {
            int64 = true;
          }
        }
        if (int64) {
          hi32 = Math.floor(obj / 0x100000000);
          lo32 = obj & (0x100000000 - 1);
          buf = new Buffer([obj < 0 ? 0xd3 : 0xcf,
              (hi32 >>> 24) & 0xff, (hi32 >>> 16) & 0xff,
              (hi32 >>> 8) & 0xff, hi32 & 0xff,
              (lo32 >>> 24) & 0xff, (lo32 >>> 16) & 0xff,
              (lo32 >>> 8) & 0xff, lo32 & 0xff]);
          rv = 9;
        }
        chunks.push(buf);
        break;
      case ObjectType.String:
        buf = new Buffer(obj, 'utf8');
        len = buf.length;
        if (len < 0x20) {
          // fix raw
          buf = Buffer.concat([
              new Buffer([len | 0xa0]),
              buf 
              ]);
          rv = len + 1;
        } else if (len < 0x10000) {
          // raw 16
          buf = Buffer.concat([
              new Buffer([0xda, len >>> 8, len & 0xff]),
              buf 
              ]);
          rv = len + 3;
        } else if (len < 0x100000000) {
          // raw 32
          buf = Buffer.concat([
              new Buffer([0xdb, len >>> 24, (len >>> 16) & 0xff,
                (len >>> 8) & 0xff, len & 0xff]),
              buf 
              ]);
          rv = len + 5;
        }
        chunks.push(buf);
        break;
      case ObjectType.Array:
      case ObjectType.Object:
        if (type === ObjectType.Array) {
          len = obj.length;
        } else {
          keys = Object.keys(obj);
          len = obj.length;
        }
        if (len < 0x10) {
          chunks.push(new Buffer([len | 0x90]));
        } else if (len < 0x10000) {
          chunks.push(new Buffer([type === ObjectType.Array ? 0xdc : 0xde,
                len >>> 8, len & 0xff]));
          rv = 3;
        } else if (len < 0x100000000) {
          chunks.push(new Buffer([type === ObjectType.Array ? 0xdd : 0xdf,
                len >>> 24, (len >>> 16) & 0xff, (len >>> 8) & 0xff,
                len & 0xff]));
          rv = 5;
        }
        if (type === ObjectType.Array) {
          for (var i = 0;i < len;i++) rv += encodeRec(chunks, obj[i]);
        } else {
          for (var i = 0;i < len;i++) {
            var key = keys[i];
            rv += encodeRec(chunks, key);
            rv += encodeRec(chunks, obj[key]);
          }
        }
        break;
    }
    return rv;
  }
}
