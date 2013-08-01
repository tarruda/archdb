/// <reference path="../../util.ts"/>
/// <reference path="../../bit_array.ts"/>
/// <reference path="../../private_api.ts"/>
/// <reference path="../../open.ts"/>
/// <reference path="../../declarations/node.d.ts"/>

/*
 * This module implements a MessagePack serializer/deserializer for usage
 * with the FsStorage backend. 
 * Based on
 * https://github.com/msgpack/msgpack-javascript/blob/master/msgpack.base.js
 * But uses reserved type codes for util.Uid, ObjectRef, Date and RegExp.
 * undefined values are normalized to null
 */
module msgpack {
  var yield = platform.yield;
  var ud = undefined;
  var ObjectType = util.ObjectType;

  export function encode(obj): NodeBuffer {
    var encodeRec = (obj) => {
      var b, l, ref, flags, key, keys;
      var type = util.typeOf(obj);
      switch (type) {
        case ObjectType.Null:
        case ObjectType.Undefined:
          chunks.push(new Buffer([0xc0])); offset++; break;
        case ObjectType.Boolean:
          chunks.push(new Buffer([obj ? 0xc3 : 0xc2])); offset +=1; break;
        case ObjectType.Number:
          if (isFinite(obj) && Math.floor(obj) === obj) {
            // integer
            if (obj >= 0) { // positive
              if (obj < 0x80) { // fixnum
                b = new Buffer([obj]);
                offset++;
              } else if (obj < 0x100) { // uint8
                b = new Buffer([0xcc, obj]);
                offset += 2;
              } else if (obj < 0x10000) { // uint16
                b = new Buffer(3);
                b.writeUInt8(0xcd, 0);
                b.writeUInt16BE(obj, 1);
                offset += 3;
              } else if (obj < 0x100000000) { // uint32
                b = new Buffer(5);
                b.writeUInt8(0xce, 0);
                b.writeUInt32BE(obj, 1);
                offset += 5;
              }
            } else {
              // negative
              if (obj >= -0x20) { // fixnum
                b = new Buffer([0xe0 + obj + 32]);
                offset++;
              } else if (obj > -0x80) { // int8
                b = new Buffer([0xd0, obj + 0x100]); 
                offset += 2;
              } else if (obj > -0x8000) { // int16
                b = new Buffer(3);
                b.writeUInt8(0xd1, 0);
                b.writeInt16BE(obj, 1);
                offset += 3;
              } else if (obj > -0x8000) { // int32
                b = new Buffer(5);
                b.writeUInt8(0xd2, 0);
                b.writeInt32BE(obj, 1);
                offset += 5;
              }
            }
          }
          if (!b) {
            // For doubles or integers with length > 32 we reuse the
            // bit_array.BitArray number packing algorithm. This is necessary
            // because Buffer.{write,read}DoubleBE seems to fail sometimes
            // when the precision is high, eg:
            // > b = new Buffer(8);
            // > n = -14.49090013186719;
            // > b.writeDoubleBE(n, 0);
            // > b.readDoubleBE(0) === n // false, it is -14.490900131870829
            b = encodeDouble(<number>obj, 0xd4);
          }
          chunks.push(b); break;
        case ObjectType.String:
          b = new Buffer(obj, 'utf8');
          l = b.length;
          if (l < 0x20) { // fix raw
            chunks.push(new Buffer([l | 0xa0]));
            offset++;
          } else if (l < 0x10000) { // raw 16
            chunks.push(new Buffer([0xda, l >>> 8, l & 0xff]));
            offset += 3;
          } else if (l < 0x100000000) { // raw 32
            chunks.push(new Buffer([0xdb, l >>> 24, (l >>> 16) & 0xff,
                  (l >>> 8) & 0xff, l & 0xff]));
            offset += 5;
          }
          offset += l;
          chunks.push(b); break;
        case ObjectType.Date:
          // save dates with the same encoding as doubles and use the
          // reserved code 0xc4
          chunks.push(encodeDouble(<number>obj, 0xc4)); break;
        case ObjectType.ObjectRef:
          ref = obj.valueOf();
          // on the filesystem backend, the objectref is nothing but
          // the offset location in the data file, so we can represent
          // any objectref instance with a 32 or 64 bit uint.
          // use reserved codes 0xc5/0xc6 here.
          if (ref < 0x100000000) {
            b = new Buffer(5);
            b.writeUInt8(0xc5, 0);
            b.writeUInt32BE(ref, 1);
            offset += 5;
          } else {
            b = encodeDouble(ref, 0xc6);
          }
          chunks.push(b); break;
        case ObjectType.Uid:
          // use 0xc7 for Uids
          chunks.push(new Buffer('c7' + obj.hex, 'hex')); offset += 15; break;
        case ObjectType.RegExp:
          // besides the source string, regexps will store 3 flags,
          // so we use 1 byte for code(0xc8) and 3 bytes for flags and
          // source length, where 3 bits will store the flags and
          // 21 bits will store the length (maximum 2097151 bytes should
          // be enough for any regexp)
          b = new Buffer(obj.source, 'utf8');
          l = b.length;
          flags = obj.multiline | obj.ignoreCase << 1 | obj.global << 2;
          flags <<= 5;
          chunks.push(new Buffer([
                0xc8,
                flags | (l >>> 16),
                (l >>> 8) & 0xff,
                l & 0xff
                ]));
          chunks.push(b);
          offset += 4 + l;
          break;
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
            offset++;
          } else if (l < 0x10000) {
            b = new Buffer(3);
            b.writeUInt8(type === ObjectType.Array ? 0xdc : 0xde, 0);
            b.writeUInt16BE(l, 1);
            offset += 3;
          } else if (l < 0x100000000) {
            b = new Buffer(5);
            b.writeUInt8(type === ObjectType.Array ? 0xdd : 0xdf, 0);
            b.writeUInt32BE(l, 1);
            offset += 5;
          }
          chunks.push(b);
          if (type === ObjectType.Array) {
            for (var i = 0;i < l;i++) encodeRec(obj[i]);
          } else {
            for (var i = 0;i < l;i++) {
              key = keys[i];
              encodeRec(key);
              encodeRec(obj[key]);
            }
          }
          break;
      }
    };
    var encodeDouble = (num: number, typeCode: number): NodeBuffer => {
      var ba = new bit_array.BitArray(), b = new Buffer(9);
      ba.packNumber(num);
      b.writeUInt8(typeCode, 0);
      b.writeUInt32BE(ba.words[0] >>> 0, 1);
      b.writeUInt32BE(ba.words[1] >>> 0, 5);
      offset += 9;
      return b;
    };
    var offset = 0, chunks: Array<NodeBuffer> = [];
  
    encodeRec(obj);
    return Buffer.concat(chunks, offset);
  }

  export interface ReadMoreFn { (count: number, cb: ReadMoreCb); }

  export interface ReadMoreCb { (err: Error, buffer: NodeBuffer); }

  export function decode(b: NodeBuffer, read: ReadMoreFn, cb: ObjectCb) {
    var decodeRec = (cb: ObjectCb) => {
      var checkType = (err: Error) => {
        if (err) return cb(err, undefined);
        type = b[offset++];
        if (type >= 0xe0) { // negative fixnum
          return cb(null, type - 0x100);
        } else if (type < 0x80) { // positive fixnum 
          return cb(null, type);
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
        switch (type) {
          case 0xc0: return cb(null, null);
          case 0xc2: return cb(null, false);
          case 0xc3: return cb(null, true);
          case 0xc4: return seek(8, dateCb);
          case 0xc5: return seek(4, ref32Cb);
          case 0xc6: return seek(8, ref64Cb);
          case 0xc7: return seek(14, uidCb);
          case 0xc8: return seek(3, regExpLengthCb);
          case 0xd4: return seek(8, doubleCb);
          case 0xcc: return seek(1, uint8Cb);
          case 0xcd: return seek(2, uint16Cb);
          case 0xce: return seek(4, uint32Cb);
          case 0xd0: return seek(1, int8Cb);
          case 0xd1: return seek(2, int16Cb);
          case 0xd2: return seek(4, int32Cb);
          case 0xa0: return rawLengthCb(null);
          case 0xda: return seek(2, rawLengthCb);
          case 0xdb: return seek(4, rawLengthCb);
          case 0x90: rv = new Array(l); return arrayNext();
          case 0xdc: return seek(2, arrayLengthCb);
          case 0xdd: return seek(4, arrayLengthCb);
          case 0x80: rv = {}; return mapNext();
          case 0xde: return seek(2, mapLengthCb);
          case 0xdf: return seek(4, mapLengthCb);
        }
      };
      var dateCb = (err: Error) => {
        if (err) return cb(err, undefined);
        cb(null, new Date(decodeDouble(b)));
      };
      var ref32Cb = (err: Error) => {
        if (err) return cb(err, undefined);
        rv = new ObjectRef(b.readUInt32BE(offset));
        offset += 4;
        cb(null, rv);
      };
      var ref64Cb = (err: Error) => {
        if (err) return cb(err, undefined);
        cb(null, new ObjectRef(decodeDouble(b)));
      };
      var uidCb = (err: Error) => {
        if (err) return cb(err, undefined);
        cb(null, new util.Uid(b.slice(offset, offset += 14).toString('hex')));
      };
      var regExpLengthCb = (err: Error) => {
        if (err) return cb(err, undefined);
        flags = b.readUInt8(offset++);
        l = ((flags & 0x1f) << 16) | (b.readUInt8(offset++) << 8) |
          b.readUInt8(offset++);
        flags >>>= 5;
        flags =
          ((flags & 0x01) ? 'm' : '') +
          ((flags & 0x02) ? 'i' : '') +
          ((flags & 0x04) ? 'g' : '');
        seek(l, regExpCb);
      };
      var regExpCb = (err: Error) => {
        if (err) return cb(err, undefined);
        rv = new RegExp(b.slice(offset, offset + l).toString('utf8'),
          flags);
        offset += l;
        cb(null, rv);
      };
      var doubleCb = (err: Error) => {
        if (err) return cb(err, undefined);
        cb(null, decodeDouble(b));
      };
      var uint8Cb = (err: Error) => {
        if (err) return cb(err, undefined);
        cb(null, b.readUInt8(offset++));
      };
      var uint16Cb = (err: Error) => {
        if (err) return cb(err, undefined);
        rv = b.readUInt16BE(offset);
        offset += 2;
        cb(null, rv);
      };
      var uint32Cb = (err: Error) => {
        if (err) return cb(err, undefined);
        rv = b.readUInt32BE(offset);
        offset += 4;
        cb(null, rv);
      };
      var int8Cb = (err: Error) => {
        if (err) return cb(err, undefined);
        cb(null, b.readInt8(offset++));
      };
      var int16Cb = (err: Error) => {
        if (err) return cb(err, undefined);
        rv = b.readInt16BE(offset);
        offset += 2;
        cb(null, rv);
      };
      var int32Cb = (err: Error) => {
        if (err) return cb(err, undefined);
        rv = b.readInt32BE(offset);
        offset += 4;
        cb(null, rv);
      };
      var rawLengthCb = (err: Error) => {
        if (err) return cb(err, undefined);
        if (l) return seek(l, rawCb);
        if (type === 0xda) {
          l = b.readUInt16BE(offset);
          offset += 2;
        } else {
          l = b.readUInt32BE(offset);
          offset += 4;
        }
        seek(l, rawCb);
      };
      var rawCb = (err: Error) => {
        if (err) return cb(err, undefined);
        rv = ''
        if (l) {
          rv = b.slice(offset, offset + l).toString('utf8');
          offset += l;
        }
        return cb(null, rv);
      };
      var arrayLengthCb = (err: Error) => {
        if (err) return cb(err, undefined);
        if (type === 0xdc) {
          l = b.readUInt16BE(offset);
          offset += 2;
        } else {
          l = b.readUInt32BE(offset);
          offset += 4;
        }
        rv = new Array(l);
        arrayNext();
      };
      var arrayNext = () => {
        if (i === l) return cb(null, rv);
        decodeRec(arrayItemDecodeCb);
      };
      var arrayItemDecodeCb = (err: Error, item: any) => {
        rv[i++] = item;
        yield(arrayNext);
      };
      var mapLengthCb = (err: Error) => {
        if (type === 0xde) {
          l = b.readUInt16BE(offset);
          offset += 2;
        } else {
          l = b.readUInt32BE(offset);
          offset += 4;
        }
        rv = {};
        mapNext();
      };
      var mapNext = () => {
        if (i++ === l) return cb(null, rv);
        decodeRec(mapKeyDecodeCb);
      };
      var mapKeyDecodeCb = (err: Error, k: any) => {
        key = k;
        decodeRec(mapValueDecodeCb);
      };
      var mapValueDecodeCb = (err: Error, value: any) => {
        rv[key] = value;
        yield(mapNext);
      };
      var l, key, rv, flags, type, i = 0;
      seek(1, checkType);
    };
    var decodeDouble = (b: NodeBuffer): number => {
      var ba = new bit_array.BitArray();
      ba.words = [
        b.readUInt32BE(offset),
        b.readUInt32BE(offset += 4),
        ];
      offset += 4;
      return ba.unpackNumber();
    };
    var seek = (count: number, cb: DoneCb) => {
      var requiredOffset = offset + count;
      var requiredBytes = requiredOffset - b.length;
      if (requiredBytes <= 0) return cb(null);
      continueCb = cb;
      bTrail = b.slice(offset, Math.min(requiredOffset, b.length));
      read(requiredBytes, readMoreCb);
    };
    var readMoreCb = (err: Error, buffer: NodeBuffer) => {
      if (err) return continueCb(err);
      b = Buffer.concat([bTrail, buffer]);
      offset = 0;
      continueCb(null);
    };
    var bTrail, continueCb, amountNeeded, offset = 0;

    decodeRec(cb);
  }
}
