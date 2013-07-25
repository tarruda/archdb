var backends = {};
var frontends = {};

function registerBackend(name, klass) {
  backends[name] = klass;
}

function registerFrontend(name, klass) {
  frontends[name] = klass;
}

function openDb(options) {
  return new frontends[options.type](new backends[options.storage](options),
      options);
};
