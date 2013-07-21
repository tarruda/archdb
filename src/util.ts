/// <reference path="./components.ts"/>
/// <reference path="./bit_array.ts"/>

/*
 * General purpose timestamp-based uid generator. The generated ids
 * are byte sequences where:
 *
 * bytes 1-6: unix time in milliseconds(since 1970), the max possible
 *            value is 7fffffffffff which represents
 *            'Tue Oct 16 6429 23:45:55 GMT-0300 (BRT)' (we won't be
 *            running out of ids for a while).
 * byte 7   : id count generated in the current millisecond, that means
 *            each generator can only generate 256 ids per millisecond.
 * remaining: arbitrary number that is assigned to the UidGenerator instance
 *            at creation. This allows multiple instances to safely generate
 *            ids at the same time, as long as this number is unique
 *            for each instance.
 * 
 * Uids are represented by hex strings wrapped on the Uid class
 */

class Uid {
  constructor(public hex: string) { }

  /* Returns the date this uid was generated */
  getTime(): number {
    return parseInt(this.hex.substr(0, 12), 16);
  }

  byteLength(): number {
    return this.hex.length / 2;
  }
}

class UidGenerator {
  suffix: string;
  genTime: number;
  genTimeCount: number;

  constructor(suffix?: string) {
    if (!suffix) this.generateSuffix();
    else this.suffix = suffix;
    this.genTime = 0;
    this.genTimeCount = 0;
  }

  generate(time?: number): Uid {
    var pad, count, tc, timeStr;

    if (!time) time = new Date().getTime();

    if (this.genTime !== time) {
      this.genTime = time;
      this.genTimeCount = 0;
    }

    if ((count = this.genTimeCount++) > 255) {
      throw new Error('Generated too many ids in the same millisecond');
    }

    pad = '00';
    tc = count.toString(16);
    tc = pad.substr(0, pad.length - tc.length) + tc;
    timeStr = this.toTime16(time);

    return new Uid(timeStr + tc + this.suffix);
  }

  private generateSuffix() {
    this.suffix = '';
    // generated suffixes are random 7-byte numbers so the resulting
    // uids have 14 bytes
    for (var i = 1;i <= 14;i++) this.suffix += this.random('0123456789abcdef');
  }

  private toTime16(time) {
    var pad = '000000000000';

    time = time.toString(16);
    return pad.substr(0, pad.length - time.length) + time;
  }

  private random(choices) {
    var radix = choices.length;
    var choice = Math.ceil(Math.random() * radix);

    if (choice === radix) {
      choice--;
    }
    return choices[choice];
  }
}

class LinkedListNode {
  next: LinkedListNode;

  constructor(public data: any) { }
}

class LinkedList {
  head: LinkedListNode;
  tail: LinkedListNode;

  push(data: any) {
    var node = new LinkedListNode(data);

    if (this.tail) this.tail = this.tail.next = node;
    else this.tail = this.head = node;
  }

  shift() {
    var rv = this.head.data;
    if (this.head.next) this.head = this.head.next;
    else this.head = this.tail = null;
    return rv;
  }

  each(cb: AnyCb) {
    var current = this.head;

    while (current) {
      cb(current.data);
      current = current.next;
    }
  }

  remove(item: any) {
    var current = this.head;
    var previous = null;

    while (current) {
      if (item === current.data) {
        if (previous) previous.next = current.next;
        else this.head = current.next;
        break;
      }
      previous = current;
      current = current.next;
    }
  }
}

class EventEmitter {
  handlers: Object;

  on(event: string, cb: AnyCb) {
    this.handlers = this.handlers || {};
    this.handlers[event] = this.handlers[event] || new LinkedList();
    this.handlers[event].push(cb);
  }

  once(event: string, cb: AnyCb) {
    var onceCb = () => {
      cb.apply(null, arguments);
      this.handlers[event].remove(onceCb);
    };

    this.on(event, onceCb);
  }

  off(event: string, cb: AnyCb) {
    if (!this.handlers || !this.handlers[event]) return;
    this.handlers[event].remove(cb);
  }

  emit(event: string, ...args: any[]) {
    var invokeCb = (node: AnyCb) => node.apply(null, args);

    if (!this.handlers || !this.handlers[event]) return;
    this.handlers[event].each(invokeCb);
  }
}
class Job {
  constructor(public cb: AnyCb, public fn: (cb: AnyCb) => void) {}
}

class JobQueue {
  jobs: Array<Job>;
  running: boolean;

  constructor(public frozen: boolean = false) {
    this.jobs = [];
    this.running = false;
  }

  add(cb: AnyCb, fn: (cb: AnyCb) => void) {
    this.jobs.push(new Job(cb, fn));
    this.run();
  }

  run() {
    var currentJobCb = (...args: any[]) => {
      if (currentJob.cb) currentJob.cb.apply(null, args);
      else if (args[0] instanceof Error) throw args[0]; // FIXME debug
      yield(nextJob);
    };
    var nextJob = () => {
      if (!this.jobs.length) {
        this.running = false;
        return;
      }
      currentJob = this.jobs.shift();
      currentJob.fn(currentJobCb);
    };

    var currentJob;

    if (this.frozen || this.running || !this.jobs.length) return;
    this.running = true;
    nextJob();
  }
}

function isArray(obj: any) {
  return Object.prototype.toString.call(obj) === '[object Array]';
}

function isDate(obj: any) {
  return Object.prototype.toString.call(obj) === '[object Date]';
}

function isRegExp(obj) {
  return Object.prototype.toString.call(obj) === '[object RegExp]';
}

function isString(obj) {
  return Object.prototype.toString.call(obj) === '[object String]';
}

function isNumber(obj) {
  return Object.prototype.toString.call(obj) === '[object Number]';
}

function isUid(obj) {
  return obj instanceof Uid;
}

function isObjectRef(obj) {
  return obj instanceof ObjectRef;
}
/*
   Object normalization/denormalization functions

   These functions have two purposes:
   1 - Deeply cloning objects returned from index queries, so it is
   safe to modify those objects from user code without worrying
   about messing with the backend caches
   2 - Converting special objects such as Date or RegExp instances
   to a format that is friendly for storage using mechanisms
   such as json or message pack
 */
function normalize(obj) {
  var rv;

  if (obj === null) {
    rv = null;
  } else {
    if (isDate(obj)) {
      rv = normalizeDate(obj);
    } else if (isRegExp(obj)) {
      rv = normalizeRegExp(obj);
    } else if (isUid(obj)) {
      rv = normalizeUid(obj);
    } else if (isObjectRef(obj)) {
      rv = normalizeObjectRef(obj);
    } else if (isArray(obj)) {
      rv = [];
      for (var i = 0;i < obj.length;i++) {
        rv.push(normalize(obj[i]));
      }
    } else if (obj !== undefined) {
      obj = obj.valueOf();
      if (obj === true || obj === false || typeof obj === 'number') {
        rv = obj;
      } else if (typeof obj === 'string') {
        rv = normalizeString(obj);
      } else  {
        rv = {};
        for (var k in obj) {
          if (hasProp(obj, k)) rv[k] = normalize(obj[k]);
        }
      }
    }
  }

  return rv;
}

function denormalize(obj) {
  var rv;

  if (obj === null || typeof obj === 'boolean' ||
      typeof obj === 'number') {
    rv = obj;
  } else if (typeof obj === 'string') {
    if (!(rv = denormalizeDate(obj)) && !(rv = denormalizeRegExp(obj)) &&
          !(rv = denormalizeUid(obj)) && !(rv = denormalizeObjectRef(obj))) {
      rv = denormalizeString(obj);
    }
  } else if (isArray(obj)) {
    rv = [];
    for (var i = 0;i < obj.length;i++) {
      rv.push(denormalize(obj[i]));
    }
  } else {
    rv = {};
    for (var k in obj) {
      if (hasProp(obj, k)) rv[k] = denormalize(obj[k]);
    }
  }

  return rv;
}

function normalizeString(obj) {
  if (/^!/.test(obj)) return '!' + obj;
  return obj;
}

function denormalizeString(obj) {
  if (/^!/.test(obj)) return obj.slice(1);
  return obj;
}

function normalizeObjectRef(obj) {
  return '!or' + obj.ref;
}

function denormalizeObjectRef(obj) {
  var match = /^!or(.+)$/.exec(obj);
  if (match) return new ObjectRef(match[1]);
}

function normalizeUid(obj) {
  return '!id' + obj.hex;
}

function denormalizeUid(obj) {
  var match = /^!id([abcdef0123456789]{24})$/.exec(obj);
  if (match) return new Uid(match[1]);
}

function normalizeDate(obj) {
  return '!dt' + obj.valueOf().toString(16);
}

function denormalizeDate(obj) {
  var match = /^!dt(.+)$/.exec(obj);
  if (match) return new Date(parseInt(match[1], 16));
}

function normalizeRegExp(obj) {
  var flags = '';
  if (obj.global) flags += 'g';
  if (obj.multiline) flags += 'm';
  if (obj.ignoreCase) flags += 'i';
  return '!re' + flags + ',' + obj.source;
}

function denormalizeRegExp(obj) {
  var match = /^!re(.+)?,(.+)$/.exec(obj);
  if (match) return new RegExp(match[2], match[1]);
}

function hasProp(obj, name: string){
  return Object.prototype.hasOwnProperty.call(obj, name);
}
