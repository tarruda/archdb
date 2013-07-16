path = require 'path'
{SourceMapConsumer, SourceMapGenerator} = require 'source-map'

module.exports = (grunt) ->

  grunt.initConfig
    typescript:
      options:
        module: 'commonjs'
        target: 'es3'
        base_path: 'src'
        sourcemap: true
      common:
        src: 'src/*.ts'
        dest: 'tmp'
      browser:
        src: 'src/platform/browser.ts'
        dest: 'tmp'

    mapcat:
      browser:
        cwd: 'tmp'
        src: ['platform/browser.js', '*.js']
        dest: 'build/browser.js'

    connect:
      options:
        hostname: '192.168.56.50'
        middleware: (connect, options) -> [
          connect.static(options.base)
          connect.directory(options.base)
        ]
      project:
        options:
          port: 8000
          base: './'

    watch:
      options:
        nospawn: true
      src:
        files: [
          'src/**/*.ts'
          'test/**/*.js'
        ]
        tasks: [
          'typescript:changed'
          'mapcat'
          'livereload'
        ]

    clean: ['tmp', 'build', 'dist']

  grunt.loadNpmTasks 'grunt-contrib-watch'
  grunt.loadNpmTasks 'grunt-contrib-clean'
  grunt.loadNpmTasks 'grunt-contrib-connect'
  grunt.loadNpmTasks 'grunt-contrib-livereload'
  grunt.loadNpmTasks 'grunt-typescript'

  grunt.registerMultiTask 'mapcat', ->
    # concatenate compiled javascript while generating a resulting
    # source map for the original typescript files
    dest = @data.dest
    sourceMappingURL = "#{path.basename(dest)}.map"
    buffer = []
    lineOffset = 0
    cwd = @data.cwd
    gen = new SourceMapGenerator { file: dest }
    @filesSrc.forEach (file) ->
      filepath = path.join cwd, file
      sourceMapPath = filepath + ".map"
      src = grunt.file.read filepath
      src = src.replace(/\/\/@\ssourceMappingURL[^\r\n]*/g, '//')
      buffer.push src.replace('\r', '')
      orig = new SourceMapConsumer grunt.file.read(sourceMapPath)
      orig.eachMapping (m) ->
        gen.addMapping
          generated:
              line: m.generatedLine + lineOffset
              column: m.generatedColumn
          original:
              line: m.originalLine
              column: m.originalColumn
          source: m.source
      lineOffset += src.split('\n').length
    buffer.push "//@ sourceMappingURL=#{sourceMappingURL}"
    grunt.file.write dest, buffer.join('\n')
    grunt.file.write "#{dest}.map", gen.toString()

  grunt.registerTask 'default', [
    'typescript'
    'mapcat'
    'connect'
    'livereload-start'
    'watch'
  ]

  grunt.event.on 'watch', (action, filepath) ->
    typescript = grunt.config.getRaw('typescript')
    typescript.changed = {}
    if /\.ts$/.test filepath
      tsFile = path.relative(typescript.options.base_path, filepath)
      typescript.changed.src = path.join('src', tsFile)
      typescript.changed.dest = 'tmp'
    grunt.regarde = changed: ['browser.js']
