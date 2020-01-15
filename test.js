const Fastify = require('fastify')
const ioClient=require('socket.io-client')
const wsClient=require('ws')
const fastifyWSIO = require('./index')

const fastify = Fastify()

fastify.register(fastifyWSIO, {
  // prefix: 'aaaa',
  url: '/admin'
})

fastify.listen(12000, () => {
  console.log('fastify ready')
  // const socket=ioClient('ws://localhost:12000?aaaa=asdasdasd',{
  //   path:'/admin',
  //   transports:['websocket'],
  //   reconnection:false
  // })
  
  // socket.on('connect', function(){
  //   console.log("socket.io connect")
  // });

  // socket.on('event', function(data){
  //   console.log({
  //     data
  //   })
  // });
  // socket.on('disconnect', function(){
  //   console.log("socket.io disconnect")
  // });

  // socket.on('close', function(){
  //   console.log("socket.io close")
  // });


  // // socket.open()

  // // console.log('aaaaaaaaaa')
  // // const ws = new wsClient('ws://localhost:12000?aaaa=123123132', {
  // //   headers: {
  // //     userId: 'thisIsUserId'
  // //   }
  // // })
  // // ws.on('open', () => {
  // //   console.log('ws client opened')
  // //   // setTimeout(() => {
  // //   //   console.log('ws on close')
  // //   //   ws.close()
  // //   // }, 2000)
  // // })

  // // ws.on('message',(data)=>{
  // //   console.log({
  // //     data:data.toString('utf-8')
  // //   })
  // // })

  // // ws.on('close',(err)=>{
  // //   console.log({
  // //     close:err
  // //   })
  // // })

  // // ws.on('error',(err)=>{
  // //   console.log({
  // //     error:err
  // //   })
  // // })
})
