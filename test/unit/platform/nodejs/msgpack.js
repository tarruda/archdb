// tests stolen from
// https://github.com/creationix/msgpack-js and
// https://github.com/msgpack/msgpack-javascript

describe('messagepack encoder/decoder', function() {
  it('encodes/decodes correctly', function() {
    tests.forEach(function(item) {
      var encoded = new msgpack.Encoder().encode(item);
      var decoded = new msgpack.Decoder().decode(encoded);
      expect(decoded).to.deep.eql(item);
    });
    var obj = {name: 'deep', type: {name: 'object', items: tests}};
    var encoded = new msgpack.Encoder().encode(obj);
    var decoded = new msgpack.Decoder().decode(encoded);
    expect(decoded).to.deep.eql(obj);
  });

  // these two tests are slow and should only be ran when changes
  // are made to the 'msgpack' module
  it.skip('10000 keys map', function() {
    var encoded = new msgpack.Encoder().encode(solid10000);
    var decoded = new msgpack.Decoder().decode(encoded);
    expect(decoded).to.deep.eql(solid10000);
  });

  it.skip('100000 keys map', function() {
    var encoded = new msgpack.Encoder().encode(solid100000);
    var decoded = new msgpack.Decoder().decode(encoded);
    expect(decoded).to.deep.eql(solid100000);
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

