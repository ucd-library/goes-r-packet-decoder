const fs = require('fs-extra');
const path = require('path');
const { fork } = require('child_process');

class WriteLocalFsDispatcher {

  constructor(opts) {
    this.opts = opts;

    fs.mkdirpSync(this.opts.path);

    this.writeQueue = [];
    this.busy = [];
    this.imageWriters = [];
    for( let i = 0; i < opts.workers; i++ ) {
      this._initChildMessageHandler(i, opts.type);
    }
  }

  _initChildMessageHandler(index, type) {
    let childModule = type === 'image' ? 'write-image-block.js' : 'write-generic-payload.js';
    let child = fork(path.join(__dirname, childModule));

    this.busy.push(null);
    this.imageWriters.push(child);

    child.on('message', msg => {
      this.busy[index].promise.resolve();
      this.busy[index] = null;
      this._checkQueue();
    });
  }

  write(headers, data, filename) {
    let msg = {headers, data, filename};
    return new Promise((resolve, reject) => {
      this.writeQueue.push({msg, promise: {resolve, reject}});
      this._checkQueue();
    });
  }

  _checkQueue() {
    if( this.writeQueue.length === 0 ) {
      if( this.streamClosed ) process.exit();
      return;
    }

    for( let i = 0; i < this.busy.length; i++ ) {
      if( !this.busy[i] ) {
        this.busy[i] = this.writeQueue.shift();
        this.imageWriters[i].send(this.busy[i].msg);
        return;
      }
    }
  }

}

module.exports = WriteLocalFsDispatcher;