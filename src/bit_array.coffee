{Uid, ObjectType, typeOf} = require('./util')


ONE = 0xffffffff
P32 = Math.pow(2, 32)
MIN_NORM = Math.pow(2, -1022)
PMANT = Math.pow(2, 52)
PSUBN = Math.pow(2, -1074)


class BitArray
  constructor: (value) ->
    @words = []
    @idx = 0
    @offset = 0
    @readOffset = 0
    @readIdx = 0
    if value != undef
      @pack(value)


  resetPos: ->
    @readOffset = 0
    @readIdx = 0


  normalize: ->
    rv = @unpack()
  
    @resetPos()
    return rv


  rewind: (len) ->
    newOffset = @offset - len

    if newOffset <= 0
      newOffset = -newOffset
      if @idx == @words.length - 1
        @words.pop()
      @idx--
      newOffset = 32 - newOffset

    @offset = newOffset
    @words[@idx] &= (0xffffffff << (32 - newOffset))
    @offset = newOffset


  write: (int32, len = 8) ->
    write = len

    if int32 < 0
      int32 >>>= 0

    if @offset == 0
      @words.push(0)

    if (dif = 32 - @offset - write) <= 0
      dif = -dif
      write = len - dif
      writeMask = ((ONE >>> @offset) << dif) >>> 0
      @words[@idx] |= (int32 & writeMask) >>> dif
      @idx++
      @offset = 0
      write = dif

    if write
      bits = (int32 << (32 - @offset - write))
      bits &= ONE >>> @offset
      @words[@idx] |= bits
      @offset += write

    return this


  read: (len = 8) =>
    rv = 0

    if not len
      len = 8

    read = len

    if (dif = 32 - @readOffset - read) <= 0
      read = len + dif
      readMask = ONE >>> @readOffset
      rv = @words[@readIdx] & readMask
      @readIdx++
      @readOffset = 0
      read = -dif
      rv <<= read

    if read
      readMask = ONE >>> @readOffset
      rv |= (@words[@readIdx] & readMask) >>> dif
      @readOffset += read

    return rv >>> 0


  packNumber: (num) ->
    # algorithm adapted from
    # http://blog.coolmuse.com/2012/06/21/getting-the-exponent-and-mantissa-from-a-javascript-number/
    # this algorithm encodes negative numbers with all bits flipped, so
    # the bit array will have the same ordering as the natural ordering
    # of the corresponding numbers(as a consequence, numbers >=0 are
    # encoded with the MSB set)
    if num == 0
      @write(1, 1)
      @write(0, 31)
      @write(0, 32)
      return

    if not isFinite(num)
      if isNaN(num)
        @write(0, 32)
        @write(0, 32)
      else
        if num == -Infinity
          @write(0, 32)
          @write(0, 31)
          @write(1, 1)
        else
          @write(ONE, 32)
          @write(ONE, 32)
      return

    negative = num < 0

    if negative
      @write(0, 1)
    else
      @write(ONE, 1)

    # calculate exponent
    exp = 0
    abs = Math.abs(num)

    if abs >= MIN_NORM # not subnormal
      # http://en.wikipedia.org/wiki/Binary_logarithm
      tmp = abs
      while tmp < 1
        exp -= 1
        tmp *= 2
      while tmp >= 2
        exp += 1
        tmp /= 2
      exp += 1023 # add bias

    if negative
      @write(~exp, 11)
    else
      @write(exp, 11)

    # calculate mantissa
    if exp == 0
      # subnormal
      mant = Math.floor(abs / PSUBN)
    else
      tmp = abs / Math.pow(2, exp - 1023)
      mant = Math.floor((tmp - 1) * PMANT)

    # split the mantissa into two 32-bit integers for packing into
    # the bit array
    mantHi = Math.floor(mant / P32)
    mantLo = mant >>> 0
    if negative
      @write(~mantHi, 20)
      @write(~mantLo, 32)
    else
      @write(mantHi, 20)
      @write(mantLo, 32)


  unpackNumber: ->
    negative = @read(1) == 0
    exp = @read(11)
    mantHi = @read(20)
    mantLo = @read(32)

    # handle special values first
    if not exp
      if negative and not mantHi
        if mantLo == 1
          return -Infinity
        else if mantLo == 0
          return NaN
      else if not (negative or exp or mantHi or mantLo)
        return 0
    else if exp == 2047 and mantHi == ONE and mantLo == ONE
      return Infinity

    if negative
      exp = 0x7ff - exp

    if negative
      mantHi = 0xfffff - mantHi

    if negative
      mantLo = 0xffffffff - mantLo

    mant = mantHi * P32
    mant += mantLo

    if exp == 0 and (mantHi or mantLo)
      # subnormal
      rv = mant * PSUBN
    else
      rv = mant / PMANT + 1
      rv = Math.pow(2, exp - 1023) * rv

    if negative
      rv = -rv

    return rv


  packUid: (uid) ->
    for i in [0...28]
      @write(parseInt(uid.hex[i], 16), 4)
    return


  packString: (str) ->
    for i in [0...str.length]
      c = str.charCodeAt(i)
      if c < 0x80
        @write(c & 0x7f)
      else if c < 0x0800
        @write(((c >>> 6) & 0x1f) | 0xc0)
        @write((c & 0x3f) | 0x80)
      else if c < 0x10000
        @write(((c >>> 12) & 0x0f) | 0xe0)
        @write(((c >>> 6) & 0x3f) | 0x80)
        @write((c & 0x3f) | 0x80)
    return


  unpackUid: ->
    hex = ''
  
    for i in [0...28]
      hex += @read(4).toString(16)

    return new Uid(hex)


  unpackString: ->
    codes = []

    while true
      if (b = @read()) == 0
        break
      if b < 0x80
        codes.push(b)
      else if b < 0xe0
        codes.push((b & 0x1f) << 6 | (@read() & 0x3f))
      else
        codes.push((b & 0x0f) << 12 | (@read() & 0x3f) << 6 |
            (@read() & 0x3f))

    return String.fromCharCode.apply(null, codes)


  packArray: (array) ->
    for el in array
      @pack(el)
      if typeOf(el) == ObjectType.String
        @write(0) # terminate strings with 0

    @write(0, 4);# special type code(undefined) to mark end of array


  unpackArray: ->
    rv = []

    while (obj = @unpack()) != undef
      rv.push(obj)

    return rv


  pack: (obj) ->
    if obj == null
      @write(1, 4)
    else
      if (type = typeOf(obj)) == ObjectType.Boolean
        if obj.valueOf()
          @write(2, 4)
        else
          @write(3, 4)
      else if type == ObjectType.Number
        @write(4, 4)
        @packNumber(obj)
      else if type == ObjectType.String
        @write(5, 4)
        @packString(obj)
      else if type == ObjectType.Uid
        @write(6, 4)
        @packUid(obj)
      else if type == ObjectType.Array
        @write(15, 4)
        @packArray(obj)
      else
        throw new Error('Invalid object type for key')


  unpack: ->
    type = @read(4)

    if type == 0
      return undef
    else if type == 1
      return null
    else if type == 2
      return true
    else if type == 3
      return false
    else if type == 4
      return @unpackNumber()
    else if type == 5
      return @unpackString()
    else if type == 6
      return @unpackUid()
    else if type == 15
      return @unpackArray()

    throw new Error('Corrupted bit array')


  compareTo: (other) ->
    min = Math.min(@words.length, other.words.length)

    for i in [0...min]
      rv = (@words[i] >>> 0) - (other.words[i] >>> 0)
      if rv < 0
        return -1
      else if rv > 0
        return 1

    rv = @words.length - other.words.length
    if rv == 0
      rv = @offset - other.offset

    return rv


  inspect: ->
    rv = []; bytes = @getBytes(); tmp = []

    while bytes.length
      tmp.push(bytes.shift().toString(16))
      if tmp.length == 4
        rv.push(tmp.join(' '))
        tmp = []

    if tmp.length
      rv.push(tmp.join(' '))

    return rv.join('   ')


  clone: ->
    rv = new BitArray()

    for word in @words
      rv.words.push(word)

    rv.idx = @idx
    rv.offset = @offset

    return rv


  getBytes: ->
    rv = []

    for word in @words
      rv.push(word >>> 24)
      rv.push((word >>> 16) & 0xff)
      rv.push((word >>> 8) & 0xff)
      rv.push(word & 0xff)

    if @offset
      if @offset <= 24 then rv.pop()
      if @offset <= 16 then rv.pop()
      if @offset <= 8 then rv.pop()
    
    return rv


module.exports = BitArray
