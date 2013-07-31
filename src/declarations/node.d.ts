// declartions for some of the node.js API,
// taken from the samples in typescript repository

declare var process: NodeProcess;

declare class EventEmitter {
    addListener(event: string, listener: Function);
    on(event: string, listener: Function);
    once(event: string, listener: Function): void;
    removeListener(event: string, listener: Function): void;
    removeAllListener(event: string): void;
    setMaxListeners(n: number): void;
    listeners(event: string): { Function; }[];
    emit(event: string, arg1?: any, arg2?: any): void;
}

declare class WritableStream extends EventEmitter {
    writable: boolean;
    write(str: string, encoding?: string, fd?: string): boolean;
    write(buffer: NodeBuffer): boolean;
    end(): void;
    end(str: string, enconding: string): void;
    end(buffer: NodeBuffer): void;
    destroy(): void;
    destroySoon(): void;
}

declare class ReadableStream extends EventEmitter {
    readable: boolean;
    setEncoding(encoding: string): void;
    pause(): void;
    resume(): void;
    destroy(): void;
    pipe(destination: WritableStream, options?: { end?: boolean; }): void;
}

declare class NodeProcess extends EventEmitter {
    stdout: WritableStream;
    stderr: WritableStream;
    stdin: ReadableStream;
    argv: string[];
    execPath: string;
    abort(): void;
    chdir(directory: string): void;
    cwd(): string;
    env: any;
    exit(code?: number): void;
    getgid(): number;
    setgid(id: number): void;
    getuid(): number;
    setuid(id: number): void;
    version: string;
    versions: { http_parser: string; node: string; v8: string; ares: string; uv: string; zlib: string; openssl: string; };
    config: {
        target_defaults: {
            cflags: any[];
            default_configuration: string;
            defines: string[];
            include_dirs: string[];
            libraries: string[];
        };
        variables: {
        clang: number;
        host_arch: string;
        node_install_npm: boolean;
        node_install_waf: boolean;
        node_prefix: string;
        node_shared_openssl: boolean;
        node_shared_v8: boolean;
        node_shared_zlib: boolean;
        node_use_dtrace: boolean;
        node_use_etw: boolean;
        node_use_openssl: boolean;
        target_arch: string;
        v8_no_strict_aliasing: number;
        v8_use_snapshot: boolean;
        visibility: string;
    };
    };
    kill(pid: number, signal?: string): void;
    pid: number;
    title: string;
    arch: string;
    platform: string;
    memoryUsage(): { rss: number; heapTotal; number; heapUsed: number; };
    nextTick(callback: Function): void;
    umask(mask?: number): number;
    uptime(): number;
    hrtime(): number[];
}

interface NodeBuffer {
    [index: number]: number;
    write(string: string, offset?: number, length?: number, encoding?: string): number;
    toString(encoding?: string, start?: number, end?: number): string;
    length: number;
    copy(targetBuffer: NodeBuffer, targetStart?: number, sourceStart?: number, sourceEnd?: number): void;
    slice(start?: number, end?: number): NodeBuffer;
    readUInt8(offset: number, noAsset?: boolean): number;
    readUInt16LE(offset: number, noAssert?: boolean): number;
    readUInt16BE(offset: number, noAssert?: boolean): number;
    readUInt32LE(offset: number, noAssert?: boolean): number;
    readUInt32BE(offset: number, noAssert?: boolean): number;
    readInt8(offset: number, noAssert?: boolean): number;
    readInt16LE(offset: number, noAssert?: boolean): number;
    readInt16BE(offset: number, noAssert?: boolean): number;
    readInt32LE(offset: number, noAssert?: boolean): number;
    readInt32BE(offset: number, noAssert?: boolean): number;
    readFloatLE(offset: number, noAssert?: boolean): number;
    readFloatBE(offset: number, noAssert?: boolean): number;
    readDoubleLE(offset: number, noAssert?: boolean): number;
    readDoubleBE(offset: number, noAssert?: boolean): number;
    writeUInt8(value: number, offset: number, noAssert?: boolean): void;
    writeUInt16LE(value: number, offset: number, noAssert?: boolean): void;
    writeUInt16BE(value: number, offset: number, noAssert?: boolean): void;
    writeUInt32LE(value: number, offset: number, noAssert?: boolean): void;
    writeUInt32BE(value: number, offset: number, noAssert?: boolean): void;
    writeInt8(value: number, offset: number, noAssert?: boolean): void;
    writeInt16LE(value: number, offset: number, noAssert?: boolean): void;
    writeInt16BE(value: number, offset: number, noAssert?: boolean): void;
    writeInt32LE(value: number, offset: number, noAssert?: boolean): void;
    writeInt32BE(value: number, offset: number, noAssert?: boolean): void;
    writeFloatLE(value: number, offset: number, noAssert?: boolean): void;
    writeFloatBE(value: number, offset: number, noAssert?: boolean): void;
    writeDoubleLE(value: number, offset: number, noAssert?: boolean): void;
    writeDoubleBE(value: number, offset: number, noAssert?: boolean): void;
    fill(value: any, offset?: number, end?: number): void;
    INSPECT_MAX_BYTES: number;
}

declare var Buffer: {
    new (str: string, encoding?: string): NodeBuffer;
    new (size: number): NodeBuffer;
    new (array: any[]): NodeBuffer;
    prototype: NodeBuffer;
    isBuffer(obj: any): boolean;
    byteLength(string: string, encoding?: string): number;
    concat(list: NodeBuffer[], totalLength?: number): NodeBuffer;
}

declare module "events" {
    export class EventEmitter {
        addListener(event: string, listener: Function);
        on(event: string, listener: Function): any;
        once(event: string, listener: Function): void;
        removeListener(event: string, listener: Function): void;
        removeAllListener(event: string): void;
        setMaxListeners(n: number): void;
        listeners(event: string): { Function; }[];
        emit(event: string, arg1?: any, arg2?: any): void;
    }
}

declare module "stream" {
    import events = require("events");

    export interface WriteStream {
        writable: boolean;
        write(str: string, encoding?: string, fd?: string): boolean;
        write(buffer: NodeBuffer): boolean;
        end(): void;
        end(str: string, enconding: string): void;
        end(buffer: NodeBuffer): void;
        destroy(): void;
        destroySoon(): void;
    }

    export class WritableStream extends events.EventEmitter implements WriteStream {
        writable: boolean;
        write(str: string, encoding?: string, fd?: string): boolean;
        write(buffer: NodeBuffer): boolean;
        end(): void;
        end(str: string, enconding: string): void;
        end(buffer: NodeBuffer): void;
        destroy(): void;
        destroySoon(): void;
    }

    export class ReadableStream extends events.EventEmitter {
        readable: boolean;
        setEncoding(encoding: string): void;
        pause(): void;
        resume(): void;
        destroy(): void;
        pipe(destination: WriteStream, options?: { end?: boolean; }): void;
    }

    export class ReadWriteStream extends events.EventEmitter implements WriteStream {
        readable: boolean;
        setEncoding(encoding: string): void;
        pause(): void;
        resume(): void;
        pipe(destination: WriteStream, options?: { end?: boolean; }): void;

        writable: boolean;
        write(str: string, encoding?: string, fd?: string): boolean;
        write(buffer: NodeBuffer): boolean;
        end(): void;
        end(str: string, enconding: string): void;
        end(buffer: NodeBuffer): void;
        destroy(): void;
        destroySoon(): void;
    }
}

declare module "repl" {
    import stream = require("stream");
    import events = require("events");

    export interface EvalCb { (err: Error, result: any) }

    export interface ReplOptions {
        prompt?: string;
        input?: stream.ReadableStream;
        output?: stream.WritableStream;
        terminal?: boolean;
        eval?: Function;
        useColors?: boolean;
        useGlobal?: boolean;
        ignoreUndefined?: boolean;
        writer?: Function;
    }
    export function start(options: ReplOptions): events.EventEmitter;

    export class REPLServer {
      constructor(opts: ReplOptions);
      complete(line: string, cb: (completions: Array) => void);
      createContext();
      eval: (str: string, context: any, file: string, cb: EvalCb) => any;
    }
}

declare module "vm" {
    export interface Context { }
    export interface Script {
        runInThisContext(): void;
        runInNewContext(sandbox?: Context): void;
    }
    export function runInThisContext(code: string, filename?: string): void;
    export function runInNewContext(code: string, sandbox?: Context, filename?: string): void;
    export function runInContext(code: string, context: Context, filename?: string): void;
    export function createContext(initSandbox?: Context): Context;
    export function createScript(code: string, filename?: string): Script;
}

declare module "fs" {
    import stream = require("stream");

    export interface Stats {
        isFile(): boolean;
        isDirectory(): boolean;
        isBlockDevice(): boolean;
        isCharacterDevice(): boolean;
        isSymbolicLink(): boolean;
        isFIFO(): boolean;
        isSocket(): boolean;
        dev: number;
        ino: number;
        mode: number;
        nlink: number;
        uid: number;
        gid: number;
        rdev: number;
        size: number;
        blksize: number;
        blocks: number;
        atime: Date;
        mtime: Date;
        ctime: Date;
    }

    export interface FSWatcher {
        close(): void;
    }

    export class ReadStream extends stream.ReadableStream { }
    export class WriteStream extends stream.WritableStream { }

    export function rename(oldPath: string, newPath: string, callback?: Function): void;
    export function renameSync(oldPath: string, newPath: string): void;
    export function truncate(fd: number, len: number, callback?: Function): void;
    export function truncateSync(fd: number, len: number): void;
    export function chown(path: string, uid: number, gid: number, callback?: Function): void;
    export function chownSync(path: string, uid: number, gid: number): void;
    export function fchown(fd: number, uid: number, gid: number, callback?: Function): void;
    export function fchownSync(fd: number, uid: number, gid: number): void;
    export function lchown(path: string, uid: number, gid: number, callback?: Function): void;
    export function lchownSync(path: string, uid: number, gid: number): void;
    export function chmod(path: string, mode: number, callback?: Function): void;
    export function chmod(path: string, mode: string, callback?: Function): void;
    export function chmodSync(path: string, mode: number): void;
    export function chmodSync(path: string, mode: string): void;
    export function fchmod(fd: number, mode: number, callback?: Function): void;
    export function fchmod(fd: number, mode: string, callback?: Function): void;
    export function fchmodSync(fd: number, mode: number): void;
    export function fchmodSync(fd: number, mode: string): void;
    export function lchmod(path: string, mode: string, callback?: Function): void;
    export function lchmod(path: string, mode: number, callback?: Function): void;
    export function lchmodSync(path: string, mode: number): void;
    export function lchmodSync(path: string, mode: string): void;
    export function stat(path: string, callback?: (err: Error, stats: Stats) =>any): Stats;
    export function lstat(path: string, callback?: (err: Error, stats: Stats) =>any): Stats;
    export function fstat(fd: number, callback?: (err: Error, stats: Stats) =>any): Stats;
    export function statSync(path: string): Stats;
    export function lstatSync(path: string): Stats;
    export function fstatSync(fd: number): Stats;
    export function link(srcpath: string, dstpath: string, callback?: Function): void;
    export function linkSync(srcpath: string, dstpath: string): void;
    export function symlink(srcpath: string, dstpath: string, type?: string, callback?: Function): void;
    export function symlinkSync(srcpath: string, dstpath: string, type?: string): void;
    export function readlink(path: string, callback?: (err: Error, linkString: string) =>any): void;
    export function realpath(path: string, callback?: (err: Error, resolvedPath: string) =>any): void;
    export function realpath(path: string, cache: string, callback: (err: Error, resolvedPath: string) =>any): void;
    export function realpathSync(path: string, cache?: string): string;
    export function unlink(path: string, callback?: Function): void;
    export function unlinkSync(path: string): void;
    export function rmdir(path: string, callback?: Function): void;
    export function rmdirSync(path: string): void;
    export function mkdir(path: string, mode?: number, callback?: Function): void;
    export function mkdir(path: string, mode?: string, callback?: Function): void;
    export function mkdirSync(path: string, mode?: number): void;
    export function mkdirSync(path: string, mode?: string): void;
    export function readdir(path: string, callback?: (err: Error, files: string[]) => void): void;
    export function readdirSync(path: string): string[];
    export function close(fd: number, callback?: Function): void;
    export function closeSync(fd: number): void;
    export function open(path: string, flags: string, mode?: string, callback?: (err: Error, fd: number) =>any): void;
    export function openSync(path: string, flags: string, mode?: string): number;
    export function utimes(path: string, atime: number, mtime: number, callback?: Function): void;
    export function utimesSync(path: string, atime: number, mtime: number): void;
    export function futimes(fd: number, atime: number, mtime: number, callback?: Function): void;
    export function futimesSync(fd: number, atime: number, mtime: number): void;
    export function fsync(fd: number, callback?: Function): void;
    export function fsyncSync(fd: number): void;
    export function write(fd: number, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error, written: number, buffer: NodeBuffer) =>any): void;
    export function writeSync(fd: number, buffer: NodeBuffer, offset: number, length: number, position: number): number;
    export function read(fd: number, buffer: NodeBuffer, offset: number, length: number, position: number, callback?: (err: Error, bytesRead: number, buffer: NodeBuffer) => void): void;
    export function readSync(fd: number, buffer: NodeBuffer, offset: number, length: number, position: number): number;
    export function readFile(filename: string, encoding: string, callback: (err: Error, data: string) => void ): void;
    export function readFile(filename: string, callback: (err: Error, data: NodeBuffer) => void ): void;
    export function readFileSync(filename: string): NodeBuffer;
    export function readFileSync(filename: string, encoding: string): string;
    export function writeFile(filename: string, data: any, encoding?: string, callback?: Function): void;
    export function writeFileSync(filename: string, data: any, encoding?: string): void;
    export function appendFile(filename: string, data: any, encoding?: string, callback?: Function): void;
    export function appendFileSync(filename: string, data: any, encoding?: string): void;
    export function watchFile(filename: string, listener: { curr: Stats; prev: Stats; }): void;
    export function watchFile(filename: string, options: { persistent?: boolean; interval?: number; }, listener: { curr: Stats; prev: Stats; }): void;
    export function unwatchFile(filename: string, listener?: Stats): void;
    export function watch(filename: string, options?: { persistent?: boolean; }, listener?: (event: string, filename: string) =>any): FSWatcher;
    export function exists(path: string, callback?: (exists: boolean) =>void ): void;
    export function existsSync(path: string): boolean;
    export function createReadStream(path: string, options?: {
        flags?: string;
        encoding?: string;
        fd?: string;
        mode?: number;
        bufferSize?: number;
    }): ReadStream;
    export function createWriteStream(path: string, options?: {
        flags?: string;
        encoding?: string;
        string?: string;
    }): WriteStream;
}

declare module "path" {
    export function normalize(p: string): string;
    export function join(...paths: any[]): string;
    export function resolve(to: string): string;
    export function resolve(from: string, to: string): string;
    export function resolve(from: string, from2: string, to: string): string;
    export function resolve(from: string, from2: string, from3: string, to: string): string;
    export function resolve(from: string, from2: string, from3: string, from4: string, to: string): string;
    export function resolve(from: string, from2: string, from3: string, from4: string, from5: string, to: string): string;
    export function relative(from: string, to: string): string;
    export function dirname(p: string): string;
    export function basename(p: string, ext?: string): string;
    export function extname(p: string): string;
    export var sep: string;
}

declare module "util" {
    export function format(format: any, ...param: any[]): string;
    export function debug(string: string): void;
    export function error(...param: any[]): void;
    export function puts(...param: any[]): void;
    export function print(...param: any[]): void;
    export function log(string: string): void;
    export function inspect(object: any, showHidden?: boolean, depth?: number, color?: boolean): void;
    export function isArray(object: any): boolean;
    export function isRegExp(object: any): boolean;
    export function isDate(object: any): boolean;
    export function isError(object: any): boolean;
    export function inherits(constructor: any, superConstructor: any): void;
}

interface NodeFiber { run(); }

interface FiberModule {
  (fn): NodeFiber;
  current: NodeFiber;
  yield();
}

declare module "fibers" {
  var fiberModule: FiberModule;

  export = fiberModule;
}
