const Fastify = require('fastify')
const WSClient = require('ws')

const fastifyWSIO = require('./index')

const fastify = Fastify()

fastify.register(fastifyWSIO, {
  prefix: 'aaaa',
  url: ''
})

fastify.listen(12000, () => {
  const ws = new WSClient('ws://localhost:12000?aaaa=123123132', {
    headers: {
      userId: 'thisIsUserId'
    }
  })
  ws.on('open', () => {
    console.log('ws client opened')
    // setTimeout(() => {
    //   console.log('ws on close')
    //   ws.close()
    // }, 2000)
  })

  ws.on('message',(data)=>{
    console.log({
      data:data.toString('utf-8')
    })
  })

  ws.on('close',(err)=>{
    console.log({
      close:err
    })
  })

  ws.on('error',(err)=>{
    console.log({
      error:err
    })
  })
})
