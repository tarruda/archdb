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
  var ud = undefined;

  export class Encoder {
    os: number;
    private chunks: Array<NodeBuffer>;

    constructor() {
      this.os = 0;
      this.chunks = [];
    }

    encode(obj): NodeBuffer {
      this.encodeRec(obj);
      return Buffer.concat(this.chunks, this.os);
    }
  
    encodeRec(obj) {
      var b, l, key, keys;
      var type = typeOf(obj), chunks = this.chunks;
    
      switch (type) {
        case ObjectType.Null:
          chunks.push(new Buffer([0xc0])); this.os += 1; break;
        case ObjectType.Boolean:
          chunks.push(new Buffer([obj ? 0xc3 : 0xc2])); this.os +=1; break;
        case ObjectType.Number:
          if (isFinite(obj) && Math.floor(obj) === obj) {
            // integer
            if (obj >= 0) { // positive
              if (obj < 0x80) { // fixnum
                b = new Buffer([obj]);
                this.os += 1;
              } else if (obj < 0x100) { // uint8
                b = new Buffer([0xcc, obj]);
                this.os += 2;
              } else if (obj < 0x10000) { // uint16
                b = new Buffer(3);
                b.writeUInt8(0xcd, 0);
                b.writeUInt16BE(obj, 1);
                this.os += 3;
              } else if (obj < 0x100000000) { // uint32
                b = new Buffer(5);
                b.writeUInt8(0xce, 0);
                b.writeUInt32BE(obj, 1);
                this.os += 5;
              }
            } else {
              // negative
              if (obj >= -0x20) { // fixnum
                b = new Buffer([0xe0 + obj + 32]);
                this.os += 1;
              } else if (obj > -0x80) { // int8
                b = new Buffer([0xd0, obj + 0x100]); 
                this.os += 2;
              } else if (obj > -0x8000) { // int16
                b = new Buffer(3);
                b.writeUInt8(0xd1, 0);
                b.writeInt16BE(obj, 1);
                this.os += 3;
              } else if (obj > -0x8000) { // int32
                b = new Buffer(5);
                b.writeUInt8(0xd2, 0);
                b.writeInt32BE(obj, 1);
                this.os += 5;
              }
            }
            // if (int64) {
            //   hi32 = Math.floor(obj / 0x100000000);
            //   lo32 = (obj & 0xffffffff) >>> 0;
            //   b = new Buffer(9);
            //   b.writeUInt8(0xd3, 0);
            //   b.writeInt32BE(hi32, 1);
            //   b.writeUInt32BE(lo32, 5);
            //   rv = 9;
            // }
          }
          if (!b) {
            // For doubles or integers with length > 32 we reuse the
            // BitArray number packing algorithm. This is necessary
            // because Buffer.{write,read}DoubleBE seems to fail sometimes
            // when the precision is high, eg:
            // > b = new Buffer(8);
            // > n = -14.49090013186719;
            // > b.writeDoubleBE(n, 0);
            // > b.readDoubleBE(0) === n // false, it is -14.490900131870829
            b = this.encodeDouble(<number>obj, 0xcb);
          }
          chunks.push(b); break;
        case ObjectType.String:
          b = new Buffer(obj, 'utf8');
          l = b.length;
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
          chunks.push(b); break;
        case ObjectType.Date:
          // save dates with the same encoding as doubles and use the
          // reserved code 0xc9
          chunks.push(this.encodeDouble(<number>obj, 0xc9)); break;
        case ObjectType.Array:
        case ObjectType.Object:
          if (type === ObjectType.Array) {
            l = obj.length;
          } else {
            keys = Object.keys(obj);
            l = keys.length;
          }
          if (l < 0x10) {
            b = new Buffer([l | (type === ObjectType.Array ? 0x90 : 0x80)]);
            this.os += 1;
          } else if (l < 0x10000) {
            b = new Buffer(3);
            b.writeUInt8(type === ObjectType.Array ? 0xdc : 0xde, 0);
            b.writeUInt16BE(l, 1);
            this.os += 3;
          } else if (l < 0x100000000) {
            b = new Buffer(5);
            b.writeUInt8(type === ObjectType.Array ? 0xdd : 0xdf, 0);
            b.writeUInt32BE(l, 1);
            this.os += 5;
          }
          chunks.push(b);
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

    private encodeDouble(num: number, typeCode: number): NodeBuffer {
      var ba = new BitArray(), b = new Buffer(9);

      ba.packNumber(num);
      b.writeUInt8(typeCode, 0);
      b.writeUInt32BE(ba.words[0] >>> 0, 1);
      b.writeUInt32BE(ba.words[1] >>> 0, 5);
      this.os += 9;
      return b;
    }
  }

  export class Decoder {
    os: number;

    constructor() {
      this.os = 0;
    }

    decode(b: NodeBuffer) {
      var l, ba, key, rv;
      var type = b[this.os++];

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

      if (rv != ud) return rv;
      
      switch (type) {
        case 0xc0: // null
          rv = null; break;
        case 0xc2: // false
          rv = false; break;
        case 0xc3: // true
          rv = true; break;
        case 0xc9: // date
          rv = new Date(this.decodeDouble(b)); break;
        case 0xcb: // double
          rv = this.decodeDouble(b); break;
        case 0xcc: // uint8
          rv = b.readUInt8(this.os); this.os += 1; break;
        case 0xcd: // uint16
          rv = b.readUInt16BE(this.os); this.os += 2; break;
        case 0xce: // uint32
          rv = b.readUInt32BE(this.os); this.os += 4; break;
        case 0xd0: // int8
          rv = b.readInt8(this.os); this.os += 1; break;
        case 0xd1: // int16
          rv = b.readInt16BE(this.os); this.os += 2; break;
        case 0xd2: // int32
          rv = rv = b.readInt32BE(this.os); this.os += 4; break;
        // case 0xd3: // int64
        //   hi32 = b.readInt32BE(this.os); this.os += 4;
        //   lo32 = b.readUInt32BE(this.os); this.os += 4;
        //   rv = hi32 * 0x100000000 + lo32; break;
        case 0xa0: // fixraw, raw16 and raw32
        case 0xda: l === ud && (l = b.readUInt16BE(this.os)) && (this.os += 2);
        case 0xdb: l === ud && (l = b.readUInt32BE(this.os)) && (this.os += 4);
          rv = ''
          if (l) {
            rv = b.slice(this.os, this.os + l).toString('utf8');
            this.os += l;
          }
          break;
        case 0x90: // fixarray, array16 and array32
        case 0xdc: l === ud && (l = b.readUInt16BE(this.os)) && (this.os += 2);
        case 0xdd: l === ud && (l = b.readUInt32BE(this.os)) && (this.os += 4);
          rv = new Array(l);
          if (l) {
            for (var i = 0;i < l;i++) rv[i] = this.decode(b);
          }
          break;
        case 0x80: // fixmap, map16 and map32
        case 0xde: l === ud && (l = b.readUInt16BE(this.os)) && (this.os += 2);
        case 0xdf: l === ud && (l = b.readUInt32BE(this.os)) && (this.os += 4);
          rv = {};
          if (l) {
            for (var i = 0;i < l;i++) {
              key = this.decode(b);
              rv[key] = this.decode(b);
            }
          }
          break;
      }

      return rv;
    }

    private decodeDouble(b: NodeBuffer): number {
      var ba = new BitArray();
      ba.words = [
        b.readUInt32BE(this.os),
        b.readUInt32BE(this.os += 4),
        ];
      this.os += 4;
      return ba.unpackNumber();
    }
  }
}
