/// <reference path="./util.ts"/>

var ONE = 0xffffffff, P32 = Math.pow(2, 32), MIN_NORM = Math.pow(2, -1022);
var PMANT = Math.pow(2, 52), PSUBN = Math.pow(2, -1074);

class BitArray implements IndexKey {
  words: Array<number>;
  idx: number;
  offset: number;
  readOffset: number;
  readIdx: number;

  constructor(value?) {
    this.words = new Array<number>();
    this.idx = 0;
    this.offset = 0;
    this.readOffset = 0;
    this.readIdx = 0;
    if (value !== undefined) this.pack(value);
  }

  resetPos() {
    this.readOffset = 0;
    this.readIdx = 0;
  }

  normalize() {
    var rv = this.unpack();
  
    this.resetPos();
    return rv;
  }

  rewind(len: number) {
    var newOffset;

    newOffset = this.offset - len;
    if (newOffset <= 0) {
      newOffset = -newOffset;
      if (this.idx === this.words.length - 1) this.words.pop();
      this.idx--;
      newOffset = 32 - newOffset;
    }

    this.offset = newOffset;
    this.words[this.idx] &= (0xffffffff << (32 - newOffset));
    this.offset = newOffset;
  }

  write(int32: number, len: number = 8) {
    var write, writeMask, dif, bits;

    write = len;

    if (int32 < 0) int32 >>>= 0;

    if (this.offset === 0) this.words.push(0);

    if ((dif = 32 - this.offset - write) <= 0) {
      dif = -dif;
      write = len - dif;
      writeMask = ((ONE >>> this.offset) << dif) >>> 0;
      this.words[this.idx] |= (int32 & writeMask) >>> dif;
      this.idx++;
      this.offset = 0;
      write = dif;
    }

    if (write) {
      bits = (int32 << (32 - this.offset - write));
      bits &= ONE >>> this.offset;
      this.words[this.idx] |= bits;
      this.offset += write;
    }

    return this;
  }

  read(len: number = 8) {
    var read, readMask, dif, rv = 0;

    if (!len) len = 8;

    read = len;

    if ((dif = 32 - this.readOffset - read) <= 0) {
      read = len + dif;
      readMask = ONE >>> this.readOffset;
      rv = this.words[this.readIdx] & readMask;
      this.readIdx++;
      this.readOffset = 0;
      read = -dif;
      rv <<= read;
    }

    if (read) {
      readMask = ONE >>> this.readOffset;
      rv |= (this.words[this.readIdx] & readMask) >>> dif;
      this.readOffset += read;
    }

    return rv >>> 0;
  }

  packNumber(num: number) {
    // algorithm adapted from
    // http://blog.coolmuse.com/2012/06/21/getting-the-exponent-and-mantissa-from-a-javascript-number/
    // this algorithm encodes negative numbers with all bits flipped, so
    // the bit array will have the same ordering as the natural ordering
    // of the corresponding numbers(as a consequence, numbers >=0 are
    // encoded with the MSB set)
    var abs, exp, mant, mantHi, mantLo, tmp, negative;

    if (num === 0) {
      this.write(1, 1);
      this.write(0, 31);
      this.write(0, 32);
      return;
    }

    if (!isFinite(num)) {
      if (isNaN(num)) {
        this.write(0, 32);
        this.write(0, 32);
      } else {
        if (num === -Infinity) {
          this.write(0, 32);
          this.write(0, 31);
          this.write(1, 1);
        } else {
          this.write(ONE, 32);
          this.write(ONE, 32);
        }
      }
      return;
    }

    negative = num < 0;

    if (negative) this.write(0, 1);
    else this.write(ONE, 1);

    // calculate exponent
    exp = 0;
    abs = Math.abs(num);

    if (abs >= MIN_NORM) { // not subnormal
      // http://en.wikipedia.org/wiki/Binary_logarithm
      tmp = abs;
      while (tmp < 1) { exp -= 1; tmp *= 2; }
      while (tmp >= 2) { exp += 1; tmp /= 2; }
      exp += 1023; // add bias
    }

    if (negative) this.write(~exp, 11);
    else this.write(exp, 11);

    // calculate mantissa
    if (exp === 0) {
      // subnormal
      mant = Math.floor(abs / PSUBN);
    } else {
      tmp = abs / Math.pow(2, exp - 1023);
      mant = Math.floor((tmp - 1) * PMANT);
    }

    // split the mantissa into two 32-bit integers for packing into
    // the bit array
    mantHi = Math.floor(mant / P32);
    mantLo = mant >>> 0;
    if (negative) {
      this.write(~mantHi, 20);
      this.write(~mantLo, 32);
    } else {
      this.write(mantHi, 20);
      this.write(mantLo, 32);
    }
  }

  unpackNumber(): number {
    var negative, exp, mant, mantHi, mantLo, rv;

    negative = !this.read(1);
    exp = this.read(11);
    mantHi = this.read(20);
    mantLo = this.read(32);

    // handle special values first
    if (!exp) {
      if (negative && !mantHi) {
        if (mantLo === 1) {
          return -Infinity;
        } else if (mantLo === 0) {
          return NaN;
        }
      } else if (!negative && !exp && !mantHi && !mantLo) {
        return 0;
      }
    } else if (exp === 2047 && mantHi === ONE && mantLo === ONE) {
      return Infinity;
    }

    if (negative) exp = 0x7ff - exp;
    if (negative) mantHi = 0xfffff - mantHi;
    if (negative) mantLo = 0xffffffff - mantLo;

    mant = mantHi * P32;
    mant += mantLo;

    if (exp === 0 && (mantHi || mantLo)) {
      // subnormal
      rv = mant * PSUBN;
    } else {
      rv = mant / PMANT + 1;
      rv = Math.pow(2, exp - 1023) * rv;
    }

    if (negative) rv = -rv;

    return rv;
  }

  packUid(uid: Uid, length: number) {
    var len = length * 2;

    for (var i = 0;i < len;i++) {
      this.write(parseInt(uid.hex[i], 16), 4);
    }
  }

  packString(str: string) {
    var encoded = encodeURIComponent(str);
    var code, c;
    var i = 0;

    while (i < encoded.length) {
      c = encoded[i];
      if (c === '%') {
        code = parseInt(encoded[i+1] + encoded[i+2], 16);
        i += 3;
      } else {
        code = encoded.charCodeAt(i);
        i++;
      }
      this.write(code);
    }
  }

  unpackUid(length: number): Uid {
    var hex = '', len = length * 2;
  
    for (var i = 0;i < len;i++) {
      hex += this.read(4).toString(16);
    }

    return new Uid(hex);
  }

  unpackString(): string {
    var b, encoded = '';

    while (true) {
      if ((b = this.read()) === 0) break;
      encoded += '%' + b.toString(16).toUpperCase();
    }

    return decodeURIComponent(encoded);
  }

  packArray(array: Array) {
    array.forEach(el => {
      this.pack(el);
      if (typeOf(el) === ObjectType.String) { 
        this.write(0); // terminate strings with 0
      }
    });

    this.write(0, 4); // special type code(undefined) to mark end of array
  }

  unpackArray(): Array {
    var obj, rv = [];

    while ((obj = this.unpack()) !== undefined) {
      rv.push(obj);
    }

    return rv;
  }

  pack(obj) {
    var type;

    if (obj === null) {
      this.write(1, 4);
    } else  {
      obj = obj.valueOf();
      if (obj === true) {
        this.write(2, 4);
      } else if (obj === false) {
        this.write(3, 4);
      } else if ((type = typeOf(obj)) === ObjectType.Number) {
        this.write(4, 4);
        this.packNumber(obj);
      } else if (type === ObjectType.String) {
        this.write(5, 4);
        this.packString(obj);
      } else if (type === ObjectType.Uid) {
        if (obj.byteLength() === 8) {
          this.write(6, 4);
          this.packUid(obj, 8);
        } else if (obj.byteLength() === 14) {
          this.write(7, 4);
          this.packUid(obj, 14);
        }
      } else if (type === ObjectType.Array) {
        this.write(15, 4);
        this.packArray(obj);
      } else {
        throw new Error('Invalid object type for key');
      }
    }
  }

  unpack() {
    var type;

    type = this.read(4);

    if (type === 0) {
      return undefined;
    } else if (type === 1) {
      return null;
    } else if (type === 2) {
      return true;
    } else if (type === 3) {
      return false;
    } else if (type === 4) {
      return this.unpackNumber();
    } else if (type === 5) {
      return this.unpackString();
    } else if (type === 6) {
      return this.unpackUid(8);
    } else if (type === 7) {
      return this.unpackUid(14);
    } else if (type === 15) {
      return this.unpackArray();
    }

    throw new Error('Corrupted bit array');
  }

  compareTo(other: BitArray): number {
    var rv, min = Math.min(this.words.length, other.words.length);

    for (var i = 0;i < min;i++) {
      rv = (this.words[i] >>> 0) - (other.words[i] >>> 0);
      if (rv < 0) return -1;
      else if (rv > 0) return 1;
    }

    rv = this.words.length - other.words.length;
    if (rv === 0) rv = this.offset - other.offset;

    return rv;
  }

  inspect(): string {
    var rv = [], bytes = this.getBytes(), tmp;

    tmp = [];
    while (bytes.length) {
      tmp.push(bytes.shift().toString(16));
      if (tmp.length === 4) {
        rv.push(tmp.join(' '));
        tmp = [];
      }
    }

    if (tmp.length) rv.push(tmp.join(' '));

    return rv.join('   ');
  }

  clone(): BitArray {
    var rv = new BitArray();

    for (var i = 0;i < this.words.length;i++) rv.words.push(this.words[i]);
    rv.idx = this.idx;
    rv.offset = this.offset;

    return rv;
  }

  private getBytes(): Array<number> {
    var rv = [];

    for (var i = 0;i < this.words.length;i++) {
      rv.push(this.words[i] >>> 24);
      rv.push((this.words[i] >>> 16) & 0xff);
      rv.push((this.words[i] >>> 8) & 0xff);
      rv.push(this.words[i] & 0xff);
    }

    if (this.offset) {
      if (this.offset <= 24) rv.pop();
      if (this.offset <= 16) rv.pop();
      if (this.offset <= 8) rv.pop();
    }

    return rv;
  }

}
