const { test } = require('tap')
const parser = require('../../parser')

const encoder = new parser.Encoder()

test('exposes types', (t) => {
  t.plan(7)

  t.equal(parser.CONNECT, 0, 'check parser.CONNECT')
  t.equal(parser.DISCONNECT, 1, 'check parser.DISCONNECT')
  t.equal(parser.EVENT, 2, 'check parser.EVENT')
  t.equal(parser.ACK, 3, 'check parser.ACK')
  t.equal(parser.ERROR, 4, 'check parser.ERROR')
  t.equal(parser.BINARY_EVENT, 5, 'check parser.BINARY_EVENT')
  t.equal(parser.BINARY_ACK, 6, 'check parser.BINARY_ACK')
})

test('encodes connection', (t) => {
  t.plan(1)
  const packet = {
    type: parser.CONNECT,
    nsp: '/woot'
  }
  encoder.encode(packet, (encodedPackets) => {
    const decoder = new parser.Decoder()
    decoder.on('decoded', (p) => {
      t.strictSame(p, packet, 'check packet')
    })
    decoder.add(encodedPackets[0])
  })
})

test('encodes disconnection', (t) => {
  t.plan(1)
  const packet = {
    type: parser.DISCONNECT,
    nsp: '/woot'
  }
  encoder.encode(packet, (encodedPackets) => {
    const decoder = new parser.Decoder()
    decoder.on('decoded', (p) => {
      t.strictSame(p, packet, 'check packet')
    })
    decoder.add(encodedPackets[0])
  })
})

test('encodes an event', (t) => {
  t.plan(2)
  const packetNoId = {
    type: parser.EVENT,
    data: ['a', 1, {}],
    nsp: '/'
  }

  const packetWithId = {
    type: parser.EVENT,
    data: ['a', 1, {}],
    id: 1,
    nsp: '/test'
  }

  encoder.encode(packetNoId, (encodedPackets) => {
    const decoder = new parser.Decoder()
    decoder.on('decoded', (p) => {
      t.strictSame(p, packetNoId, 'check packetNoId')
    })
    decoder.add(encodedPackets[0])
  })

  encoder.encode(packetWithId, (encodedPackets) => {
    const decoder = new parser.Decoder()
    decoder.on('decoded', (p) => {
      t.strictSame(p, packetWithId, 'check packetWithId')
    })
    decoder.add(encodedPackets[0])
  })
})

test('encodes an ack', (t) => {
  t.plan(1)
  const packet = {
    type: parser.ACK,
    data: ['a', 1, {}],
    id: 123,
    nsp: '/'
  }
  encoder.encode(packet, (encodedPackets) => {
    const decoder = new parser.Decoder()
    decoder.on('decoded', (p) => {
      t.strictSame(p, packet, 'check packet')
    })
    decoder.add(encodedPackets[0])
  })
})

test('encodes an error', (t) => {
  t.plan(1)
  const packet = {
    type: parser.ERROR,
    data: 'Unauthorized',
    nsp: '/'
  }
  encoder.encode(packet, (encodedPackets) => {
    const decoder = new parser.Decoder()
    decoder.on('decoded', (p) => {
      t.strictSame(p, packet, 'check packet')
    })
    decoder.add(encodedPackets[0])
  })
})

test('properly handles circular objects', (t) => {
  t.plan(1)

  const a = {}
  a.b = a

  const packet = {
    type: parser.EVENT,
    data: a,
    id: 1,
    nsp: '/'
  }
  encoder.encode(packet, (encodedPackets) => {
    t.equal(encodedPackets[0], '4"encode error"', 'check error')
  })
})

test('decodes a bad binary packet', (t) => {
  t.plan(1)
  try {
    const decoder = new parser.Decoder()
    decoder.add('5')
  } catch (e) {
    t.equal(e.message, 'Illegal attachments', 'check error message')
  }
})

test('returns an error packet on parsing error', (t) => {
  t.plan(1)
  const decoder = new parser.Decoder()
  decoder.on('decoded', function (packet) {
    t.strictSame({
      type: 4,
      data: 'parser error: invalid payload'
    }, packet, 'check parsing error')
  })
  decoder.add('442["some","data"')
})
