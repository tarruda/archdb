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
module msgpack {
  class Encoder {
    os: number;
    private chunks: Array;

    constructor() {
      this.os = 0;
      this.chunks = [];
    }

    encode(obj): NodeBuffer {
      this.encodeRec(obj);
      return Buffer.concat(this.chunks, this.os);
    }
  
    encodeRec(obj) {
      var buf, l, key, keys;
      var type = typeOf(obj), chunks = this.chunks;
    
      switch (type) {
        case ObjectType.Null:
          chunks.push(new Buffer([0xc0])); this.os += 1; break;
        case ObjectType.Boolean:
          chunks.push(new Buffer([obj ? 0xc3 : 0xc2])); this.os +=1; break;
        case ObjectType.Number:
          if (obj === obj && obj !== Infinity && obj !== -Infinity &&
              Math.floor(obj) === obj) {
            // integer
            if (obj >= 0) { // positive
              if (obj < 0x80) { // fixnum
                buf = new Buffer([obj]);
                this.os += 1;
              } else if (obj < 0x100) { // uint8
                buf = new Buffer([0xcc, obj]);
                this.os += 2;
              } else if (obj < 0x10000) { // uint16
                buf = new Buffer(3);
                buf.writeUInt8(0xcd, 0);
                buf.writeUInt16BE(obj, 1);
                this.os += 3;
              } else if (obj < 0x100000000) { // uint32
                buf = new Buffer(5);
                buf.writeUInt8(0xce, 0);
                buf.writeUInt32BE(obj, 1);
                this.os += 5;
              }
            } else {
              // negative
              if (obj >= -0x20) { // fixnum
                buf = new Buffer([0xe0 + obj + 32]);
                this.os += 1;
              } else if (obj > -0x80) { // int8
                buf = new Buffer([0xd0, obj + 0x100]); 
                this.os += 2;
              } else if (obj > -0x8000) { // int16
                buf = new Buffer(3);
                buf.writeUInt8(0xd1, 0);
                buf.writeInt16BE(obj, 1);
                this.os += 3;
              } else if (obj > -0x8000) { // int32
                buf = new Buffer(5);
                buf.writeUInt8(0xd2, 0);
                buf.writeInt32BE(obj, 1);
                this.os += 5;
              }
            }
            // if (int64) {
            //   hi32 = Math.floor(obj / 0x100000000);
            //   lo32 = (obj & 0xffffffff) >>> 0;
            //   buf = new Buffer(9);
            //   buf.writeUInt8(0xd3, 0);
            //   buf.writeInt32BE(hi32, 1);
            //   buf.writeUInt32BE(lo32, 5);
            //   rv = 9;
            // }
          }
          if (!buf) {
            // double or integer with length > 32
            buf = new Buffer(9);
            buf.writeUInt8(0xcb, 0);
            buf.writeDoubleBE(obj, 1);
            this.os += 9;
          }
          chunks.push(buf); break;
        case ObjectType.String:
          buf = new Buffer(obj, 'utf8');
          l = buf.length;
          if (l < 0x20) { // fix raw
            chunks.push(new Buffer([l | 0xa0]));
            this.os += 1;
          } else if (l < 0x10000) { // raw 16
            chunks.push(new Buffer([0xda, l >>> 8, l & 0xff]));
            this.os += 3;
          } else if (l < 0x100000000) { // raw 32
            chunks.push(new Buffer([0xdb, l >>> 24, (l >>> 16) & 0xff,
                  (l >>> 8) & 0xff, l & 0xff]));
            this.os += 5;
          }
          this.os += l;
          chunks.push(buf); break;
        case ObjectType.Array:
        case ObjectType.Object:
          if (type === ObjectType.Array) {
            l = obj.length;
          } else {
            keys = Object.keys(obj);
            l = obj.length;
          }
          if (l < 0x10) {
            buf = new Buffer([l | 0x90]);
            this.os += 1;
          } else if (l < 0x10000) {
            buf = new Buffer([type === ObjectType.Array ? 0xdc : 0xde,
                l >>> 8, l & 0xff]);
            this.os += 3;
          } else if (l < 0x100000000) {
            buf = new Buffer([type === ObjectType.Array ? 0xdd : 0xdf,
                  l >>> 24, (l >>> 16) & 0xff, (l >>> 8) & 0xff,
                  l & 0xff]);
            this.os += 5;
          }
          if (type === ObjectType.Array) {
            for (var i = 0;i < l;i++) this.encodeRec(obj[i]);
          } else {
            for (var i = 0;i < l;i++) {
              key = keys[i];
              this.encodeRec(key);
              this.encodeRec(obj[key]);
            }
          }
          break;
      }
    }
  }

  class Decoder {
    os: number;

    constructor() {
      this.os = 0;
    }

    decode(buf: NodeBuffer) {
      var l, hi32, lo32, key, rv;
      var type = buf[this.os++];

      if (type >= 0xe0) { // negative fixnum
        rv = type - 0x100;
      } else if (type < 0x80) { // positive fixnum 
        rv = type;
      } else if (type < 0x90) { // fixmap
        l = type - 0x80;
        type = 0x80;
      } else if (type < 0xa0) { // fixarray
        l = type - 0x90;
        type = 0x90;
      } else if (type < 0xc0) { // fixraw
        l = type - 0xa0;
        type = 0xa0;
      }

      if (rv !== undefined) return rv;
      
      switch (type) {
        case 0xc0: // null
          rv = null; break;
        case 0xc2: // false
          rv = false; break;
        case 0xc3: // true
          rv = true; break;
        case 0xcb: // double
          rv = buf.readDoubleBE(this.os); this.os += 8; break;
        case 0xcc: // uint8
          rv = buf.readUInt8(this.os); this.os += 1; break;
        case 0xcd: // uint16
          rv = buf.readUInt16BE(this.os); this.os += 2; break;
        case 0xce: // uint32
          rv = buf.readUInt32BE(this.os); this.os += 4; break;
        case 0xd0: // int8
          rv = buf.readInt8(this.os); this.os += 1; break;
        case 0xd1: // int16
          rv = buf.readInt16BE(this.os); this.os += 2; break;
        case 0xd2: // int32
          rv = rv = buf.readInt32BE(this.os); this.os += 4; break;
        // case 0xd3: // int64
        //   hi32 = buf.readInt32BE(this.os); this.os += 4;
        //   lo32 = buf.readUInt32BE(this.os); this.os += 4;
        //   rv = hi32 * 0x100000000 + lo32; break;
        case 0xa0: // fixraw, raw16 and raw32
        case 0xda: !l && (l = buf.readUInt16BE(this.os)) && (this.os += 2);
        case 0xdb: !l && (l = buf.readUInt32BE(this.os)) && (this.os += 4);
          rv = buf.slice(this.os, this.os + l).toString('utf8'); break;
        case 0xdd: // fixarray, array16 and array32
        case 0xdc: !l && (l = buf.readUInt16BE(this.os)) && (this.os += 2);
        case 0x90: !l && (l = buf.readUInt32BE(this.os)) && (this.os += 4);
          rv = new Array(l);
          for (var i = 0;i < l;i++) rv[i] = this.decode(buf);
          break;
        case 0xdf: // fixmap, map16 and map32
        case 0xde: !l && (l = buf.readUInt16BE(this.os)) && (this.os += 2);
        case 0x80: !l && (l = buf.readUInt32BE(this.os)) && (this.os += 4);
          rv = {};
          for (var i = 0;i < l;i++) {
            key = this.decode(buf);
            rv[key] = this.decode(buf);
          }
          break;
      }

      return rv;
    }
  }

}
