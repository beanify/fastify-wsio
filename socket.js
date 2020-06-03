const { EventEmitter } = require("events")
const parser = require("./parser")
const hasBin = require("has-binary2")

exports.events = [
  'error',
  'connect',
  'disconnect',
  'disconnecting',
  'newListener',
  'removeListener'
]

exports.flags = [
  'json',
  'volatile',
  'broadcast',
  'local'
]

class Socket extends EventEmitter {
  constructor(nsp, client, headers) {
    super()
    this.nsp = nsp
    this.server = nsp.server
    this.adapter = nsp.adapter
    this.id = nsp.name !== '/' ? nsp.name + '#' + client.id : client.id
    this.client = client
    this.conn = client.conn
    this.rooms = {}
    this.acks = {}
    this.connected = true
    this.disconnected = false;
    this.fns = []
    this.flags = {}
    this._rooms = []
    this.headers = headers

    exports.flags.forEach((flag) => {
      Object.defineProperty(this, flag, {
        get: function () {
          this.flags[flag] = true
          return this
        }
      })
    })
  }

  get request() {
    return this.conn.request
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

    if (typeof args[args.length - 1] === 'function') {
      if (this._rooms.length || this.flags.broadcast) {
        throw new Error('Callbacks are not supported when broadcasting');
      }

      this.acks[this.nsp.ids] = args.pop();
      packet.id = this.nsp.ids++;
    }

    const rooms = this._rooms.slice(0)
    const flags = Object.assign({}, this.flags)

    this._rooms = []
    this.flags = {}

    if (rooms.length || flags.broadcast) {
      this.adapter.broadcast(packet, {
        except: [this.id],
        rooms,
        flags
      })
    } else {
      this.packet(packet, flags)
    }
    return this
  }

  to(name) {
    return this._toAndIn(name)
  }

  in(name) {
    return this._toAndIn(name)
  }

  send() {
    this._sendAndWrite.apply(this, arguments)
  }

  write() {
    this._sendAndWrite.apply(this, arguments)
  }

  packet(pack, opts) {
    pack.nsp = this.nsp.name
    opts = opts || {}
    opts.compress = false !== opts.compress
    this.client.packet(pack, opts)
  }

  join(rooms, fn) {
    if (!Array.isArray(rooms)) {
      rooms = [rooms]
    }

    rooms = rooms.filter((room) => {
      return Object.prototype.hasOwnProperty(this.rooms, room)
    })

    if (!rooms.length) {
      fn && fn(null)
      return this
    }

    this.adapter.addAll(this.id, rooms, (err) => {
      if (err) {
        return fn && fn(err)
      }

      rooms.forEach((room) => {
        this.rooms[room] = room
      })
      fn && fn(null)
    })

    return this
  }

  leave(room, fn) {
    this.adapter.del(this.id, room, (err) => {
      if (err) {
        return fn && fn(err)
      }

      delete this.rooms[room]
      fn && fn(null)
    })

    return this
  }

  leaveAll() {
    this.adapter.delAll(this.id)
    this.rooms = {}
  }

  ack(id) {
    const self = this;
    let sent = false;

    return function () {
      if (sent) {
        return
      }

      const args = Array.prototype.slice.call(arguments)
      self.packet({
        id,
        type: hasBin(args) ? parser.BINARY_ACK : parser.ACK,
        data: args
      })

      sent = true
    }
  }

  error(err) {
    this.packet({
      type: parser.ERROR,
      data: err
    })
  }

  disconnect(close) {
    if (!this.connected) {
      return this
    }

    if (close) {
      this.client.disconnect()
    } else {
      this.packet({
        type: parser.DISCONNECT
      })
      this.onclose('server namespace disconnect')
    }

    return this
  }

  compress(val) {
    this.flags.compress = val;
    return this
  }

  binary(val) {
    this.flags.binary = val
    return this
  }

  dispatch(event) {
    process.nextTick(() => {
      super.emit.apply(this, event)
    })
  }

  onconnect() {
    this.nsp.connected[this.id] = this
    this.join(this.id)
    this.packet({
      type: parser.CONNECT
    })
  }

  onpacket(packet) {
    switch (packet.type) {
      case parser.EVENT: {
        this.onevent(packet)
      } break;

      case parser.BINARY_EVENT: {
        this.onevent(packet)
      } break;

      case parser.ACK: {
        this.onack(packet)
      } break;

      case parser.BINARY_ACK: {
        this.onack(packet)
      } break;

      case parser.DISCONNECT: {
        this.ondisconnect()
      } break;

      case parser.ERROR: {
        this.onerror(new Error(packet.data))
      } break;
    }
  }

  onevent(packet) {
    const args = packet.data || []
    if (packet.id&&packet.id !== null) {
      args.push(this.ack(packet.id))
    }
    this.dispatch(args)
  }

  onack(packet) {
    const ack = this.acks[packet.id]
    if (typeof ack === "function") {
      ack.apply(this, packet.data)
      delete this.acks[packet.id]
    }
  }

  ondisconnect() {
    this.onclose('client namespace disconnect')
  }

  onerror(err) {
    if (this.listeners('error').length) {
      this.emit('error', err)
    }
  }

  onclose(reason) {
    if (!this.connected) {
      return this
    }

    this.emit('disconnecting', reason)
    this.leaveAll()
    this.nsp.remove(this)
    this.client.remove(this)
    this.connected = false;
    this.disconnected = true;
    delete this.nsp.connected[this.id]
    this.emit('disconnect', reason)
  }

  _toAndIn(name) {
    if (!~this._rooms.indexOf(name)) {
      this._rooms.push(name)
    }
    return this
  }

  _sendAndWrite() {
    const args = Array.prototype.slice.call(arguments)
    args.unshift('message')
    this.emit.apply(this, args)
    return this
  }
}



exports.Socket = Socket
