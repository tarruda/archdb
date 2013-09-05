zlib = require('zlib')
BitArray = require('../../src/bit_array')
{ObjectRef, ObjectType, Uid, typeOf} = require('../../src/util')


compressedTypes =
  zlib: [0xd4, 0xd5, 0xd6]
  snappy: [0xd7, 0xd8, 0xd9]


compress =
  zlib: zlib.deflate


decompress =
  zlib: zlib.inflate


try
  snappy = require('snappy')
  compress.snappy = (buffer, cb) ->
    snappy.compress(buffer, cb)
  decompress.snappy = (buffer, cb) ->
    snappy.decompress(buffer, snappy.parsers.raw, cb)


encode = (obj, compression, cb) ->
  offset = 0; chunks = []

  encodeRec = (obj) =>
    type = typeOf(obj)
    switch type
      when ObjectType.Null, ObjectType.Undefined
        chunks.push(new Buffer([0xc0])); offset++
      when ObjectType.Boolean
        chunks.push(new Buffer([if obj then 0xc3 else 0xc2])); offset += 1
      when ObjectType.Number
        if isFinite(obj) and Math.floor(obj) == obj
          # integer
          if obj >= 0 # positive
            if obj < 0x80 # fixnum
              b = new Buffer([obj])
              offset++
            else if obj < 0x100 # uint8
              b = new Buffer([0xcc, obj])
              offset += 2
            else if obj < 0x10000 # uint16
              b = new Buffer(3)
              b.writeUInt8(0xcd, 0)
              b.writeUInt16BE(obj, 1)
              offset += 3
            else if obj < 0x100000000 # uint32
              b = new Buffer(5)
              b.writeUInt8(0xce, 0)
              b.writeUInt32BE(obj, 1)
              offset += 5
          else
            # negative
            if obj >= -(0x20) # fixnum
              b = new Buffer([0xe0 + obj + 32])
              offset++
            else if obj > -(0x80) # int8
              b = new Buffer([0xd0, obj + 0x100])
              offset += 2
            else if obj > -(0x8000) # int16
              b = new Buffer(3)
              b.writeUInt8(0xd1, 0)
              b.writeInt16BE(obj, 1)
              offset += 3
            else if obj > -(0x8000) # int32
              b = new Buffer(5)
              b.writeUInt8(0xd2, 0)
              b.writeInt32BE(obj, 1)
              offset += 5
        if not b
          # For doubles or integers with length > 32 we reuse the
          # BitArray number packing algorithm. This is necessary
          # because Buffer.{write,read}DoubleBE seems to fail sometimes
          # when the precision is high, eg:
          # > b = new Buffer(8)
          # > n = -14.49090013186719
          # > b.writeDoubleBE(n, 0)
          # > b.readDoubleBE(0) === n // false, it is -14.490900131870829
          b = encodeDouble(obj, 0xc9)
        chunks.push(b)
      when ObjectType.String
        b = new Buffer(obj, 'utf8')
        l = b.length
        if l < 0x20 # fix raw
          chunks.push(new Buffer([l | 0xa0]))
          offset++
        else if l < 0x10000 # raw 16
          chunks.push(new Buffer([0xda, l >>> 8, l & 0xff]))
          offset += 3
        else if l < 0x100000000 # raw 32
          chunks.push(new Buffer([0xdb, l >>> 24, (l >>> 16) & 0xff,
            (l >>> 8) & 0xff, l & 0xff]))
          offset += 5
        offset += l
        chunks.push(b)
      when ObjectType.Date
        # save dates with the same encoding as doubles and use the
        # reserved code 0xc4
        chunks.push(encodeDouble(obj, 0xc4))
      when ObjectType.ObjectRef
        ref = obj.valueOf()
        # on the filesystem backend, the objectref is nothing but
        # the offset location in the data file, so we can represent
        # any objectref instance with a 32 or 64 bit uint.
        # use reserved codes 0xc5/0xc6 here.
        if ref < 0x100000000
          b = new Buffer(5)
          b.writeUInt8(0xc5, 0)
          b.writeUInt32BE(ref, 1)
          offset += 5
        else
          b = encodeDouble(ref, 0xc6)
        chunks.push(b)
      when ObjectType.Uid
        # use 0xc7 for Uids
        chunks.push(new Buffer('c7' + obj.hex, 'hex')); offset += 15
      when ObjectType.RegExp
        # besides the source string, regexps will store 3 flags,
        # so we use 1 byte for code(0xc8) and 3 bytes for flags and
        # source length, where 3 bits will store the flags and
        # 21 bits will store the length (maximum 2097151 bytes should
        # be enough for any regexp)
        b = new Buffer(obj.source, 'utf8')
        l = b.length
        flags = obj.multiline | obj.ignoreCase << 1 | obj.global << 2
        flags <<= 5
        chunks.push(new Buffer([
          0xc8
          flags | (l >>> 16)
          (l >>> 8) & 0xff
          l & 0xff
        ]))
        chunks.push(b)
        offset += 4 + l
      when ObjectType.Array, ObjectType.Object
        if type == ObjectType.Array
          l = obj.length
        else
          keys = Object.keys(obj)
          l = keys.length
        if l < 0x10
          b = new Buffer(
            [l | (if type == ObjectType.Array then 0x90 else 0x80)])
          offset++
        else if l < 0x10000
          b = new Buffer(3)
          b.writeUInt8((if type == ObjectType.Array then 0xdc else 0xde), 0)
          b.writeUInt16BE(l, 1)
          offset += 3
        else if l < 0x100000000
          b = new Buffer(5)
          b.writeUInt8((if type == ObjectType.Array then 0xdd else 0xdf), 0)
          b.writeUInt32BE(l, 1)
          offset += 5
        chunks.push(b)
        if type == ObjectType.Array
          for item in obj
            encodeRec(item)
        else
          for own k, v of obj
            encodeRec(k)
            encodeRec(v)

  encodeDouble = (num, typeCode) =>
    ba = new BitArray(); b = new Buffer(9)
    ba.packNumber(num)
    b.writeUInt8(typeCode, 0)
    b.writeUInt32BE(ba.words[0] >>> 0, 1)
    b.writeUInt32BE(ba.words[1] >>> 0, 5)
    offset += 9
    return b

  encodeRec(obj)
  buffer = Buffer.concat(chunks, offset)

  if compression
    if not hasProp(compress, compression)
      throw new Error("compression library '#{compression}' not found")
    if buffer.length >= 20
      compress[compression](buffer, (err, compressed) =>
        if compressed.length <= 0xff
          type = compressedTypes[compression][0]
          rv = Buffer.concat([new Buffer([type, 0]), compressed])
          rv.writeUInt8(compressed.length, 1)
        else if compressed.length <= 0xffff
          type = compressedTypes[compression][1]
          rv = Buffer.concat([new Buffer([type, 0, 0]), compressed])
          rv.writeUInt16BE(compressed.length, 1)
        else
          type = compressedTypes[compression][2]
          rv = Buffer.concat([new Buffer([type, 0, 0, 0, 0]), compressed])
          rv.writeUInt32BE(compressed.length, 1)
        if rv.length < buffer.length
          return cb(null, rv)
        # compression actually inflated the buffer due to overhead.
        # return the original buffer
        cb(null, buffer))
      return
  cb(null, buffer)


decode = (b, read, cb) ->
  compression = compressedLen = bTrail = continueCb = amountNeeded = undef
  offset = 0

  decodeRec = (cb) =>
    l = key = rv = flags = type = undef
    i = 0

    checkType = (err) =>
      if err then return cb(err, undef)
      type = b[offset++]
      if type >= 0xe0 # negative fixnum
        return cb(null, type - 0x100)
      else if type < 0x80 # positive fixnum
        return cb(null, type)
      else if type < 0x90 # fixmap
        l = type - 0x80
        type = 0x80
      else if type < 0xa0 # fixarray
        l = type - 0x90
        type = 0x90
      else if type < 0xc0 # fixraw
        l = type - 0xa0
        type = 0xa0
      switch type
        when 0xc0 then return cb(null, null)
        when 0xc2 then return cb(null, false)
        when 0xc3 then return cb(null, true)
        when 0xc4 then return seek(8, dateCb)
        when 0xc5 then return seek(4, ref32Cb)
        when 0xc6 then return seek(8, ref64Cb)
        when 0xc7 then return seek(14, uidCb)
        when 0xc8 then return seek(3, regExpLengthCb)
        when 0xc9 then return seek(8, doubleCb)
        when 0xcc then return seek(1, uint8Cb)
        when 0xcd then return seek(2, uint16Cb)
        when 0xce then return seek(4, uint32Cb)
        when 0xd0 then return seek(1, int8Cb)
        when 0xd1 then return seek(2, int16Cb)
        when 0xd2 then return seek(4, int32Cb)
        when 0xa0 then return rawLengthCb(null)
        when 0xda then return seek(2, rawLengthCb)
        when 0xdb then return seek(4, rawLengthCb)
        when 0x90 then rv = new Array(l); return arrayNext()
        when 0xdc then return seek(2, arrayLengthCb)
        when 0xdd then return seek(4, arrayLengthCb)
        when 0x80 then rv = {}; return mapNext()
        when 0xde then return seek(2, mapLengthCb)
        when 0xdf then return seek(4, mapLengthCb)
        when compressedTypes.zlib[0], compressedTypes.snappy[0]
          return seek(1, compressedLengthCb)
        when compressedTypes.zlib[1], compressedTypes.snappy[1]
          return seek(2, compressedLengthCb)
        when compressedTypes.zlib[2], compressedTypes.snappy[2]
          return seek(4, compressedLengthCb)

    dateCb = (err) =>
      if err then return cb(err, undef)
      cb(null, new Date(decodeDouble(b)))

    ref32Cb = (err) =>
      if err then return cb(err, undef)
      rv = new ObjectRef(b.readUInt32BE(offset))
      offset += 4
      cb(null, rv)

    ref64Cb = (err) =>
      if err then return cb(err, undef)
      cb(null, new ObjectRef(decodeDouble(b)))

    uidCb = (err) =>
      if err then return cb(err, undef)
      cb(null, new Uid(b.slice(offset, offset += 14).toString('hex')))

    regExpLengthCb = (err) =>
      if err then return cb(err, undef)
      flags = b.readUInt8(offset++)
      l = ((flags & 0x1f) << 16) | (b.readUInt8(offset++) << 8) |
        b.readUInt8(offset++)
      flags >>>= 5
      flags =
        (if flags & 0x01 then 'm' else '') +
        (if flags & 0x02 then 'i' else '') +
        (if flags & 0x04 then 'g' else '')
      seek(l, regExpCb)

    regExpCb = (err) =>
      if err then return cb(err, undef)
      rv = new RegExp(b.slice(offset, offset + l).toString('utf8'), flags)
      offset += l
      cb(null, rv)

    doubleCb = (err) =>
      if err then return cb(err, undef)
      cb(null, decodeDouble(b))

    uint8Cb = (err) =>
      if err then return cb(err, undef)
      cb(null, b.readUInt8(offset++))

    uint16Cb = (err) =>
      if err then return cb(err, undef)
      rv = b.readUInt16BE(offset)
      offset += 2
      cb(null, rv)

    uint32Cb = (err) =>
      if err then return cb(err, undef)
      rv = b.readUInt32BE(offset)
      offset += 4
      cb(null, rv)

    int8Cb = (err) =>
      if err then return cb(err, undef)
      cb(null, b.readInt8(offset++))

    int16Cb = (err) =>
      if err then return cb(err, undef)
      rv = b.readInt16BE(offset)
      offset += 2
      cb(null, rv)

    int32Cb = (err) =>
      if err then return cb(err, undef)
      rv = b.readInt32BE(offset)
      offset += 4
      cb(null, rv)

    rawLengthCb = (err) =>
      if err then return cb(err, undef)
      if l then return seek(l, rawCb)
      if type == 0xda
        l = b.readUInt16BE(offset)
        offset += 2
      else
        l = b.readUInt32BE(offset)
        offset += 4
      seek(l, rawCb)

    rawCb = (err) =>
      if err then return cb(err, undef)
      rv = ''
      if l
        rv = b.slice(offset, offset + l).toString('utf8')
        offset += l
      return cb(null, rv)

    arrayLengthCb = (err) =>
      if err then return cb(err, undef)
      if type == 0xdc
        l = b.readUInt16BE(offset)
        offset += 2
      else
        l = b.readUInt32BE(offset)
        offset += 4
      rv = new Array(l)
      arrayNext()

    arrayNext = =>
      if i == l then return cb(null, rv)
      decodeRec(arrayItemDecodeCb)

    arrayItemDecodeCb = (err, item) =>
      rv[i++] = item
      $yield(arrayNext)

    mapLengthCb = (err) =>
      if type == 0xde
        l = b.readUInt16BE(offset)
        offset += 2
      else
        l = b.readUInt32BE(offset)
        offset += 4
      rv = {}
      mapNext()

    mapNext = =>
      if i++ == l then return cb(null, rv)
      decodeRec(mapKeyDecodeCb)

    mapKeyDecodeCb = (err, k) =>
      key = k
      decodeRec(mapValueDecodeCb)

    mapValueDecodeCb = (err, value) =>
      rv[key] = value
      $yield(mapNext)

    compressedLengthCb = (err) =>
      if type in [compressedTypes.zlib[0], compressedTypes.snappy[0]]
        l = b.readUInt8(offset)
        offset += 1
      else if type in [compressedTypes.zlib[1], compressedTypes.snappy[1]]
        l = b.readUInt16BE(offset)
        offset += 2
      else
        l = b.readUInt32BE(offset)
        offset += 4
      compression = 'zlib'
      if type > 0xd6
        if not hasProp(decompress, 'snappy')
          return cb(new Error("compression library 'snappy' not found"))
        compression = 'snappy'
      compressedLen = l
      seek(l, decodeCompression)

    decodeCompression = (err) =>
      compressed = b.slice(offset, compressedLen + offset)
      trail = b.slice(compressedLen)
      decompress[compression](compressed, (err, buffer) =>
        if err then console.log(err)
        b = Buffer.concat([buffer, trail])
        offset = 0
        decodeRec(cb))

    seek(1, checkType)

  decodeDouble = (b) =>
    ba = new BitArray()
    ba.words = [
      b.readUInt32BE(offset)
      b.readUInt32BE(offset += 4)
    ]
    offset += 4
    return ba.unpackNumber()

  seek = (count, cb) =>
    requiredOffset = offset + count
    requiredBytes = requiredOffset - b.length
    if requiredBytes <= 0 then return cb(null)
    continueCb = cb
    bTrail = b.slice(offset, Math.min(requiredOffset, b.length))
    read(requiredBytes, readMoreCb)

  readMoreCb = (err, buffer) =>
    if err then return continueCb(err)
    b = Buffer.concat([bTrail, buffer])
    offset = 0
    continueCb(null)

  decodeRec(cb)


exports.encode = encode
exports.decode = decode
