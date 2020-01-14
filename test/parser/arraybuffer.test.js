const { test } = require('tap')
const parser = require('../../parser')

const encoder = new parser.Encoder()

test('encodes an ArrayBuffer', (t) => {
  t.plan(1)

  const packet = {
    type: parser.BINARY_EVENT,
    data: ['a', new ArrayBuffer(2)],
    id: 0,
    nsp: '/'
  }

  encoder.encode(packet, (encodedPackets) => {
    const decoder = new parser.Decoder()
    decoder.on('decoded', (p) => {
      t.strictSame(p, {
        type: 5,
        attachments: undefined,
        nsp: '/',
        id: 0,
        data: ['a', new ArrayBuffer(2)]
      }, 'check packet')
    })
    for (var i = 0; i < encodedPackets.length; i++) {
      decoder.add(encodedPackets[i])
    }
  })
})

test('encodes a TypedArray', (t) => {
  t.plan(1)

  const array = new Uint8Array(5)
  for (var i = 0; i < array.length; i++) {
    array[i] = i
  }

  const packet = {
    type: parser.BINARY_EVENT,
    data: ['a', array],
    id: 0,
    nsp: '/'
  }

  encoder.encode(packet, (encodedPackets) => {
    const decoder = new parser.Decoder()
    decoder.on('decoded', (p) => {
      t.strictSame(p, {
        type: 5,
        attachments: undefined,
        nsp: '/',
        id: 0,
        data: ['a', array]
      }, 'check packet')
    })
    for (var i = 0; i < encodedPackets.length; i++) {
      decoder.add(encodedPackets[i])
    }
  })
})

test('encodes ArrayBuffers deep in JSON', (t) => {
  t.plan(1)

  const data = ['a', { a: 'hi', b: { why: new ArrayBuffer(3) }, c: { a: 'bye', b: { a: new ArrayBuffer(6) } } }]

  const packet = {
    type: parser.BINARY_EVENT,
    data: data,
    id: 999,
    nsp: '/deep'
  }

  encoder.encode(packet, (encodedPackets) => {
    const decoder = new parser.Decoder()
    decoder.on('decoded', (p) => {
      t.strictSame(p, {
        type: 5,
        attachments: undefined,
        nsp: '/deep',
        id: 999,
        data: data
      }, 'check packet')
    })
    for (var i = 0; i < encodedPackets.length; i++) {
      decoder.add(encodedPackets[i])
    }
  })
})

test('encodes deep binary JSON with null values', (t) => {
  t.plan(1)

  const data = ['a', { a: 'b', c: 4, e: { g: null }, h: new ArrayBuffer(9) }]

  const packet = {
    type: parser.BINARY_EVENT,
    data: data,
    id: 999,
    nsp: '/deep'
  }

  encoder.encode(packet, (encodedPackets) => {
    const decoder = new parser.Decoder()
    decoder.on('decoded', (p) => {
      t.strictSame(p, {
        type: 5,
        attachments: undefined,
        nsp: '/deep',
        id: 999,
        data: data
      }, 'check packet')
    })
    for (var i = 0; i < encodedPackets.length; i++) {
      decoder.add(encodedPackets[i])
    }
  })
})

test('cleans itself up on close', (t) => {
  t.plan(1)

  const data = [new ArrayBuffer(2), new ArrayBuffer(3)]

  const packet = {
    type: parser.BINARY_EVENT,
    data: data,
    id: 999,
    nsp: '/deep'
  }

  encoder.encode(packet, (encodedPackets) => {
    const decoder = new parser.Decoder()
    decoder.on('decoded', (p) => {
      throw new Error('received a packet when not all binary data was sent.')
    })
    decoder.add(encodedPackets[0]) // add metadata
    decoder.add(encodedPackets[1]) // add first attachment
    decoder.destroy() // destroy before all data added
    t.equal(decoder.reconstructor.buffers.length, 0, 'check buffers.length')
  })
})
