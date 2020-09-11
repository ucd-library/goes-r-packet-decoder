const path = require('path');
const Processor = require('../lib/binary-stream-processor');
// processor();

const fs = require('fs');
// processor(fs.createReadStream('subgrabpackets.dat'));

let processor = new Processor({
  live: false,
  consoleLogStatus : false,
  // filter : /^91$/i,
  imageBlock : {
    post : {
      url : 'http://localhost:3000'
    }
  },
  generic : {
    post : {
      url : 'http://localhost:3000'
    }
  }
})
processor.pipe(fs.createReadStream(path.join(__dirname, 'testsecdecorded.dat')));
// processor.pipe();