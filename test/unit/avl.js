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
    for (var i = from;from < to ? i <= to : i >= to;from < to ? i++ : i--) {
      tree.set(i, (i * 2).toString(), function() {});
    }
  }
  function del(tree, from, to) {
    for (var i = from;from < to ? i <= to : i >= to;from < to ? i++ : i--) {
      tree.del(i, function() {});
    }
  }
  function lookup(tree, key) {
    var rv;
    tree.get(key, function(err, value) { rv = value; });
    return rv;
  }

  function generateAvlSuite(title, ins) {
    var tree, dbStorage;

    beforeEach(function() {
      dbStorage = new FakeDbStorage();
      tree = new AvlTree(dbStorage);
    });

    describe(title, function() {
      describe('descending insert rotations', function() {
        it('24-22', function() {
          ins(tree, 24, 22);
          expect(inspect(tree)).to.deep.eql([
                                       23, 
                       22,                            24
          ]);
        });

        it('24-20', function() {
          ins(tree, 24, 20);
          expect(inspect(tree)).to.deep.eql([
                                       23, 
                       21,                            24,
               20,             22
          ]);
        });

        it('24-19', function() {
          ins(tree, 24, 19);
          expect(inspect(tree)).to.deep.eql([
                                       21, 
                       20,                            23,
               19,                            22,             24
          ]);
        });

        it('24-18', function() {
          ins(tree, 24, 18);
          expect(inspect(tree)).to.deep.eql([
                                       21, 
                       19,                            23,
               18,             20,            22,             24
          ]);
        });

        it('24-16', function() {
          ins(tree, 24, 16);
          expect(inspect(tree)).to.deep.eql([
                                       21, 
                       19,                            23,
               17,             20,            22,             24,
            16,   18
          ]);
        });

        it('24-15', function() {
          ins(tree, 24, 15);
          expect(inspect(tree)).to.deep.eql([
                                       21, 
                       17,                            23,
               16,             19,            22,             24,
            15,             18,   20
          ]);
        });

        it('24-15', function() {
          ins(tree, 24, 15);
          expect(inspect(tree)).to.deep.eql([
                                       21, 
                       17,                            23,
               16,             19,            22,             24,
            15,             18,   20
          ]);
        });

        it('24-14', function() {
          ins(tree, 24, 14);
          expect(inspect(tree)).to.deep.eql([
                                       21, 
                       17,                             23,
               15,              19,            22,             24,
            14,   16,        18,   20
          ]);
        });

        it('24-13', function() {
          ins(tree, 24, 13);
          expect(inspect(tree)).to.deep.eql([
                                       17, 
                       15,                             21,
               14,             16,              19,          23,
            13,                              18,   20,    22,   24
          ]);
        });

        it('24-12', function() {
          ins(tree, 24, 12);
          expect(inspect(tree)).to.deep.eql([
                                       17, 
                       15,                             21,
               13,             16,              19,          23,
            12,   14,                        18,   20,    22,   24
          ]);
        });

        it('24-11', function() {
          ins(tree, 24, 11);
          expect(inspect(tree)).to.deep.eql([
                                       17, 
                       13,                             21,
               12,             15,              19,          23,
            11,             14,   16,        18,   20,    22,   24
          ]);
        });

        it('24-10', function() {
          ins(tree, 24, 10);
          expect(inspect(tree)).to.deep.eql([
                                       17, 
                       13,                             21,
               11,             15,              19,          23,
            10,   12,       14,   16,        18,   20,    22,   24
          ]);
        });

        it('24-8', function() {
          ins(tree, 24, 8);
          expect(inspect(tree)).to.deep.eql([
                                       17, 
                       13,                             21,
               11,             15,              19,          23,
             9,   12,       14,   16,        18,   20,    22,   24,
           8, 10
          ]);
        });

        it('24-7', function() {
          ins(tree, 24, 7);
          expect(inspect(tree)).to.deep.eql([
                                       17, 
                       13,                             21,
                9,             15,              19,          23,
             8,   11,       14,   16,        18,   20,    22,   24,
           7,   10, 12
          ]);
        });

        it('24-6', function() {
          ins(tree, 24, 6);
          expect(inspect(tree)).to.deep.eql([
                                        17, 
                        13,                             21,
                9,              15,              19,          23,
            7,      11,      14,   16,        18,   20,    22,   24,
          6,  8,  10, 12
          ]);
        });

        it('24-5', function() {
          ins(tree, 24, 5);
          expect(inspect(tree)).to.deep.eql([
                                         17, 
                          9,                             21,
                7,               13,               19,          23,
            6,      8,       11,     15,        18,   20,    22,   24,
          5,               10, 12, 14, 16
          ]);
        });

        it('24-4', function() {
          ins(tree, 24, 4);
          expect(inspect(tree)).to.deep.eql([
                                         17, 
                          9,                             21,
                7,               13,               19,          23,
            5,      8,       11,     15,        18,   20,    22,   24,
          4,  6,           10, 12, 14, 16
          ]);
        });

        it('24-3', function() {
          ins(tree, 24, 3);
          expect(inspect(tree)).to.deep.eql([
                                         17, 
                          9,                             21,
                5,               13,               19,          23,
            4,      7,       11,     15,        18,   20,    22,   24,
          3,      6,  8,   10, 12, 14, 16
          ]);
        });

        it('24-2', function() {
          ins(tree, 24, 2);
          expect(inspect(tree)).to.deep.eql([
                                         17, 
                          9,                             21,
                5,               13,               19,          23,
            3,      7,       11,     15,        18,   20,    22,   24,
          2,  4,  6,  8,   10, 12, 14, 16
          ]);
        });

        it('24-1', function() {
          ins(tree, 24, 1);
          expect(inspect(tree)).to.deep.eql([
                                         9, 
                          5,                             17,
                3,                 7,             13,             21,
            2,      4,         6,      8,     11,     15,     19,     23, 
          1,                                10, 12, 14, 16, 18, 20, 22, 24
          ]);
        });
      });

      describe('acending insert rotations', function() {
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
          1,  3,  5,  7, 9, 11, 13, 15,                             24 
          ]);
        });
      });

      describe('ascending delete rotations', function() {
        beforeEach(function() {
          ins(tree, 1, 24);
        });

        it('1-3', function() {
          del(tree, 1, 3);
          expect(inspect(tree)).to.deep.eql([
                                        16, 
                        8,                             20,
                6,            12,              18,            22,
            4,      7,    10,     14,      17,     19,    21,     23,
              5,         9, 11, 13, 15,                             24 
          ]);
        });

        it('1-6', function() {
          del(tree, 1, 6);
          expect(inspect(tree)).to.deep.eql([
                                        16, 
                        12,                             20,
                8,            14,              18,            22,
            7,     10,    13,     15,      17,     19,    21,     23,
                  9, 11,                                            24 
          ]);
        });

        it('1-9', function() {
          del(tree, 1, 9);
          expect(inspect(tree)).to.deep.eql([
                                       16, 
                       12,                             20,
                10,           14,              18,            22,
                   11,    13,     15,      17,     19,    21,     23,
                                                                    24
          ]);
        });

        it('1-12', function() {
          del(tree, 1, 12);
          expect(inspect(tree)).to.deep.eql([
                                       20, 
                       16,                            22,
               14,             18,             21,            23,
           13,     15,     17,     19,                           24
          ]);
        });

        it('1-15', function() {
          del(tree, 1, 15);
          expect(inspect(tree)).to.deep.eql([
                                       20, 
                       18,                            22,
               16,             19,             21,            23,
                  17,                                            24
          ]);
        });

        it('1-18', function() {
          del(tree, 1, 18);
          expect(inspect(tree)).to.deep.eql([
                                       22, 
                       20,                            23,
               19,             21,                             24
          ]);
        });

        it('1-21', function() {
          del(tree, 1, 21);
          expect(inspect(tree)).to.deep.eql([
                                       23, 
                       22,                            24,
          ]);
        });

        it('1-23', function() {
          del(tree, 1, 23);
          expect(inspect(tree)).to.deep.eql([24]);
        });

        it('1-24', function() {
          del(tree, 1, 24);
          expect(inspect(tree)).to.deep.eql([]);
        });
      });


      describe('random access', function() {
        beforeEach(function() { ins(tree, 1, 80); });

        it('inserted keys', function() {
          expect(lookup(tree, 1)).to.eql('2');
          expect(lookup(tree, 2)).to.eql('4');
          expect(lookup(tree, 10)).to.eql('20');
          expect(lookup(tree, 45)).to.eql('90');
          expect(lookup(tree, 50)).to.eql('100');
          expect(lookup(tree, 80)).to.eql('160');
        });

        it('updated keys', function() {
          tree.set(1, 1, function() {});
          tree.set(2, 2, function() {});
          tree.set(10, 10, function() {});
          tree.set(45, 45, function() {});
          expect(lookup(tree, 1)).to.eql(1);
          expect(lookup(tree, 2)).to.eql(2);
          expect(lookup(tree, 10)).to.eql(10);
          expect(lookup(tree, 45)).to.eql(45);
        });

        it('inexistent keys', function() {
          expect(lookup(tree, 0)).to.be.null;
          expect(lookup(tree, 81)).to.be.null;
          expect(lookup(tree, 100)).to.be.null;
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
    expect(node.value).to.eql('value');
    expect(node.leftId).to.eql('abc');
    expect(node.rightId).to.eql('def');
  });
});
