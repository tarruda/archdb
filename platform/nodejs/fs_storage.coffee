fs = require('fs')
path = require('path')


{FatalError} = require('../../src/errors')
{ObjectRef, JobQueue, normalize, denormalize} = require('../../src/util')
{encode, decode} = require('./msgpack')


BLOCK_SIZE = 4096


class FsStorage
  constructor: (options) ->
    @compression = options.compression or null
    @dataDir = path.resolve(options.path)
    @ready = false


  set: (key, obj, cb) ->
    @metadata[key] = normalize(obj)
    cb(null)


  get: (key, cb) ->
    if not @metadata[key] then return cb(null, null)
    cb(null, denormalize(@metadata[key]))


  saveIndexNode: (obj, cb) ->
    @saveFd(@nodeFd, @nodeOffset, @nodeWrites, obj, cb)


  getIndexNode: (ref, cb) ->
    @getFd(@nodeFd, ref, cb)


  saveIndexData: (obj, cb) ->
    @saveFd(@dataFd, @dataOffset, @dataWrites, obj, cb)


  getIndexData: (ref, cb) ->
    @getFd(@dataFd, ref, cb)


  flush: (cb) ->
    body = pos = undef

    encodeCb = (err, buf) =>
      body = buf
      # save the metadata body first. if the buffer fits
      # before the current metadata offset, then save at the beginning
      # (offset 8, after the header), else save after the current
      # metadata body
      if (8 + body.length) < @metadataOffset
        pos = 8
      else
        pos = @metadataOffset + @metadataLength
      fs.write(@metadataFd, body, 0, body.length, pos, bodyWriteCb)

    bodyWriteCb = (err) =>
      if err then return cb(err)
      fs.fsync(@dataFd, syncDataCb)

    syncDataCb = (err) =>
      if err then return cb(err)
      fs.fsync(@nodeFd, syncNodesCb)

    syncNodesCb = (err) =>
      if err then return cb(err)
      fs.fsync(@metadataFd, syncBodyCb)

    syncBodyCb = (err) =>
      if err then return cb(err)
      # now that everything is synced, we make the flush as atomic as
      # possible by writing/syncing the metadata header separately
      # lets hope we don't get a power failure or system crash while
      # the operating system is in middle of writing the 8 bytes :)
      header = new Buffer(8)
      header.writeUInt32BE(pos, 0)
      header.writeUInt32BE(body.length, 4)
      fs.write(@metadataFd, header, 0, header.length, 0, headerWriteCb)

    headerWriteCb = (err) =>
      if err
        return cb(new FatalError('Failed to write metadata header'))
      fs.fsync(@metadataFd, headerSyncCb)

    headerSyncCb = (err) =>
      if err then return cb(new FatalError('Failed to sync metadata header'))
      @metadataOffset = pos
      @metadataLength = body.length
      cb(null)

    encode(@metadata, @compression, encodeCb)


  open: (cb) ->
    metadataDecodeCb = (err, md) =>
      if err then return cb(err)
      @metadata = md
      cb(null)

    nodeFile = path.join(@dataDir, 'nodes')
    dataFile = path.join(@dataDir, 'data')
    metadataFile = path.join(@dataDir, 'metadata')
    @nodeFd = fs.openSync(nodeFile, 'a+')
    @dataFd = fs.openSync(dataFile, 'a+')
    @nodeOffset = fs.fstatSync(@nodeFd).size
    @dataOffset = fs.fstatSync(@dataFd).size
    @nodeWrites = new JobQueue()
    @dataWrites = new JobQueue()

    if fs.existsSync(metadataFile)
      # read the metadata file
      # the header is stored in the first 8 bytes of the file,
      # and is composed of two 32-bit unsigned integers which correspond to:
      # - offset where the metadata body begins
      # - length of the metadata body
      @metadataFd = fs.openSync(metadataFile, 'r+')
      buffer = new Buffer(8)
      fs.readSync(@metadataFd, buffer, 0, buffer.length, 0)
      @metadataOffset = buffer.readUInt32BE(0)
      @metadataLength = buffer.readUInt32BE(4)
      buffer = new Buffer(@metadataLength)
      fs.readSync(@metadataFd, buffer, 0, @metadataLength, @metadataOffset)
      decode(buffer, null, metadataDecodeCb)
    else
      @metadataFd = fs.openSync(metadataFile, 'w+')
      @metadataOffset = 8
      @metadataLength = 0
      @metadata = {}
      cb(null)


  close: (cb) ->
    remainingFds = 3

    closeCb = (err) =>
      if err then return cb(err)
      if not --remainingFds then cb(null)
  
    fs.close(@metadataFd, closeCb)
    fs.close(@nodeFd, closeCb)
    fs.close(@dataFd, closeCb)


  saveFd: (fd, pos, queue, obj, cb) ->
    buffer = null

    encodeCb = (err, buf) =>
      buffer = buf
      queue.add(appendCb, job)

    job = (appendCb) =>
      fs.write(fd, buffer, 0, buffer.length, null, appendCb)

    appendCb = (err, written) =>
      if err then return cb(err, null)
      if fd == @nodeFd then @nodeOffset += written
      else @dataOffset += written
      cb(null, new ObjectRef(pos))

    encode(obj, @compression, encodeCb)


  getFd: (fd, ref, cb) ->
    buffer = new Buffer(BLOCK_SIZE); pos = ref.valueOf(); continueCb = undef

    readCb = (err, bytesRead) =>
      if err then return cb(err, null)
      pos += bytesRead
      decode(buffer, readMore, cb)

    readMore = (count, cb) =>
      continueCb = cb
      count = Math.max(count, BLOCK_SIZE)
      buffer = new Buffer(count)
      fs.read(fd, buffer, 0, count, pos, readMoreCb)

    readMoreCb = (err, bytesRead) =>
      if err then return continueCb(err, null)
      pos += bytesRead
      continueCb(null, buffer)

    fs.read(fd, buffer, 0, buffer.length, pos, readCb)


registerStorage('fs', FsStorage)


module.exports = FsStorage
