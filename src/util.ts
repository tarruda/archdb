module archdb {
  export function isArray(obj: any) {
    return Object.prototype.toString.call(obj) === '[object Array]';
  }

  export function isDate(obj: any) {
    return Object.prototype.toString.call(obj) === '[object Date]';
  }

  export function isRegExp(obj) {
    return Object.prototype.toString.call(obj) === '[object RegExp]';
  }

  export function isString(obj) {
    return Object.prototype.toString.call(obj) === '[object String]';
  }

  export function isNumber(obj) {
    return Object.prototype.toString.call(obj) === '[object Number]';
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
  export function normalize(obj) {
    var rv;

    if (obj === null) {
      rv = null;
    } else {
      if (isDate(obj)) {
        rv = normalizeDate(obj);
      } else if (isRegExp(obj)) {
        rv = normalizeRegExp(obj);
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

  export function denormalize(obj) {
    var rv;

    if (obj === null || typeof obj === 'boolean' ||
        typeof obj === 'number') {
      rv = obj;
    } else if (typeof obj === 'string') {
      if (!(rv = denormalizeDate(obj)) && !(rv = denormalizeRegExp(obj))) {
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

  function normalizeDate(obj) {
    return '!dt' + obj.valueOf().toString(16);
  }

  function denormalizeDate(obj) {
    var match = /^!dt(.+)$/.exec(obj);
    if (match) {
      return new Date(parseInt(match[1], 16));
    }
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
    if (match) {
      return new RegExp(match[2], match[1]);
    }
  }

  function hasProp(obj, name: string){
    return Object.prototype.hasOwnProperty.call(obj, name);
  }
}
