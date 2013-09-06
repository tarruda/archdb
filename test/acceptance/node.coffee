fs = require('fs')
wrench = require('wrench')

testApi = require('./api')


dbPath = '.tmpDb'
levelDbPath = '.tmpLevelDb'


testApi(type: 'local', storage: 'memory')
testApi(type: 'local', storage: 'fs', path: dbPath, (cb) ->
  if fs.existsSync(dbPath) then wrench.rmdirSyncRecursive(dbPath)
  fs.mkdirSync(dbPath)
  cb())
testApi(type: 'local', storage: 'leveldb', path: levelDbPath, (cb) ->
  if fs.existsSync(levelDbPath) then wrench.rmdirSyncRecursive(levelDbPath)
  cb())
