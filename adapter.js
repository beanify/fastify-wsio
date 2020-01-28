const { EventEmitter } = require('events')

class Room {
  constructor() {
    this.sockets = {}
    this.length = 0
  }

  add(id) {
    if (Object.prototype.hasOwnProperty.call(this.sockets, id)) {
      this.sockets[id] = true
      this.length++;
    }
  }

  del(id) {
    if (Object.prototype.hasOwnProperty.call(this.sockets, id)) {
      delete this.sockets[id]
      this.length--;
    }
  }
}

class Adapter extends EventEmitter {
  constructor(nsp) {
    super()
    this._nsp = nsp;
    this._rooms = {}
    this._sids = {}
    this._encoder = nsp.server.encoder
  }

  add(id, room, fn) {
    const rooms = [room]
    return this.addAll(id, rooms, fn)
  }

  addAll(id, rooms, fn) {
    for (let i = 0; i < rooms.length; i++) {
      let room = rooms[i]
      this._sids[id] = this._sids[id] || {}
      this._sids[id][room] = true;
      this._rooms[room] = this._rooms[room] || new Room()
      this._rooms[room].add(id)
    }

    if (fn) {
      process.nextTick(fn.bind(null, null))
    }
  }

  del(id, room, fn) {
    if (this._sids[id]) {
      delete this._sids[id][room]
    }

    if (Object.prototype.hasOwnProperty.call(this._rooms, room)) {
      this._rooms[room].del(id)
      if (this._rooms[room].length === 0) {
        delete this._rooms[room]
      }
    }

    if (fn) {
      process.nextTick(fn.bind(null, null))
    }
  }

  delAll(id, fn) {
    const rooms = this._sids[id]
    if (rooms) {
      for (let room in rooms) {
        if (Object.prototype.hasOwnProperty.call(this._rooms, room)) {
          this._rooms[room].del(id)
          if (this._rooms[room].length === 0) {
            delete this._rooms[room]
          }
        }
      }
    }
    delete this._sids[id]

    if (fn) {
      process.nextTick(fn.bind(null, null))
    }
  }

  broadcast(packet, opts) {
    const rooms = opts.rooms || []
    const except = opts.except || []
    const flags = opts.flags || {}

    const packetOpts = {
      preEncoded: true,
      volatile: flags.volatile,
      compress: flags.compress
    }

    const ids = {}
    let socket

    packet.nsp = this._nsp.name

    this._encoder.encode(packet, (encodedPackets) => {
      
      if (rooms.length) {
        for (let i = 0; i < rooms.length; i++) {
          let room = this._rooms[rooms[i]]

          if (!room) {
            continue
          }

          const sockets = room.sockets
          for (let id in sockets) {
            if (Object.prototype.hasOwnProperty.call(sockets, id)) {
              if (ids[id] || ~except.indexOf(id)) {
                continue
              }

              socket = this._nsp.connected[id]
              if (socket) {
                socket.packet(encodedPackets, packetOpts)
                ids[id] = true
              }
            }
          }
        }
      } else {
        for (let id in this._sids) {
          if (~except.indexOf(id)) {
            continue
          }

          socket = this._nsp.connected[id]

          if (socket) {
            socket.packet(encodedPackets, packetOpts)
          }
        }
      }
    })
  }

  clients(rooms, fn) {
    if (typeof rooms === 'function') {
      fn = rooms;
      rooms = null
    }

    rooms = rooms || []

    const ids = {}
    const sids = []
    let socket

    if(rooms.length){
      for(let i=0;i<rooms.length;i++){
        const room=this._rooms[rooms[i]]

        if(!room){
          continue
        }

        const sockets=room.sockets

        for(let id in sockets){
          if(Object.prototype.hasOwnProperty.call(sockets,id)){
            if(ids[id]){
              continue
            }
            socket=this._nsp.connected[id]

            if(socket){
              sids.push(id)
              ids[id]=true
            }
          }
        }
      }
    }else{
      for (var id in this._sids) {
        if (Object.prototype.hasOwnProperty.call(this._sids,id)) {
          socket = this._nsp.connected[id];
          if (socket) {
            sids.push(id);
          }
        }
      }
    }

    if(fn){
      process.nextTick(fn.bind(null,null))
    }
  }

  clientRooms(id,fn){
    const rooms=this._sids[id]
    if(fn){
      process.nextTick(fn.bind(null,null,rooms?Object.keys(rooms):null))
    }
  }

}



module.exports = Adapter