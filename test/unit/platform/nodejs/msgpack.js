// tests stolen from
// https://github.com/creationix/msgpack-js and
// https://github.com/msgpack/msgpack-javascript

describe('messagepack encoder/decoder', function() {
  var Uid = util.Uid;

  it('encodes/decodes each', function(done) {
    function next() {
      if (!t.length) return done();
      var item = t.pop();
      var encoded = msgpack.encode(item);
      msgpack.decode(encoded, null, function(err, decoded) {
        expect(decoded).to.deep.eql(item);
        yield(next);
      });
    };
    var t = tests.slice();
    next();
  });

  it('encodes/decodes deep object', function(done) {
    var obj = {name: 'deep', type: {name: 'object', items: tests}};
    var encoded = msgpack.encode(obj);
    msgpack.decode(encoded, null, function(err, decoded) {
      expect(decoded).to.deep.eql(obj);
      done();
    });
  });

  it('can decodes object split in multiple buffers', function(done) {
    /*
    encoded data:
    idx: 00     01   02 03 04 05 |06   07 08 09 10 11 12 |13   14 15 16 |17
    hex: 82     a4   6e 61 6d 65 |a6   74 68 69 61 67 6f |a3   61 67 65 |1c
         map    str  name        |str  thiago            |str  age      |28
    */
    var bytes = [0x82, 0xa4, 0x6e, 0x61, 0x6d, 0x65, 0xa6, 0x74, 0x68, 0x69,
      0x61, 0x67, 0x6f, 0xa3, 0x61, 0x67, 0x65, 0x1c];
    var enc = new Buffer(bytes)
    var encoded = [
      enc.slice(0, 4),
      enc.slice(4, 9),
      enc.slice(9, 13),
      enc.slice(13, 14),
      enc.slice(14, enc.length),
    ];
    // this array represents the number of bytes requested by the decoder
    // function after each buffer limit
    var counts = [
      2, // cut at 'na' of 'name', 2 chars remaining
      4, // cut at 'th' or 'thiago', 4 chars remaining
      1, // cut at the end of previous string, so request 1 byte for type code
      3, // cut before 'age' string, 3 chars remaining
    ];
    var i = 0;
    msgpack.decode(encoded[i], function(count, cb) {
      expect(count).to.eql(counts[i]);
      cb(null, encoded[++i]);
    }, function(err, decoded) {
      expect(decoded).to.deep.eql({name: 'thiago', age: 28});
      done();
    });
  });

  // these two tests are slow and should only be ran when changes
  // are made to the 'msgpack' module
  it.skip('10000 keys map', function(done) {
    this.timeout(10000);
    var encoded = msgpack.encode(solid10000);
    msgpack.decode(encoded, null, function(err, decoded) {
      expect(decoded).to.deep.eql(solid10000);
      done();
    });
  });

  it.skip('100000 keys map', function(done) {
    this.timeout(600000);
    var encoded = msgpack.encode(solid100000);
    msgpack.decode(encoded, null, function(err, decoded) {
      expect(decoded).to.deep.eql(solid100000);
      done();
    });
  });

  var tests = [
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
  ];
});


