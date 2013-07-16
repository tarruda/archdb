/// <reference path="./components.ts"/>

// using negative numbers as temporary node ids allow us to easily
// identify if the node is new(was not persisted yet)
var avlNodeId: number = -1;

class AvlNode implements DbObject {
  height: number;
  key: IndexKey;
  valueId: string;
  left: AvlNode;
  right: AvlNode;
  leftId: string;
  rightId: string;
  id: string;

  constructor(key: IndexKey, valueId: string) {
    this.key = key;
    this.valueId = valueId;
    this.left = null;
    this.right = null
    this.leftId = null;
    this.rightId = null;
    this.height = 0;
    this.id = (avlNodeId--).toString();
  }

  getType(): DbObjectType {
    return DbObjectType.IndexNode;
  }

  normalize(): Object {
    return [this.leftId, this.key.normalize(), this.rightId, this.valueId];
  }

  isNew(): boolean {
    return this.id[0] === '-';
  }

  clone(): AvlNode {
    var rv = new AvlNode(this.key.clone(), this.valueId);
    rv.left = this.left;
    rv.right = this.right;
    rv.leftId = this.leftId;
    rv.rightId = this.rightId;
    return rv; 
  }
}

interface AvlSearchCb {
  (err: Error, lastComparison: number, path: Array<AvlNode>);
}

class AvlTree implements DbIndexTree {
  dbStorage: DbStorage;
  rootId: string;
  root: AvlNode;

  constructor(dbStorage: DbStorage, rootId: string) {
    this.dbStorage = dbStorage;
    this.rootId = rootId;
    this.root = null;
  }

  get(key: IndexKey, cb: IdCallback) {
    var searchCb = (err: Error, comp: number, path: Array<AvlNode>) => {
      if (err) return cb(err, null);
      if (comp === 0) return cb(null, path[path.length - 1].valueId);
      cb(null, null);
    };
    var getCb = (err: Error, node: AvlNode) => {
      this.root = node;
      this.search(node, key, searchCb);
    }

    if (!this.rootId) return cb(null, null);
    if (this.root) {
      this.search(this.root, key, searchCb);
    } else {
      this.dbStorage.get(this.rootId, getCb);
    }
  }

  set(key: IndexKey, valueId: string, cb: UpdateIndexCallback) {
    var searchCb = (err: Error, comp: number, path: Array<AvlNode>) => {
      var node;
      if (err) return cb(err, null);
      node = path[path.length - 1];
      if (!node.isNew()) node = node.clone();
      if (comp === 0) {
        node.valueId = valueId;
      } else {
        if (comp < 0) {
          node.left = new AvlNode(key, valueId);
          node.leftId = node.left.id;
        } else {
          node.right = new AvlNode(key, valueId);
          node.rightId = node.right.id;
        }
        ensureIsBalanced(path);
      }

    };
    var getCb = (err: Error, node: AvlNode) => {
      this.root = node;
      this.search(node, key, searchCb);
    };

    if (!this.rootId) {
      this.root = new AvlNode(key, valueId);
      this.rootId = this.root.id;
      return cb(null, null);
    } else if (this.root) {
      this.search(this.root, key, searchCb);
    } else {
      this.dbStorage.get(this.rootId, getCb);
    }
  }

  del(key: IndexKey, cb: UpdateIndexCallback) { }
  inOrder(minKey: IndexKey, cb: VisitNodeCallback) { }
  revInOrder(maxKey: IndexKey, cb: VisitNodeCallback) { }
  getRootId(cb: IdCallback) { }
  setRootId(id: string, cb: DoneCallback) { }
  commit(cb: DoneCallback) { }

  private getLeft(from: AvlNode, cb: DbObjectCallback) {
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      from.left = node;
      cb(null, node);
    }

    if (from.left) return cb(null, from.left);
    if (!from.leftId) return cb(null, null);
    this.dbStorage.get(from.leftId, getCb);
  }

  private getRight(from: AvlNode, cb: DbObjectCallback) {
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      from.right = node;
      cb(null, node);
    }

    if (from.right) return cb(null, from.right);
    if (!from.rightId) return cb(null, null);
    this.dbStorage.get(from.rightId, getCb);
  }

  private search(root: AvlNode, key: IndexKey, cb: AvlSearchCb) {
    var nodeCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null, null);
      if (!node) return cb(null, comp, path);
      current = node;
      get();
    }
    var get = () => {
      path.push(current);
      comp = key.compareTo(current.key);
      if (comp < 0) {
        this.getLeft(current, nodeCb);
      } else if (comp > 0) {
        this.getRight(current, nodeCb);
      } else {
        cb(null, comp, path);
      }
    };
    var path = [];
    var current: AvlNode;
    var comp: number;

    current = root;
    get();
  }
}

function ensureIsBalanced(path: Array<AvlNode>) {
  var bf, node;

  while (path.length) {
    node = path.pop();
    node.height = calculateHeight(node);
    bf = balanceFactor(node);

    if (bf === -2) {
      if (balanceFactor(node.right) === 1)
        rotateRight(node.right);
      rotateLeft(node);
    } else if (bf === 2) {
      if (balanceFactor(node.left) === -1)
        rotateLeft(node.left);
      rotateRight(node);
    } else if (bf > 2 || bf < -2) {
      // FIXME remove debug assertion
      throw new Error('Invalid tree state');
    }
  }
}

function rotateLeft(node: AvlNode) {
  var right = node.right;
  var left = node.left;
  var newLeft = new AvlNode(node.key, node.valueId);

  // update root
  node.key = right.key;
  node.valueId = right.valueId;
  // set new left
  newLeft.left = left;
  node.left = newLeft;
  // set new right
  node.right = right.right;
  // transfer the old right's left to the new left's right
  newLeft.right = right.left;
  // recalculate heights;
  recalculateHeights(node);
}

function rotateRight(node: AvlNode) {
  var right = node.right;
  var left = node.left;
  var newRight = new AvlNode(node.key, node.valueId);

  // set new root
  node.key = left.key;
  node.valueId = left.valueId;
  // set new right
  newRight.right = right;
  node.right = newRight;
  // set new left
  node.left = left.left;
  // transfer the old left's right to the new right's left
  newRight.left = left.right;
  // recalculate heights;
  recalculateHeights(node);
}

function calculateHeight(node: AvlNode) {
  var rv = -1;
  rv = Math.max(rv, nodeHeight(node.left) + 1);
  rv = Math.max(rv, nodeHeight(node.right) + 1);
  return rv;
}

function recalculateHeights(node: AvlNode) {
  var left, right;

  if (node !== null) {
    left = node.left;
    right = node.right;
    if (left !== null)
      left.height = calculateHeight(left);
    if (right !== null)
      right.height = calculateHeight(right);
    node.height = calculateHeight(node);
  }
}

function balanceFactor(node) {
  var leftHeight = nodeHeight(node.left);
  var rightHeight = nodeHeight(node.right);

  return leftHeight - rightHeight;
}

function nodeHeight(node: AvlNode) {
  return node === null ? -1 : node.height;
}
