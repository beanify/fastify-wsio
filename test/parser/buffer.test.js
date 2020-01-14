const { test } = require('tap')
const parser = require('../../parser')

const encoder = new parser.Encoder()

test('encodes a Buffer', (t) => {
  t.plan(1)

  const data = ['a', Buffer.from('abc', 'utf8')]

  const packet = {
    type: parser.BINARY_EVENT,
    data,
    id: 0,
    nsp: '/cool'
  }

  encoder.encode(packet, (encodedPackets) => {
    const decoder = new parser.Decoder()
    decoder.on('decoded', (p) => {
      t.strictSame(p, {
        type: 5,
        nsp: '/cool',
        id: 0,
        attachments: undefined,
        data: data
      }, 'check packet')
    })
    for (var i = 0; i < encodedPackets.length; i++) {
      decoder.add(encodedPackets[i])
    }
  })
})

test('encodes a binary ack with Buffer', (t) => {
  t.plan(1)

  const data = ['a', Buffer.from('abc', 'utf8')]

  const packet = {
    type: parser.BINARY_ACK,
    data,
    id: 0,
    nsp: '/cool'
  }

  encoder.encode(packet, (encodedPackets) => {
    const decoder = new parser.Decoder()
    decoder.on('decoded', (p) => {
      t.strictSame(p, {
        type: 6,
        nsp: '/cool',
        id: 0,
        attachments: undefined,
        data: data
      }, 'check packet')
    })
    for (var i = 0; i < encodedPackets.length; i++) {
      decoder.add(encodedPackets[i])
    }
  })
})
