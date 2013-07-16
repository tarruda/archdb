// all the tests here will use numbers as key, so we have to implement
// the 'IndexKey' interface on the number prototype;
Number.prototype.compareTo = function(other) {
  return this - other;
};
Number.prototype.normalize = function() {
  return this;
};

describe('AvlTree', function() {
  var uid = 1;
  function FakeDbStorage() {
    this.data = {};
    this.rootId = null;
  }
  FakeDbStorage.prototype.get = function(id, cb) {
    cb(null, this.data[id]);
  };
  FakeDbStorage.prototype.save = function(obj, cb) {
    var id = (uid++).toString();
    this.data[id] = obj;
    cb(null, id);
  };

  function inspect(tree) {
    // level-order iteration for inspecting/debugging the tree
    var rv = [], q, node;

    if (!tree.root) return rv;

    q = [];
    q.push(tree.root);
    while (q.length) {
      node = q.shift();
      rv.push(node.key);
      if (node.left) q.push(node.left);
      if (node.right) q.push(node.right);
    }
  
    return rv;
  }
  function insert(tree, from, to) {
    for (var i = from;i <= to;i++) {
      tree.set(i, i, function() {});
    }
  }

  function generateAvlSuite(title, ins) {
    var tree, dbStorage;

    beforeEach(function() {
      dbStorage = new FakeDbStorage();
      tree = new AvlTree(dbStorage);
    });

    describe(title, function() {
      describe('insert', function() {
        it('1-3', function() {
          ins(tree, 1, 3);
          expect(inspect(tree)).to.deep.eql([
            2, 
          1,  3 
          ]);
        });

        it('1-5', function() {
          ins(tree, 1, 5);
          expect(inspect(tree)).to.deep.eql([
              2, 
          1,      4,
                3,  5
          ]);
        });

        it('1-6', function() {
          ins(tree, 1, 6);
          expect(inspect(tree)).to.deep.eql([
                4, 
            2,      5,
          1,  3,      6
          ]);
        });

        it('1-7', function() {
          ins(tree, 1, 7);
          expect(inspect(tree)).to.deep.eql([
                4, 
            2,      6,
          1,  3,  5,  7
          ]);
        });

        it('1-9', function() {
          ins(tree, 1, 9);
          expect(inspect(tree)).to.deep.eql([
                  4, 
             2,         6,
          1,    3,   5,    8,
                         7,  9
          ]);
        });

        it('1-10', function() {
          ins(tree, 1, 10);
          expect(inspect(tree)).to.deep.eql([
                    4, 
             2,             8,
          1,    3,      6,      9,
                      5,  7,      10
          ]);
        });

        it('1-11', function() {
          ins(tree, 1, 11);
          expect(inspect(tree)).to.deep.eql([
                    4, 
             2,             8,
          1,    3,      6,      10,
                      5,  7,   9, 11
          ]);
        });

        it('1-12', function() {
          ins(tree, 1, 12);
          expect(inspect(tree)).to.deep.eql([
                        8, 
                4,             10,
            2,      6,      9,     11,
          1,  3,  5,  7,             12
          ]);
        });

        it('1-13', function() {
          ins(tree, 1, 13);
          expect(inspect(tree)).to.deep.eql([
                        8, 
                4,             10,
            2,      6,      9,     12,
          1,  3,  5,  7,         11, 13
          ]);
        });

        it('1-14', function() {
          ins(tree, 1, 14);
          expect(inspect(tree)).to.deep.eql([
                        8, 
                4,               12,
            2,      6,      10,       13,
          1,  3,  5,  7,   9, 11,       14
          ]);
        });

        it('1-15', function() {
          ins(tree, 1, 15);
          expect(inspect(tree)).to.deep.eql([
                         8, 
                4,               12,
            2,      6,      10,       14,
          1,  3,  5,  7,   9, 11,   13, 15
          ]);
        });

        it('1-16', function() {
          ins(tree, 1, 16);
          expect(inspect(tree)).to.deep.eql([
                         8, 
                4,               12,
            2,      6,      10,       14,
          1,  3,  5,  7,   9, 11,   13, 15,
                                          16 
          ]);
        });

        it('1-17', function() {
          ins(tree, 1, 17);
          expect(inspect(tree)).to.deep.eql([
                         8, 
                4,               12,
            2,      6,      10,        14,
          1,  3,  5,  7,   9, 11,   13,    16,
                                         15, 17 
          ]);
        });

        it('1-18', function() {
          ins(tree, 1, 18);
          expect(inspect(tree)).to.deep.eql([
                         8, 
                4,               12,
            2,      6,      10,        16,
          1,  3,  5,  7,   9, 11,   14,    17,
                                  13, 15,    18 
          ]);
        });

        it('1-19', function() {
          ins(tree, 1, 19);
          expect(inspect(tree)).to.deep.eql([
                         8, 
                4,               12,
            2,      6,      10,         16,
          1,  3,  5,  7,   9, 11,   14,    18,
                                  13, 15, 17, 19 
          ]);
        });

        it('1-20', function() {
          ins(tree, 1, 20);
          expect(inspect(tree)).to.deep.eql([
                           8, 
                4,                      16,
            2,      6,            12,            18,
          1,  3,  5,  7,      10,     14,     17,    19,
                             9, 11, 13, 15,            20 
          ]);
        });

        it('1-21', function() {
          ins(tree, 1, 21);
          expect(inspect(tree)).to.deep.eql([
                           8, 
                4,                      16,
            2,      6,            12,            18,
          1,  3,  5,  7,      10,     14,     17,     20,
                             9, 11, 13, 15,         19, 21 
          ]);
        });

        it('1-22', function() {
          ins(tree, 1, 22);
          expect(inspect(tree)).to.deep.eql([
                           8, 
                4,                      16,
            2,      6,            12,              20,
          1,  3,  5,  7,      10,     14,      18,     21,
                             9, 11, 13, 15,  17, 19,     22 
          ]);
        });

        it('1-23', function() {
          ins(tree, 1, 23);
          expect(inspect(tree)).to.deep.eql([
                           8, 
                4,                      16,
            2,      6,            12,              20,
          1,  3,  5,  7,      10,     14,      18,      22,
                             9, 11, 13, 15,  17, 19,  21, 23
          ]);
        });

        it('1-24', function() {
          ins(tree, 1, 24);
          expect(inspect(tree)).to.deep.eql([
                                        16, 
                        8,                             20,
                4,            12,              18,            22,
            2,      6,    10,     14,      17,     19,    21,     23,
          1,  3,  5,  7, 9, 11,  13, 15,                             24 
          ]);
        });
      });
    });
  }

  generateAvlSuite('using transaction cache', insert);
});

describe('AvlNode', function() {
  var node;

  beforeEach(function() {
    node = new AvlNode(5, 'value');
    node.leftId = 'abc';
    node.rightId = 'def';
  });

  it('has IndexNode type', function() {
    expect(node.getType()).to.eql(DbObjectType.IndexNode);
  });

  it('normalizes to a simple array', function() {
    expect(node.normalize()).to.deep.eql(['abc', 5, 'def', 'value']);
  });

  it('has attributes correctly set', function() {
    expect(node.key).to.eql(5);
    expect(node.valueId).to.eql('value');
    expect(node.leftId).to.eql('abc');
    expect(node.rightId).to.eql('def');
  });
});
