{DbError, ConflictError} = require('../../../src/errors')
{ObjectRef, JobQueue, UidGenerator, ObjectType, typeOf} =
  require('../../../src/util')


class LeveldownDatabase
  constructor: (@options) ->
    @queue = new JobQueue()
    @uidGenerator = new UidGenerator()
    @sequences = null
    @masterRef = null
    @leveldown = null


  begin: (cb) ->
    hex = @uidGenerator.generate().hex
    suffix = hex.slice(0, 14)
    cb(null, new LocalRevision(this, @leveldown, @masterRef, suffix))
