# fastify-wsio

* Improve from [socket.io](https://github.com/socketio/socket.io)

```javascript
const fastifyPlugin = require("fastify-plugin")
const fastifyWsio = require("fastify-wsio")

module.exports = fastifyPlugin((fastify, options, done) => {
  fastify.register(fastifyWsio,{
    wsio:{
      clientVerify(info,next){
        console.log(info)
        next(true)
      },
      pingInterval:25000,
      pingTimeout:5000
    },
    url:'/wsio-test'
  })

  done()
}, {
  name:'pluginsWsio'
})
```