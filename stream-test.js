const processor = require('./lib/binary-stream-processor');
const fs = require('fs');

processor(fs.createReadStream('subgrabpackets.dat'));