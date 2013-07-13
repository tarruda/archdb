// all the tests here will use numbers as key, so we have to implement
// the 'IndexKey' interface on the number prototype;
Number.prototype.compareTo = function(other) {
  return this - other;
};
Number.prototype.normalize = function() {
  return this;
};

describe('AvlNode', function() {
  var node;

  beforeEach(function() {
    node = new AvlNode('ns', 5, 'value');
    node.left = 'abc';
    node.right = 'def';
  });

  it('has namespace passed to constructor', function() {
    expect(node.getNamespace()).to.eql('ns');
  });

  it('has IndexNode type', function() {
    expect(node.getType()).to.eql(DbObjectType.IndexNode);
  });

  it('normalizes to a simple array', function() {
    expect(node.normalize()).to.deep.eql(['abc', 'def', 5, 'value']);
  });

  it('has attributes correctly set', function() {
    expect(node.key).to.eql(5);
    expect(node.value).to.eql('value');
    expect(node.left).to.eql('abc');
    expect(node.right).to.eql('def');
  });
});
