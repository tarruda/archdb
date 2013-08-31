class DbError extends Error
  name: 'DbError'

  constructor: (message) ->
    super(message)
    injectStackTrace(this)


class InvalidOperationError extends DbError
  name: 'InvalidOperationError'

  constructor: (message) ->
    super(message or 'This operation is invalid in this context')


class ConflictError extends DbError
  name: 'ConflictError'

  constructor: (@conflicts) ->
    super('One or more values were updated after read in the transaction')


class CursorError extends DbError
  name: 'CursorError'

  constructor: (message) ->
    super(message)


class FatalError extends DbError
  name: 'FatalError'

  constructor: (message) ->
    super(message or 'Fatal error!')


class CorruptedStateError extends FatalError
  name: 'CorruptedStateError'

  constructor: ->
    super('Sorry but the database seems to be corrupted!')

    
exports.DbError = DbError
exports.InvalidOperationError = InvalidOperationError
exports.ConflictError = ConflictError
exports.CursorError = CursorError
exports.FatalError = FatalError
exports.CorruptedStateError = CorruptedStateError
