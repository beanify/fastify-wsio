const parser = require("./parser")
const WebSocket = require("ws")
const base64Id = require("base64id")

class Client {
  constructor(server, conn) {
    this.server = server
    this.conn = conn
    this.encoder = server.encoder
    this.decoder = new server.parser.Decoder()
    this.id = base64Id.generateId()
    this.sockets = {}
    this.nsps = {}
    this.connectBuffer = []

  }

  get request() {
    return this.conn.request
  }

  setup(headers) {
    // this.onclose=this.onclose.bind(this)
    // this.ondata=this.ondata.bind(this)
    // this.onerror=this.onerror.bind(this)
    // this.ondecoded=this.ondecoded.bind(this)

    // this.decoder.on('decoded',this.ondecoded)
    // this.conn.on('data',this.ondata)
    // this.conn.on('error',this.onerror)
    // this.conn.on('close',this.onclose)

    // const connectPacket = { type: parser.CONNECT, nsp: '/', data: { sid: this.id } };
    // this.encoder.encode(connectPacket, (encodedPacket) => {
    //   this._sendToWs(encodedPacket)
    // })

    // handshake 
    this.packet({
      type: parser.HANDSHAKE,
      data: {
        sid: this.id,
        pingInterval: this.server.pingInterval,
        pingTimeout: this.server.pingTimeout
      }
    })

    // connect to '/'
    this.packet({
      type: parser.CONNECT,
      nsp: '/'
    })

    this.connect('/',headers)
  }

  connect(name, headers) {
    if (this.server.nsps[name]) {
      return this._doConnect(name, headers)
    }

    this.server.checkNamespace(name, headers, (dynamicNsp) => {
      if (dynamicNsp) {
        this._doConnect(name, headers)
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
      // this.connect()
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

  _doConnect(name, headers) {
    const nsp = this.server.of(name)

    if ('/' !== name && !this.nsps['/']) {
      this.connectBuffer.push(name)
      return
    }

    const socket = nsp.add(this, headers, () => {
      this.sockets[socket.id] = socket;
      this.nsps[nsp.name] = socket

      if ('/' === nsp.name && this.connectBuffer.length > 0) {

        this.connectBuffer.forEach((_name) => {
          this.connect(_name)
        })
        this.connectBuffer = []
      }
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