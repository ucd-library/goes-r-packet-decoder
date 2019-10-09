const processor = require('./lib/binary-stream-processor');
// processor();

const fs = require('fs');
// processor(fs.createReadStream('subgrabpackets.dat'));
processor(fs.createReadStream('7am_g.dat'));