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

    this.setup()
  }

  get request() {
    return this.conn.request
  }

  setup() {

  }

  connect(name, query) {
    if (this.server.nsps[name]) {
      return this._doConnect(name, query)
    }

    this.server.checkNamespace(name, query, (dynamicNsp) => {
      if (dynamicNsp) {
        this._doConnect(name, query)
      } else {
        this.packet({
          type: parser.ERROR, nsp: name, data: 'Invalid namespace'
        })
      }
    })
  }

  packet(packet, opts) {
    opts = opts || {}

    const writeToWs = (encodedPackets) => {
      console.log({
        encodedPackets
      })
      if (opts.volatile && !this.conn.writable) {
        return;
      }

      for(let i=0;i<encodedPackets.length;i++){
        this.conn.socket.send(encodedPackets[i],{ compress: opts.compress })
      }
    }

    if (WebSocket.OPEN === this.conn.socket.readyState) {
      if (!opts.preEncoded) {
        this.encoder.encode(packet, writeToWs)
      } else {
        writeToWs(packet)
      }
    }
  }

  _doConnect(name, query) {
    const nsp = this.server.of(name)

    if ('/' !== name && !this.nsps['/']) {
      this.connectBuffer.push(name)
      return
    }

    console.log({
      step: '_doConnect',
      name
    })

    const socket = nsp.add(this, query, () => {
      this.sockets[socket.id] = socket;
      this.nsps[nsp.name] = socket
      console.log('----------->1', this.sockets)
      if ('/' === nsp.name && this.connectBuffer.length > 0) {
        console.log('----------->2')
        this.connectBuffer.forEach((_name) => {
          this.connect(_name)
        })
        this.connectBuffer = []
      }
    })
  }
}



exports.Client = Client