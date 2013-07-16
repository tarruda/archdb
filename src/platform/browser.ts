function yield(fn: () => any) {
  window.setImmediate(fn);
}
