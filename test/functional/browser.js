testDatabase({type: 'local', storage: 'memory'});
testDatabase({type: 'local', storage: 'dom'}, function(cb) {
  localStorage.clear();
  cb();
});
