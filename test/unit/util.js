describe('JobQueue', function() {
  var queue;

  beforeEach(function () {
    queue = new JobQueue();
  });

  it('runs async jobs serially', function(done) {
    var i = 0;
    function cb1(arg) { expect(arg).to.eql('one'); i++; }
    function job1(cb) { expect(i).to.eql(0);
      setImmediate(function() {
        i++;
        cb('one');
      });
    }
    function job2(cb) { expect(i).to.eql(2); setImmediate(cb); i++; }
    function job3(cb) { expect(i).to.eql(3); cb(); }

    queue.add(cb1, job1);
    queue.add(null, job2);
    queue.add(done, job3);
  });
});

describe('Emitter', function() {
  var e, args;

  function cb() {
    args = args.concat(Array.prototype.slice.call(arguments));
  }

  beforeEach(function () {
    e = new Emitter();
    args = [];
    e.on('ev', cb);
  });

  it('subscribe', function() {
    e.on('ev', function() { args = args.concat([4, 5, 6]); });
    e.on('ev', function() { args = args.concat([7, 8, 9]); });
    e.emit('ev', 1, 2, 3);
    expect(args).to.deep.eql([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('unsubscribe', function() {
    e.on('ev', function() { args = args.concat([4, 5, 6]); });
    e.on('ev', function() { args = args.concat([7, 8, 9]); });
    e.off('ev', cb)
    e.emit('ev', 1, 2, 3);
    expect(args).to.deep.eql([4, 5, 6, 7, 8, 9]);
  });

  it('subscribe once', function() {
    e.once('ev', function() { args = args.concat([4, 5, 6]); });
    e.emit('ev', 1, 2, 3);
    expect(args).to.deep.eql([1, 2, 3, 4, 5, 6]);
    e.emit('ev', 1, 2, 3);
    expect(args).to.deep.eql([1, 2, 3, 4, 5, 6, 1, 2, 3]);
  });

  it('subscribe once multiple times on empty emitter', function() {
    var e = new Emitter();
    e.once('ev', function() { args = args.concat([4, 5, 6]); });
    e.once('ev', function() { args = args.concat([2, 3, 4]); });
    e.emit('ev');
    expect(args).to.deep.eql([4, 5, 6, 2, 3, 4]);
    e.emit('ev');
    expect(args).to.deep.eql([4, 5, 6, 2, 3, 4]);
  });
});

describe('LinkedList', function() {
  var l;

  beforeEach(function () {
    l = new LinkedList();
    l.push(1);
    l.push(2);
    l.push(3);
    l.push(4);
  });

  it('push', function() {
    expect(items()).to.deep.eql([1, 2, 3, 4]);
  });

  it('shift', function() {
    var shifted = [l.shift(), l.shift(), l.shift(), l.shift()];
    expect(shifted).to.deep.eql([1, 2, 3, 4]);
    expect(items()).to.deep.eql([]);
    expect(l.head).to.be.null;
    expect(l.tail).to.be.null;
  });

  it('remove', function() {
    l.remove(2);
    expect(items()).to.deep.eql([1, 3, 4]);
    l.remove(1);
    expect(items()).to.deep.eql([3, 4]);
    l.remove(4);
    expect(items()).to.deep.eql([3]);
    l.remove(3);
    expect(items()).to.deep.eql([]);
    expect(l.head).to.be.null;
    expect(l.tail).to.be.null;
  });

  function items() {
    var rv = [];

    l.each(function(i) { rv.push(i); });
  
    return rv;
  }
});

describe('Normalization/denormalization', function() {
  var n = normalize, d = denormalize;

  it('normalize shallow object ref', function() {
    expect(n(new ObjectRef('ref'))).to.eql('!orref');
  });

  it('denormalize shallow object ref', function() {
    expect(d('!orref')).to.eql(new ObjectRef('ref'));
  });

  it('normalize shallow uid', function() {
    expect(n(new Uid('00000000000b0005050505050505'))).to.eql(
      '!id00000000000b0005050505050505');
  });

  it('denormalize shallow uid', function() {
    expect(d('!id00000000000b0005050505050505')).to.eql(
      new Uid('00000000000b0005050505050505'));
  });

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

describe('UidGenerator', function() {
  describe('generate', function() {
    var suffix = '05050505050505', time = 11;
    var generator;

    beforeEach(function () {
      generator = new UidGenerator(suffix);
    });

    it('accepts timestamp argument', function() {
      expect(generator.generate(time).hex).to.equal(
        '00000000000b0005050505050505');
    });

    it('increment counter (byte 7) for ids generated on same ms', function() {
      expect(generator.generate(time).hex).to.equal(
        '00000000000b0005050505050505');
      expect(generator.generate(time).hex).to.equal(
        '00000000000b0105050505050505');
      expect(generator.generate(time).hex).to.equal(
        '00000000000b0205050505050505');
    });

    it('throws when more than 256 ids are generated on same ms', function() {
      for (var i=0; i < 256; i++) generator.generate(time);
      expect(function() { generator.generate(time); }).to.throw(Error);
    });
  });
});

describe('Uid', function() {
  it('getTime returns timestamp the instance was generated', function() {
    expect(new Uid('00000000000f0609090909090909').getTime()).to.equal(15);
  });
});


