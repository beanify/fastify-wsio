const parser = require("./parser")
const WebSocket = require("ws")
const base64Id = require("base64id")

class Client {
  constructor(server, conn, headers) {
    this.server = server
    this.conn = conn
    this.encoder = server.encoder
    this.decoder = new server.parser.Decoder()
    this.id = base64Id.generateId()
    this.sockets = {}
    this.nsps = {}
    this.headers = headers

    this.setup()
  }

  get request() {
    return this.conn.request
  }

  setup() {
    this.onclose=this.onclose.bind(this)
    this.ondata=this.ondata.bind(this)
    this.onerror=this.onerror.bind(this)
    this.ondecoded=this.ondecoded.bind(this)

    this.decoder.on('decoded',this.ondecoded)
    this.conn.on('message',this.ondata)
    this.conn.on('error',this.onerror)
    this.conn.on('close',this.onclose)
  }

  handshake() {
    this.packet({
      type: parser.HANDSHAKE,
      data: {
        sid: this.id,
        pingInterval: this.server.pingInterval,
        pingTimeout: this.server.pingTimeout
      }
    })
  }

  connect(name) {
    if (this.server.nsps[name]) {
      return this._doConnect(name)
    }

    this.server.checkNamespace(name,this.headers, (dynamicNsp) => {
      if (dynamicNsp) {
        this._doConnect(name)
      } else {
        this.packet({
          type: parser.ERROR, nsp: name, data: 'Invalid namespace'
        })
      }
    })
  }

  disconnect() {
    for (let id in this.sockets) {
      if (Object.prototype.hasOwnProperty.call(this.sockets, id)) {
        this.sockets[id].disconnect()
      }
    }
    this.sockets = {}
    this.close()
  }

  close() {
    if (WebSocket.OPEN === this.conn.readyState) {
      this.conn.close()
      this.onclose('forced server close')
    }
  }

  destroy() {
    // this.conn.removeListener('data',this.)
  }

  packet(packet, opts) {
    opts = opts || {}

    const writeToWs = (encodedPackets) => {
      console.log(encodedPackets)
      this._sendToWs(encodedPackets, opts)
    }

    if (WebSocket.OPEN === this.conn.readyState) {
      if (!opts.preEncoded) {
        this.encoder.encode(packet, writeToWs)
      } else {
        writeToWs(packet)
      }
    }
  }

  remove(socket){
    if(Object.prototype.hasOwnProperty(this.sockets,socket.id)){
      const nsp=this.sockets[socket.id].nsp.name
      delete this.sockets[socket.id]
      delete this.nsps[nsp]
    }
  }

  onclose(reason) {
    this.destroy()
    for (let id in this.sockets) {
      if (Object.prototype.hasOwnProperty.call(this.sockets, id)) {
        this.sockets[id].onclose(reason)
      }
    }

    this.sockets = {}
    this.decoder.destroy()
  }

  ondata(data) {
    try {
      console.log({
        data
      })
      this.decoder.add(data)
    } catch (e) {
      this.onerror(e)
    }
  }

  onerror(err) {
    for (let id in this.sockets) {
      if (Object.prototype.hasOwnProperty.call(this.sockets, id)) {
        this.sockets[id].onerror(err)
      }
    }

    this.conn.close()
  }

  ondecoded(packet) {
    console.log({
      packet
    })
    if (parser.CONNECT === packet.type) {
      this.connect(packet.nsp)
    } else {
      const socket = this.nsps[packet.nsp]
      if (socket) {
        process.nextTick(() => {
          socket.onpacket(packet)
        })
      } else {
        console.log('no socket for namespace :', packet.nsp);
      }
    }
  }

  _doConnect(name) {
    const nsp = this.server.of(name)
    const socket = nsp.add(this, this.headers, () => {
      this.sockets[socket.id] = socket;
      this.nsps[nsp.name] = socket
    })
  }

  _sendToWs(encodedPackets, opts) {
    opts = opts || {}
    for (let i = 0; i < encodedPackets.length; i++) {
      this.conn.send(encodedPackets[i], { compress: opts.compress })
    }
  }
}



exports.Client = Client