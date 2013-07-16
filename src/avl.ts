/// <reference path="./components.ts"/>
/// <reference path="./util.ts"/>

// using negative numbers as temporary node ids allow us to easily
// identify if the node is new(was not persisted yet)
var avlNodeId: number = -1;

class AvlNode implements DbObject {
  height: number;
  key: IndexKey;
  value: string;
  left: AvlNode;
  right: AvlNode;
  leftId: string;
  rightId: string;
  id: string;

  constructor(key: IndexKey, value: string) {
    this.key = key;
    this.value = value;
    this.left = null;
    this.leftId = null;
    this.right = null
    this.rightId = null;
    this.height = 0;
    this.id = (avlNodeId--).toString();
  }

  getType(): DbObjectType {
    return DbObjectType.IndexNode;
  }

  normalize(): Object {
    return [this.key.normalize(), normalize(this.value), this.leftId,
    this.rightId, this.height];
  }

  isNew(): boolean {
    return this.id[0] === '-';
  }

  clone(): AvlNode {
    var rv = new AvlNode(this.key.clone(), this.value);
    rv.left = this.left;
    rv.leftId = this.leftId;
    rv.right = this.right;
    rv.rightId = this.rightId;
    rv.height = this.height;
    return rv; 
  }

  rotateLeft() {
    var right = this.right;
    var left = this.left;
    var leftId = this.leftId;
    var newLeft = new AvlNode(this.key, this.value);

    if (!right) {
      // FIXME remove debug assertion
      throw new Error('left node not resolved!')
    }

    // update key/value
    this.key = right.key;
    this.value = right.value;
    // set new left
    newLeft.left = left;
    newLeft.leftId = leftId;
    this.left = newLeft;
    this.leftId = newLeft.id;
    // set new right
    this.right = right.right;
    this.rightId = right.rightId;
    // transfer the old right's left to the new left's right
    newLeft.right = right.left;
    newLeft.rightId = right.leftId;
    // recalculate heights;
    this.recalculateHeights();
  }

  rotateRight() {
    var right = this.right;
    var rightId = this.rightId;
    var left = this.left;
    var newRight = new AvlNode(this.key, this.value);

    if (!left) {
      // FIXME remove debug assertion
      throw new Error('left node not resolved!')
    }

    // update key/value
    this.key = left.key;
    this.value = left.value;
    // set new right
    newRight.right = right;
    newRight.rightId = rightId;
    this.right = newRight;
    this.rightId = newRight.id;
    // set new left
    this.left = left.left;
    this.leftId = left.leftId;
    // transfer the old left's right to the new right's left
    newRight.left = left.right;
    newRight.leftId = left.rightId;
    // recalculate heights;
    this.recalculateHeights();
  }

  calculateHeight() {
    var rv = -1, left = this.left, right = this.right;

    rv = Math.max(rv, (left === null ? -1 : left.height) + 1);
    rv = Math.max(rv, (right === null ? -1 : right.height) + 1);
    return rv;
  }

  recalculateHeights() {
    var left, right;

    left = this.left;
    right = this.right;
    if (left !== null)
      left.height = left.calculateHeight();
    if (right !== null)
      right.height = right.calculateHeight();
    this.height = this.calculateHeight();
  }

  balanceFactor() {
    var left = this.left, right = this.right;
    var leftHeight = left === null ? -1 : left.height;
    var rightHeight = right === null ? -1 : right.height

    return leftHeight - rightHeight;
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

  get(key: IndexKey, cb: IdCb) {
    var searchCb = (err: Error, comp: number, path: Array<AvlNode>) => {
      if (err) return cb(err, null);
      if (comp === 0) return cb(null, path[path.length - 1].value);
      cb(null, null);
    };
    var getCb = (err: Error, node: AvlNode) => {
      this.root = node;
      this.search(false, key, searchCb);
    }

    if (!this.rootId) return cb(null, null);
    if (this.root) {
      this.search(false, key, searchCb);
    } else {
      this.resolveNode(this.rootId, getCb);
    }
  }

  set(key: IndexKey, value: string, cb: UpdateIndexCb) {
    var searchCb = (err: Error, comp: number, path: Array<AvlNode>) => {
      var node, oldValue;
      if (err) return cb(err, null);
      node = path[path.length - 1];
      if (comp === 0) {
        oldValue = node.value;
        node.value = value;
        return cb(null, oldValue);
      }
      if (comp < 0) {
        node.left = new AvlNode(key, value);
        node.leftId = node.left.id;
      } else {
        node.right = new AvlNode(key, value);
        node.rightId = node.right.id;
      }
      this.ensureIsBalanced(oldValue, path, cb);
    };
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      this.root = node;
      this.search(true, key, searchCb);
    };

    if (!this.rootId) {
      this.root = new AvlNode(key, value);
      this.rootId = this.root.id;
      return cb(null, null);
    } else if (this.root) {
      this.search(true, key, searchCb);
    } else {
      this.resolveNode(this.rootId, getCb);
    }
  }

  del(key: IndexKey, cb: UpdateIndexCb) {
    var searchCb = (err: Error, comp: number, p: Array<AvlNode>) => {
      if (err) return cb(err, null);
      if (comp !== 0) return cb(null, null);
      path = p;
      this.delNode(path, delCb);
    };
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      this.root = node;
      this.search(true, key, searchCb);
    };
    var delCb = (err: Error, oldValue: string) => {
      if (err) return cb(err, null);
      this.ensureIsBalanced(oldValue, path, cb);
    };

    var path;

    if (!this.rootId) {
      return cb(null, null);
    } else if (this.root) {
      this.search(true, key, searchCb);
    } else {
      this.resolveNode(this.rootId, getCb);
    }
  }

  inOrder(minKey: IndexKey, cb: VisitNodeCb) { }
  revInOrder(maxKey: IndexKey, cb: VisitNodeCb) { }

  commit(cb: DoneCb) {
    var flushNodeCb = (err: Error, id: string) => {
      var parent, currentId;
      if (err) return cb(err);
      currentId = current.id;
      current.id = id; 
      if (parents.length) {
        parent = parents.pop();
        if (parent.leftId === currentId) {
          parent.leftId = current.id;
          parent.left = null; // make things easy for gc
        } else {
          parent.rightId = current.id;
          parent.right = null;
        }
        pending.push(parent);
        visit();
      } else {
        this.rootId = id;
        this.root = null;
        cb(null);
      }
    };
    var visit = () => {
      current = pending.pop();
      if (current.left && current.left.isNew()) {
        parents.push(current);
        pending.push(current.left);
        return yield(visit);
      } else if (current.right && current.right.isNew()) {
        parents.push(current);
        pending.push(current.right);
        return yield(visit);
      } else {
        this.dbStorage.save(current, flushNodeCb);
      }
    };

    var current, pending, parents;

    if (!this.root.isNew()) return cb(null);

    pending = [this.root];
    parents = [];
    visit();
  }

  private getLeft(from: AvlNode, cb: DbObjectCb) {
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      from.left = node;
      cb(null, node);
    }

    if (from.left) return cb(null, from.left);
    if (!from.leftId) return cb(null, null);
    this.resolveNode(from.leftId, getCb);
  }

  private getRight(from: AvlNode, cb: DbObjectCb) {
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      from.right = node;
      cb(null, node);
    }

    if (from.right) return cb(null, from.right);
    if (!from.rightId) return cb(null, null);
    this.resolveNode(from.rightId, getCb);
  }

  private search(copyPath: boolean, key: IndexKey, cb: AvlSearchCb) {
    var nodeCb = (err: Error, node: AvlNode) => {
      var nodeId;
      if (err) return cb(err, null, null);
      if (!node) return cb(null, comp, path);
      if (copyPath && !node.isNew()) {
        nodeId = node.id;
        node = node.clone();
        if (nodeId === current.leftId) {
          current.leftId = node.id;
          current.left = node;
        } else {
          current.rightId = node.id;
          current.right = node;
        }
      }
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
    var comp, current;
    var path = [];

    if (copyPath && !this.root.isNew()) {
      this.root = this.root.clone();
      this.rootId = this.root.id;
    }
    current = this.root;
    get();
  }

  private delNode(path: Array<AvlNode>, cb: UpdateIndexCb) {
    var delCb = (err: Error, old: string) => {
      if (err) return cb(err, null);
      if (old !== node.value) {
        // FIXME remove debug assertion
        throw new Error('invalid expected value');
      }
      cb(null, oldValue);
    };
    var nodeCb = (err: Error, child: AvlNode) => {
      if (err) return cb(err, null);
      // replace the node with its child
      if (parent) {
        if (parent.leftId === node.id) parent.leftId = child.id; 
        else parent.rightId = child.id;
      } else {
        this.rootId = child.id;
        this.root = child;
      }
      node.key = child.key;
      node.value = child.value;
      node.id = child.id;
      node.left = child.left;
      node.leftId = child.leftId;
      node.right = child.right;
      node.rightId = child.rightId;
      cb(null, oldValue);
    };

    var inOrderPredecessor, oldValue;
    var node = path[path.length - 1];
    var parent = path[path.length - 2];

    oldValue = node.value;

    if (node.leftId && node.rightId) {
      inOrderPredecessor = this.findInOrderPredecessor(path);
      node.key = inOrderPredecessor.key;
      node.value = inOrderPredecessor.value;
      this.delNode(path, delCb);
    } else {
      if (!node.leftId && !node.rightId) {
        if (parent) {
          if (parent.leftId === node.id) {
            parent.leftId = null;
            parent.left = null;
          } else {
            parent.rightId = null; 
            parent.right = null;
          }
        } else {
          this.rootId = null; 
          this.root = null;
        }
        path.pop();
        cb(null, oldValue);
      } else if (!node.leftId) {
        this.getRight(node, nodeCb);
      } else if (!node.rightId) {
        this.getLeft(node, nodeCb);
      }
    }
  }

  private findInOrderPredecessor(path: Array<AvlNode>) {
    var node = path[path.length - 1];
    var current = node.left;

    if (current !== null) {
      while (current.right !== null) {
        path.push(current);
        current = current.right;
      }
    }

    return current;
  }

  private ensureIsBalanced(oldValue: string, path: Array<AvlNode>,
      cb: UpdateIndexCb) {
    var childCb = (err: Error, child: AvlNode) => {
      if (err) return cb(err, null);
      if (child.id === node.leftId) node.left = child;
      else node.right = child;
      if ((node.leftId && !node.left) || (node.rightId && !node.right)) {
        throw new Error('crap!');
      }
      checkBalance();
    };
    var nextParent = () => {
      if (!path.length) return cb(null, oldValue);
      node = path.pop();
      // it is possible one of the node's child was not retrieved
      // from db storage yet
      if (node.leftId && !node.left) this.getLeft(node, childCb);
      else if (node.rightId && !node.right) this.getRight(node, childCb);
      else checkBalance();
    };
    var checkBalance = () => {
      var bf;
      node.height = node.calculateHeight();
      bf = node.balanceFactor();
      if (bf === -2) {
        if (node.right.balanceFactor() === 1)
          node.right.rotateRight();
        node.rotateLeft();
      } else if (bf === 2) {
        if (node.left.balanceFactor() === -1)
          node.left.rotateLeft();
        node.rotateRight();
      } else if (bf > 2 || bf < -2) {
        // FIXME remove debug assertion
        throw new Error('Invalid tree state');
      }
      yield(nextParent);
    };

    var node;

    nextParent();
  }

  private resolveNode(id: string, cb: DbObjectCb) {
    var getCb = (err: Error, node: AvlNode) => {
      if (err) return cb(err, null);
      cb(null, node);
    };
    this.dbStorage.get(id, getCb);
  }
}
