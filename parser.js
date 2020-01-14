const { EventEmitter } = require('events')

const withNativeBuffer = typeof Buffer === 'function' && typeof Buffer.isBuffer === 'function'
const withNativeArrayBuffer = typeof ArrayBuffer === 'function'

const isView = (obj) => {
  return typeof ArrayBuffer.isView === 'function' ? ArrayBuffer.isView(obj) : (obj.buffer instanceof ArrayBuffer)
}

const isBuf = (obj) => {
  return (withNativeBuffer && Buffer.isBuffer(obj)) ||
    (withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj)))
}

exports.types = [
  'CONNECT',
  'DISCONNECT',
  'EVENT',
  'ACK',
  'ERROR',
  'BINARY_EVENT',
  'BINARY_ACK'
]

exports.protocol = 1
exports.CONNECT = 0
exports.DISCONNECT = 1
exports.EVENT = 2
exports.ACK = 3
exports.ERROR = 4
exports.BINARY_EVENT = 5
exports.BINARY_ACK = 6

class BinaryReconstructor {
  constructor (packet) {
    this.reconPack = packet
    this.buffers = []
  }

  takeBinaryData (binData) {
    this.buffers.push(binData)
    if (this.buffers.length === this.reconPack.attachments) {
      const packet = this.reconPack
      packet.data = this._reconstructPacket(packet.data)
      packet.attachments = undefined

      this.finishedReconstruction()

      return packet
    }

    return null
  }

  finishedReconstruction () {
    this.reconPack = null
    this.buffers = []
  }

  _reconstructPacket (data) {
    if (!data) return data

    if (data && data._placeholder) {
      return this.buffers[data.num]
    } else if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        data[i] = this._reconstructPacket(data[i])
      }
    } else if (typeof data === 'object') {
      for (const key in data) {
        data[key] = this._reconstructPacket(data[key])
      }
    }

    return data
  }
}

class Encoder {
  encode (packet, callback) {
    if (exports.BINARY_EVENT === packet.type || exports.BINARY_ACK === packet.type) {
      this._encodeAsBinary(packet, callback)
    } else {
      const encoding = this._encodeAsString(packet)
      packet = [encoding]
      callback(packet)
    }
  }

  _encodeAsBinary (packet, callback) {
    const buffers = []
    const packetData = packet.data
    let pack = packet

    pack.data = this._deconstructPacket(packetData, buffers)
    pack.attachments = buffers.length

    const deconstruction = pack

    pack = this._encodeAsString(deconstruction)
    buffers.unshift(pack)
    callback(buffers)
  }

  _encodeAsString (obj) {
    let str = '' + obj.type

    if (exports.BINARY_EVENT === obj.type || exports.BINARY_ACK === obj.type) {
      str += obj.attachments + '-'
    }

    if (obj.nsp && obj.nsp !== '/') {
      str += obj.nsp + ','
    }

    if (obj.id != null) {
      str += obj.id
    }

    if (obj.data != null) {
      var payload = this._tryStringify(obj.data)
      if (payload !== false) {
        str += payload
      } else {
        return exports.ERROR + '"encode error"'
      }
    }

    return str
  }

  _deconstructPacket (data, buffers) {
    if (!data) return data

    if (isBuf(data)) {
      const placeholder = { _placeholder: true, num: buffers.length }
      buffers.push(data)
      return placeholder
    } else if (Array.isArray(data)) {
      const newData = new Array(data.length)
      for (let i = 0; i < data.length; i++) {
        newData[i] = this._deconstructPacket(data[i], buffers)
      }
      return newData
    } else if (typeof data === 'object' && !(data instanceof Date)) {
      const newData = {}
      for (const key in data) {
        newData[key] = this._deconstructPacket(data[key], buffers)
      }
      return newData
    }

    return data
  }

  _tryStringify (str) {
    try {
      return JSON.stringify(str)
    } catch (e) {
      return false
    }
  }
}

class Decoder extends EventEmitter {
  constructor () {
    super()
    this.reconstructor = null
  }

  add (obj) {
    let packet

    if (typeof obj === 'string') {
      packet = this._decodeString(obj)

      if (exports.BINARY_EVENT === packet.type || exports.BINARY_ACK === packet.type) {
        this.reconstructor = new BinaryReconstructor(packet)
        if (this.reconstructor.reconPack.attachments === 0) {
          this.emit('decoded', packet)
        }
      } else {
        this.emit('decoded', packet)
      }
    } else if (isBuf(obj) || obj.base64) {
      if (!this.reconstructor) {
        throw new Error('got binary data when not reconstructing a packet')
      } else {
        packet = this.reconstructor.takeBinaryData(obj)
        if (packet) {
          this.reconstructor = null
          this.emit('decoded', packet)
        }
      }
    } else {
      throw new Error('Unknown type: ' + obj)
    }
  }

  destroy () {
    if (this.reconstructor) {
      this.reconstructor.finishedReconstruction()
    }
  }

  _decodeString (str) {
    let i = 0
    const p = {
      type: Number(str.charAt(0))
    }

    if (exports.types[p.type] == null) {
      return this._error('unknown packet type ' + p.type)
    }

    if (exports.BINARY_EVENT === p.type || exports.BINARY_ACK === p.type) {
      let buf = ''
      while (str.charAt(++i) !== '-') {
        buf += str.charAt(i)
        if (i === str.length) break
      }

      if (parseInt(buf) !== Number(buf) || str.charAt(i) !== '-') {
        throw new Error('Illegal attachments')
      }

      p.attachments = Number(buf)
    }

    if (str.charAt(i + 1) === '/') {
      p.nsp = ''
      while (++i) {
        var c = str.charAt(i)
        if (c === ',') break
        p.nsp += c
        if (i === str.length) break
      }
    } else {
      p.nsp = '/'
    }

    const next = str.charAt(i + 1)
    if (next !== '' && Number(next) === parseInt(next)) {
      p.id = ''
      while (++i) {
        const c = str.charAt(i)
        if (c == null || Number(c) !== parseInt(c)) {
          --i
          break
        }
        p.id += str.charAt(i)
        if (i === str.length) break
      }
      p.id = Number(p.id)
    }

    if (str.charAt(++i)) {
      const payload = this._tryParse(str.substr(i))
      const isPayloadValid = payload !== false && (p.type === exports.ERROR || Array.isArray(payload))
      if (isPayloadValid) {
        p.data = payload
      } else {
        return this._error('invalid payload')
      }
    }
    return p
  }

  _error (msg) {
    return {
      type: exports.ERROR,
      data: 'parser error: ' + msg
    }
  }

  _tryParse (str) {
    try {
      return JSON.parse(str)
    } catch (e) {
      return false
    }
  }
}

exports.Encoder = Encoder
exports.Decoder = Decoder
