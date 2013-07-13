class AvlNode implements DbObject {
  namespace: string;
  key: IndexKey;
  value: any;
  left: string;
  right: string;

  constructor(namespace: string, key: IndexKey, value: any) {
    this.namespace = namespace;
    this.key = key;
    this.value = value;
    this.left = null;
    this.right = null
  }

  getNamespace(): string {
    return this.namespace;
  }

  getType(): DbObjectType {
    return DbObjectType.IndexNode;
  }

  normalize(): Object {
    return [this.left, this.right, this.key.normalize(), this.value];
  }
}
