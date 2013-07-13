describe('Normalization/denormalization', function() {
  var n = normalize, d = denormalize;

  it('normalize shallow date', function() {
    expect(n(new Date(343434))).to.eql('!dt53d8a');
  });

  it('denormalize shallow date', function() {
    expect(d('!dtfff1ff')).to.eql(new Date(0xfff1fF));
  });

  it('normalize deep date', function() {
    expect(n({a: [{c: new Date(343434)}]})).to.deep.eql(
      {a: [{c: '!dt53d8a'}]});
  });

  it('denormalize deep date', function() {
    expect(d({a: [{c: '!dt53d8a'}]})).to.deep.eql(
      {a: [{c: new Date(343434)}]});
  });

  it('normalize shallow regexp', function() {
    expect(n(/abc\d/)).to.eql('!re,abc\\d');
  });

  it('denormalize shallow regexp', function() {
    var re = d('!re,abc\\d');
    expect(re.source).to.eql('abc\\d');
    expect(re.multiline).to.be.false;
    expect(re.global).to.be.false;
    expect(re.ignoreCase).to.be.false;
  });

  it('normalize deep regexp', function() {
    expect(n([{a:[/abc\d/ig]}])).to.eql([{a:['!regi,abc\\d']}]);
  });

  it('denormalize deep regexp', function() {
    var re = d([[2,'!reim,abc\\d'],1]);
    expect(re[0][1].source).to.eql('abc\\d');
    expect(re[0][1].multiline).to.be.true;
    expect(re[0][1].global).to.be.false;
    expect(re[0][1].ignoreCase).to.be.true;
  });

  it('normalize strings', function() {
    expect(n(['abc'])).to.eql(['abc']);
    expect(n(['!abc'])).to.eql(['!!abc']);
    expect(n('!re,abc\\d')).to.eql('!!re,abc\\d');
  });

  it('denormalize strings', function() {
    expect(d(['abc'])).to.eql(['abc']);
    expect(d(['!!abc'])).to.eql(['!abc']);
    expect(d('!!re,abc\\d')).to.eql('!re,abc\\d');
  });
});

