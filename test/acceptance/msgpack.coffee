{Uid, ObjectRef} = require('../../src/util')
{encode, decode} = require('../../platform/nodejs/msgpack')


# tests stolen from
# https://github.com/creationix/msgpack-js and
# https://github.com/msgpack/msgpack-javascript


tests = [
  true, false, null,
  0, 1, -1, 2, -2, 4, -4, 6, -6,
  0x10, -0x10, 0x20, -0x20, 0x40, -0x40,
  0x80, -0x80, 0x100, -0x100, 0x200, -0x100,
  0x1000, -0x1000, 0x10000, -0x10000,
  0x20000, -0x20000, 0x40000,-0x40000,
  10, 100, 1000, 10000, 100000, 1000000,
  -10, -100, -1000, -10000, -100000, -1000000,
  1, 1.3, 1.03, 11, 2, -2,
  Number.MAX_VALUE, -Number.MAX_VALUE,
  Number.MIN_VALUE, -Number.MIN_VALUE,
  -0.000001, -0.000025, -11.7, -11, -34345, -34345.1, -34345.001,
  -9007199254740992, 9007199254740992, Infinity, -Infinity,
  '教育漢字', 'hello', 'world', [1,2,3], [], "Tim", 29,
  {name: "Tim", age: 29}, {}, {a: 1, b: 2, c: [1, 2, 3]},
  new Date(), new Date(1), new Date(0),
  new Date(8640000000000000), new Date(-8640000000000000),
  new ObjectRef(2345), new ObjectRef(70000),
  new Uid('00000000000b0005050505050505'),
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/m,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/i,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/mi,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/mg,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/gi,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/gm,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/gmi,
  [ 1, new ObjectRef(3), new ObjectRef(300000),
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/gmi,
    new Date(8640000000000000),
    new Uid('00000000000b0005050505050505'), 5555 ],
]


suite =
  'messagepack encoder/decoder':
    'encodes/decodes each': (done) ->
      next = =>
        if not t.length then return done()
        item = t.pop()
        encoded = encode(item)
        decode(encoded, null, (err, decoded) =>
          expect(decoded).to.deep.eql(item)
          $yield(next))
      t = tests.slice()
      next()


    'encodes/decodes deep object': (done) ->
      obj = name: 'deep', type: {name: 'object', items: tests}
      encoded = encode(obj)
      decode(encoded, null, (err, decoded) =>
        expect(decoded).to.deep.eql(obj)
        done())

    'can decodes object split in multiple buffers': (done) ->
      # encoded data:
      # idx: 00     01   02 03 04 05 |06   07 08 09 10 11 12 |13   14 15 16 |17
      # hex: 82     a4   6e 61 6d 65 |a6   74 68 69 61 67 6f |a3   61 67 65 |1c
      #      map    str  name        |str  thiago            |str  age      |28
      bytes = [0x82, 0xa4, 0x6e, 0x61, 0x6d, 0x65, 0xa6, 0x74, 0x68, 0x69,
        0x61, 0x67, 0x6f, 0xa3, 0x61, 0x67, 0x65, 0x1c]
      enc = new Buffer(bytes)
      encoded = [
        enc.slice(0, 4)
        enc.slice(4, 9)
        enc.slice(9, 13)
        enc.slice(13, 14)
        enc.slice(14, enc.length)
      ]
      # this array represents the number of bytes requested by the decoder
      # function after each buffer limit
      counts = [
        2, # cut at 'na' of 'name', 2 chars remaining
        4, # cut at 'th' or 'thiago', 4 chars remaining
        1, # cut at the end of previous string, so request 1 byte for type code
        3, # cut before 'age' string, 3 chars remaining
      ]
      i = 0
      decode(encoded[i], (count, cb) =>
        expect(count).to.eql(counts[i])
        cb(null, encoded[++i])
      , (err, decoded) =>
        expect(decoded).to.deep.eql({name: 'thiago', age: 28})
        done())

    # these two tests are slow and should only be ran when changes
    # are made to the 'msgpack' module
    'skip:10000 keys map': (done) ->
      @timeout(10000)
      encoded = encode(solid10000)
      decode(encoded, null, (err, decoded) =>
        expect(decoded).to.deep.eql(solid10000)
        done())

    'skip:100000 keys map': (done) ->
      @timeout(600000)
      encoded = encode(solid100000)
      decode(encoded, null, (err, decoded) =>
        expect(decoded).to.deep.eql(solid100000)
        done())


run(suite)
