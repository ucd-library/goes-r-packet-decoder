const path = require('path');
const Processor = require('../lib/binary-stream-processor');
// processor();

const fs = require('fs');
// processor(fs.createReadStream('subgrabpackets.dat'));

let processor = new Processor({
  live: true,
  consoleLogStatus : true,
  // csvDebug : true,
  // filter : /^91$/i,
  // imageBlock : {
  //   post : {
  //     url : 'http://localhost:3000',
  //     headers : {
  //       authorization : 'bearer 123'
  //     }
  //   }
  // },
  // generic : {
  //   post : {
  //     url : 'http://localhost:3000',
  //     headers : {
  //       authorization : 'bearer 123'
  //     }
  //   }
  // }
})
// processor.pipe(fs.createReadStream(path.join(__dirname, '8am_g.dat')));
processor.pipe();