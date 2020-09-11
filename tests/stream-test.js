const path = require('path');
const Processor = require('../lib/binary-stream-processor');
// processor();

const fs = require('fs');
// processor(fs.createReadStream('subgrabpackets.dat'));

let processor = new Processor({
  live: true,
  consoleLogStatus : false,
  // csvDebug : true,
  // filter : /^91$/i,
  imageBlock : {
    post : {
      url : 'http://localhost:3000',
      headers : {
        authorization : 'bearer f21das98asdjkl39'
      }
    }
  },
  generic : {
    post : {
      url : 'http://localhost:3000',
      headers : {
        authorization : 'bearer f21das98asdjkl39'
      }
    }
  }
})
// processor.pipe(fs.createReadStream(path.join(__dirname, '8am_g.dat')));
processor.pipe();