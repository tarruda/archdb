/// <reference path="./local_database.ts"/>
/// <reference path="./memory_storage.ts"/>

function openDatabase(options, cb) {
  var storage;

  if (options.type === 'local') {
    if (options.storage === 'memory') storage = new MemoryStorage();
    if (storage) return cb(null, new LocalDatabase(storage));
  }

  throw new Error('invalid database configuration');
};
