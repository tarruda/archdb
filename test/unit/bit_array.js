describe('BitArray', function() {
  var array;

  beforeEach(function () {
    array = new BitArray();
  });

  it('starts with a zero-length array', function() {
    expect(array.inspect()).to.equal('');
  });

  it('can write chunks shorter than one byte and across words', function() {
    array.write(4, 4);
    expect(array.inspect()).to.equal('40');
    array.write(0xcafebabe, 32);
    expect(array.inspect()).to.equal('4c af eb ab   e0');
    expect(array.read(4)).to.equal(4);
    expect(array.read(32)).to.equal(0xcafebabe);
  });

  it('inserts one byte by default', function() {
    array.write(1);
    array.write(0);
    array.write(1);
    expect(array.inspect()).to.equal('1 0 1');
    expect(array.read()).to.equal(1);
    expect(array.read()).to.equal(0);
    expect(array.read()).to.equal(1);
  });

  it('can rewind the position', function() {
    array.write(0xcafebabe, 32);
    expect(array.inspect()).to.equal('ca fe ba be');
    array.rewind(16);
    expect(array.inspect()).to.equal('ca fe');
    array.write(0xcafebabe, 32);
    expect(array.inspect()).to.equal('ca fe ca fe   ba be');
    array.rewind(4);
    expect(array.inspect()).to.equal('ca fe ca fe   ba b0');
    array.rewind(8);
    expect(array.inspect()).to.equal('ca fe ca fe   b0');
    array.rewind(16);
    expect(array.inspect()).to.equal('ca fe c0');
  });

  it('accepts bit chunks of lengths from 1 to 32', function() {
    array.write(1, 1);
    array.write(0, 1);
    array.write(1, 1);
    array.write(1, 1);
    expect(array.inspect()).to.equal('b0');
    array.write(3, 4);
    array.write(7, 4);
    expect(array.inspect()).to.equal('b3 70');
    array.write(1, 1);
    expect(array.inspect()).to.equal('b3 78');
    array.write((1<<10) - 1, 10);
    expect(array.inspect()).to.equal('b3 7f fe');
    array.write((1<<10) - 1, 10);
    expect(array.inspect()).to.equal('b3 7f ff ff   80');
    array.write(0xffffffff, 32);
    expect(array.inspect()).to.equal('b3 7f ff ff   ff ff ff ff   80');
    expect(array.read(1)).to.equal(1);
    expect(array.read(1)).to.equal(0);
    expect(array.read(1)).to.equal(1);
    expect(array.read(1)).to.equal(1);
    expect(array.read(4)).to.equal(3);
    expect(array.read(4)).to.equal(7);
    expect(array.read(1)).to.equal(1);
    expect(array.read(10)).to.equal(1023);
    expect(array.read(10)).to.equal(1023);
    expect(array.read(32)).to.equal(0xffffffff);
  });

  describe('encoding/decoding', function() {

    describe('numbers', function() {

      it('NaN', function() {
        array.packNumber(NaN);
        expect(array.inspect()).to.equal('0 0 0 0   0 0 0 0');
        expect(isNaN(array.unpackNumber())).to.be.true;
      });

      it('Infinity', function() {
        array.packNumber(Infinity);
        expect(array.inspect()).to.equal('ff ff ff ff   ff ff ff ff');
        expect(array.unpackNumber()).to.equal(Infinity);
      });

      it('0', function() {
        array.packNumber(0);
        expect(array.inspect()).to.equal('80 0 0 0   0 0 0 0');
        expect(array.unpackNumber()).to.equal(0);
      });

      it('0.0004', function() {
        array.packNumber(0.0004);
        expect(array.inspect()).to.equal('bf 3a 36 e2   eb 1c 43 2d');
        expect(array.unpackNumber()).to.equal(0.0004);
      });

      it('5', function() {
        array.packNumber(5);
        expect(array.inspect()).to.equal('c0 14 0 0   0 0 0 0');
        expect(array.unpackNumber()).to.equal(5);
      });

      it('8', function() {
        array.packNumber(8);
        expect(array.inspect()).to.equal('c0 20 0 0   0 0 0 0');
        expect(array.unpackNumber()).to.equal(8);
      });

      it('54.1', function() {
        array.packNumber(54.1);
        expect(array.inspect()).to.equal('c0 4b c cc   cc cc cc cd');
        expect(array.unpackNumber()).to.equal(54.1);
      });

      it('16000', function() {
        array.packNumber(16000);
        expect(array.inspect()).to.equal('c0 cf 40 0   0 0 0 0');
        expect(array.unpackNumber()).to.equal(16000);
      });

      it('32534.65435', function() {
        array.packNumber(32534.65435);
        expect(array.inspect()).to.equal('c0 df c5 a9   e0 de d2 89');
        expect(array.unpackNumber()).to.equal(32534.65435);
      });

      it('Max value', function() {
        array.packNumber(Number.MAX_VALUE);
        expect(array.inspect()).to.equal('ff ef ff ff   ff ff ff ff');
        expect(array.unpackNumber()).to.equal(Number.MAX_VALUE);
      });

      it('Min value', function() {
        array.packNumber(Number.MIN_VALUE);
        expect(array.inspect()).to.equal('80 0 0 0   0 0 0 1');
        expect(array.unpackNumber()).to.equal(Number.MIN_VALUE);
      });

      it('-0.0004', function() {
        array.packNumber(-0.0004);
        expect(array.inspect()).to.equal('40 c5 c9 1d   14 e3 bc d2');
        expect(array.unpackNumber()).to.equal(-0.0004);
      });

      it('-Infinity', function() {
        array.packNumber(-Infinity);
        expect(array.inspect()).to.equal('0 0 0 0   0 0 0 1');
        expect(array.unpackNumber()).to.equal(-Infinity);
      });

      it('-0', function() {
        array.packNumber(-0);
        expect(array.inspect()).to.equal('80 0 0 0   0 0 0 0');
        expect(array.unpackNumber()).to.equal(0);
      });

      it('-5', function() {
        array.packNumber(-5);
        expect(array.inspect()).to.equal('3f eb ff ff   ff ff ff ff');
        expect(array.unpackNumber()).to.equal(-5);
      });

      it('-8', function() {
        array.packNumber(-8);
        expect(array.inspect()).to.equal('3f df ff ff   ff ff ff ff');
        expect(array.unpackNumber()).to.equal(-8);
      });

      it('-54.1', function() {
        array.packNumber(-54.1);
        expect(array.inspect()).to.equal('3f b4 f3 33   33 33 33 32');
        expect(array.unpackNumber()).to.equal(-54.1);
      });

      it('-16000', function() {
        array.packNumber(-16000);
        expect(array.inspect()).to.equal('3f 30 bf ff   ff ff ff ff');
        expect(array.unpackNumber()).to.equal(-16000);
      });

      it('-32534.65435', function() {
        array.packNumber(-32534.65435);
        expect(array.inspect()).to.equal('3f 20 3a 56   1f 21 2d 76');
        expect(array.unpackNumber()).to.equal(-32534.65435);
      });

      it('-Max value', function() {
        array.packNumber(-Number.MAX_VALUE);
        expect(array.inspect()).to.equal('0 10 0 0   0 0 0 0');
        expect(array.unpackNumber()).to.equal(-Number.MAX_VALUE);
      });

      it('-Min value', function() {
        array.packNumber(-Number.MIN_VALUE);
        expect(array.inspect()).to.equal('7f ff ff ff   ff ff ff fe');
        expect(array.unpackNumber()).to.equal(-Number.MIN_VALUE);
      });
    });

    describe('uids', function() {
      it('00000000000b000505050505', function() {
        array.packUid(new Uid('00000000000b000505050505'));
        expect(array.inspect()).to.equal('0 0 0 0   0 b 0 5   5 5 5 5');
        expect(array.unpackUid().hex).to.eql('00000000000b000505050505');
      });
    });

    describe('strings', function() {
      it('abcde', function() {
        array.packString('abcde');
        expect(array.inspect()).to.equal('61 62 63 64   65');
        expect(array.unpackString()).to.equal('abcde');
      });

      it('abcdé', function() {
        array.packString('abcdé');
        expect(array.inspect()).to.equal('61 62 63 64   c3 a9');
        expect(array.unpackString()).to.equal('abcdé');
      });

      it('abçdé', function() {
        array.packString('abçdé');
        expect(array.inspect()).to.equal('61 62 c3 a7   64 c3 a9');
        expect(array.unpackString()).to.equal('abçdé');
      });

      it('教育漢字', function() {
        array.packString('教育漢字');
        expect(array.inspect()).to.equal(
          'e6 95 99 e8   82 b2 e6 bc   a2 e5 ad 97');
        expect(array.unpackString()).to.equal('教育漢字');
      });
    });
  });

  it('can pack/unpack objects', function() {
    expect(pack(null).unpack()).to.be.null;
    expect(pack(false).unpack()).to.be.false;
    expect(pack(true).unpack()).to.be.true;
    expect(pack(54.1).unpack()).to.eql(54.1);
    expect(pack('testing').unpack('testing')).to.eql('testing');
    expect(pack([null, false, true, 54.1]).unpack('testing')).to.deep.eql(
      [null, false, true, 54.1]);
    expect(pack(['abc','def', '教', 1, 2, true, 'jkl']).unpack()).to.deep.eql(
      ['abc', 'def', '教', 1, 2, true, 'jkl'])
  });


  describe('pack and compare keys', function() {
    var keys;

    beforeEach(function () {
      keys = [];
    });

    it('numbers', function() {
      expect(sorted(
        1, 1.3, 1.03, 11, 2, -2,
        Number.MAX_VALUE, -Number.MAX_VALUE,
        Number.MIN_VALUE, -Number.MIN_VALUE,
        -0.000001, -0.000025, -11.7, -11, -34345, -34345.1, -34345.001,
        -9007199254740992, 9007199254740992,
        Infinity, -Infinity
      )).to.deep.eql([
        -Infinity,
        -Number.MAX_VALUE, -9007199254740992, -34345.1, -34345.001, -34345,
        -11.7, -11, -2, -0.000025, -0.000001, -Number.MIN_VALUE,
        Number.MIN_VALUE, 1, 1.03, 1.3, 2, 11, 9007199254740992,
        Number.MAX_VALUE,
        Infinity
      ])
    });

    it('strings', function() {
      expect(sorted('1', '2', '11')).to.deep.eql(['1', '11', '2']);
    });

    it('arrays', function() {
        var k1 = ['Facebook', 1, -12345], k2 = ['Facebook', 1, -1234];
        var k3 = ['Facebook', 2, -123456], k4 = ['Google', -1, 12345];
        var k5 = ['Google', 0, 1234], k6 = ['Microsoft', -10, Date.now()];
        expect(sorted(k6, k5, k4, k3, k2, k1)).to.deep.eql([
          k1, k2, k3, k4, k5, k6]);
    });

    it ('mixed types', function() {
      expect(sorted(7, null, false, true, 'abc', ['abc'])).to.deep.eql([
        null, true, false, 7, 'abc', ['abc']
      ]);
    });

    function sorted() {
      for (var i = 0;i < arguments.length; i++) {
        keys.push(pack(arguments[i]));
      }
      return keys.sort(function(k1, k2) {
        return k1.compareTo(k2);
      }).map(function(k) {
        return k.unpack(); 
      });
    }
  });


  function pack(obj) {
    var rv = new BitArray(obj);
    return rv;
  }
});
