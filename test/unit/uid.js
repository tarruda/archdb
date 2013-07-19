describe('UidGenerator', function() {
  describe('generate', function() {
    var suffix = '05', time = 11;
    var generator;

    beforeEach(function () {
      generator = new UidGenerator(suffix);
    });

    it('accepts timestamp argument', function() {
      expect(generator.generate(time).hex).to.equal('00000000000b0005');
    });

    it('increment counter (byte 7) for ids generated on same ms', function() {
      expect(generator.generate(time).hex).to.equal('00000000000b0005');
      expect(generator.generate(time).hex).to.equal('00000000000b0105');
      expect(generator.generate(time).hex).to.equal('00000000000b0205');
    });

    it('throws when more than 256 ids are generated on same ms', function() {
      for (var i=0; i < 256; i++) generator.generate(time);
      expect(function() { generator.generate(time); }).to.throw(Error);
    });
  });
});

describe('Uid getTime method', function() {
  it('returns timestamp the instance was generated', function() {
    expect(new Uid('00000000000f0609').getTime()).to.equal(15);
  });
});

