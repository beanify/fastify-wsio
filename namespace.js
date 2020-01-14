const { EventEmitter } = require("events")
const parser = require('./parser')
const hasBin = require('has-binary2')
const { Socket } = require("./socket")
const WebSocket = require("ws")

exports.events = [
  'connect',
  'connection',
  'newListener'
]

exports.flags = [
  'json',
  'volatile',
  'local'
]

class Namespace extends EventEmitter {
  constructor(server, name) {
    super()
    this.name = name;
    this.server = server;
    this.sockets = {}
    this.connected = {}
    this.fns = []
    this.ids = 0
    this.rooms = []
    this.flags = {}
    this.initAdapter()

    exports.flags.forEach((flag) => {
      Object.defineProperty(this, flag, {
        get: function get() {
          this.flags[flag] = true
          return this
        }
      })
    })

  }

  initAdapter() {
    this.adapter = new (this.server.adapter())(this)
  }

  to(name) {
    return this._toAndIn(name)
  }

  in(name) {
    return this._toAndIn(name)
  }

  add(client, query, fn) {
    const socket = new Socket(this, client, query)

    process.nextTick(() => {
      if (client.conn.socket.readyState === WebSocket.OPEN) {
        this.sockets[socket.id] = socket
        socket.onconnect()

        if (fn) {
          fn()
        }

        this.emit('connect', socket)
        this.emit('connection', socket)
      }
    })

    return socket;
  }

  remove(socket) {
    if (Object.prototype.hasOwnProperty.call(this.sockets, socket.id)) {
      delete this.sockets[socket.id]
    }
  }

  emit(ev) {
    if (~exports.events.indexOf(ev)) {
      super.emit.apply(this, arguments)
      return this
    }

    const args = Array.prototype.slice.call(arguments)
    const packet = {
      type: (this.flags.binary !== undefined ? this.flags.binary : hasBin(args)) ? parser.BINARY_EVENT : parser.EVENT,
      data: args
    }

    if (typeof args[args.length - 1] === "function") {
      throw new Error('Callbacks are not supported when broadcasting');
    }

    const rooms = this.rooms.slice(0)
    const flags = Object.assign({}, this.flags)

    this.rooms = []
    this.flags = {}

    this.adapter.broadcast(packet, {
      rooms,
      flags
    })

    return this
  }

  send() {
    return this._sendAndWrite.apply(this, arguments)
  }

  write() {
    return this._sendAndWrite.apply(this, arguments)
  }

  clients(fn) {
    if (!this.adapter) {
      throw new Error('No adapter for this namespace, are you trying to get the list of clients of a dynamic namespace?')
    }

    this.adapter.clients(this.rooms, fn)
    this.rooms = []

    return this;
  }

  compress(val) {
    this.flags.compress = val
    return this
  }

  binary(val) {
    this.flags.binary = val
    return this
  }

  _sendAndWrite() {
    const args = Array.prototype.slice.call(arguments)
    args.unshift('message')
    this.emit.apply(this, args)
    return this
  }

  _toAndIn(name) {
    if (!~this.rooms.indexOf(name)) {
      this.rooms.push(name)
    }
    return this
  }
}

let count = 0

class ParentNamespace extends Namespace {
  constructor(server) {
    super(server, '/_' + (count++))
    this.children=new Set()
  }

  initAdapter(){

  }

  emit(){
    const args=Array.prototype.slice.call(arguments)

    this.children.forEach((nsp)=>{
      nsp.rooms=this.rooms
      nsp.flags=this.flags
      nsp.emit.apply(nsp,args)
    })

    this.rooms=[]
    this.flags=[]
  }

  createChild(name){
    const nsp=new Namespace(this.server,name)
    nsp.fns=this.fns.slice(0)
    this.listeners('connect').forEach(listener=>nsp.on('connect',listener))
    this.listeners('connection').forEach(listener=>nsp.on('connection',listener))
    this.children.add(nsp)
    this.server.nsps[name]=nsp
    return nsp
  }
}

exports.Namespace = Namespace
exports.ParentNamespace = ParentNamespace