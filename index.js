const { EventEmitter } = require("events")
const Adapter = require("./adapter")
const parser = require("./parser")
const { Namespace, ParentNamespace, flags: NamespaceFlags } = require("./namespace")
const { Client } = require('./client')

class Server {
  constructor(opts) {
    opts = opts || {}

    this.nsps = {}
    this.parentNsps = new Map()
    this.parser = opts.parser || parser
    this.encoder = new this.parser.Encoder()
    this.adapter(opts.adapter || Adapter)
    this.sockets = this.of('/')
    this.clientVerify = opts.clientVerify || this._clientVerify
    this.pingInterval = opts.pingInterval || 25000
    this.pingTimeout = opts.pingTimeout || 5000

    const emitterMethods = Object.keys(EventEmitter.prototype).filter(function (key) {
      return typeof EventEmitter.prototype[key] === 'function';
    });

    emitterMethods.concat(['to', 'in'/*, 'use'*/, 'send', 'write', 'clients', 'compress', 'binary']).forEach((fn) => {
      this[fn] = function () {
        return this.sockets[fn].apply(this.sockets, arguments);
      }.bind(this)
    });

    NamespaceFlags.forEach((flag) => {
      Object.defineProperty(this, flag, {
        get: function () {
          this.sockets.flags = this.sockets.flags || {};
          this.sockets.flags[flag] = true;
          return this;
        }
      });
    });

  }

  adapter(val) {
    if (!arguments.length) {
      return this._adapter
    }

    this._adapter = val;
    for (let i in this.nsps) {
      if (Object.prototype.hasOwnProperty(this.nsps, i)) {
        this.nsps[i].initAdapter()
      }
    }
    return this
  }

  of(name, fn) {
    if (typeof name === 'function' || name instanceof RegExp) {
      const parentNsp = new ParentNamespace(this)

      if (typeof name === 'function') {
        this.parentNsps.set(name, parentNsp)
      } else {
        this.parentNsps.set((nsp, conn, next) => next(null, name.test(nsp)), parentNsp)
      }

      if (fn) {
        parentNsp.on('connect', fn)
      }

      return parentNsp
    }

    if (String(name)[0] !== '/') {
      name = '/' + name
    }

    let nsp = this.nsps[name]
    if (!nsp) {
      nsp = new Namespace(this, name)
      this.nsps[name] = nsp
    }

    if (fn) {
      nsp.on('connect', fn)
    }

    return nsp
  }

  close(fn) {
    for (let id in this.nsps['/'].sockets) {
      if (Object.prototype.hasOwnProperty(this.nsps['/'].sockets, id)) {
        this.nsps['/'].sockets[id].onclose()
      }
    }

    if (fn) {
      fn()
    }
  }

  checkNamespace(name, headers, fn) {
    if (this.parentNsps.size === 0) {
      return fn(false)
    }

    const keysIterator = this.parentNsps.keys();

    const run = () => {
      let nextFn = keysIterator.next()
      if (nextFn.done) {
        return fn(false)
      }
      nextFn.value(name, headers, (err, allow) => {
        if (err || !allow) {
          run()
        } else {
          fn(this.parentNsps.get(nextFn.value).createChild(name))
        }
      })
    }

    run()
  }

  clientIncoming(conn, headers) {
    this.clientVerify(headers, (allowed) => {
      const client = new Client(this, conn, headers)
      if (!allowed) {
        client.disconnect()
      } else {
        client.handshake()
        client.connect('/')
      }
    })
  }


  _clientVerify(headers, callback) {
    callback(true)
  }
}


const fastifyPlugin = require('fastify-plugin')
const fastifyWs = require('fastify-websocket')

module.exports = fastifyPlugin((fastify, opts, done) => {
  opts = Object.assign({}, opts)

  const wsio = new Server(opts.wsio)

  fastify
    .register(fastifyWs, {})
    .after(() => {
      fastify.get(opts.url || '/', { websocket: true }, (ws, req) => {
        wsio.clientIncoming(ws.socket, req.headers)
      })
    })

  fastify.decorate('wsio', wsio)

  done()
}, {
  name: 'fastify-wsio'
})
