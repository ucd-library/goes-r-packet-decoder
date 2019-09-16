const CONSTANTS = require('./const');
const CaduPacket = require('./cadu-packet');

let mainbuffer = new Buffer(0);
let c = 0, running = false;
let payload, packet, lastSpacePacket = null, index;


module.exports = (stream) => {
  if( !stream ) stream = process.openStdin();

  stream.on('data', data => {
    mainbuffer = Buffer.concat([mainbuffer, data]);
    runLoop();
  });

  stream.on('close', () => {
    console.log('Stream closed');
    console.log('CADU Packets parsed: '+c);
  });

}

function runLoop() {
  if( running ) return;
  running = true;

  index = mainbuffer.indexOf(CONSTANTS.CADU.SYNC, 0, 'hex');
  while( index !== -1 && mainbuffer.length > (index + CONSTANTS.CADU.PACKET_LENGTH)  ) {
    t2 = Date.now();
    payload = mainbuffer.slice(index, index+CONSTANTS.CADU.PACKET_LENGTH);
    mainbuffer = mainbuffer.slice(index+CONSTANTS.CADU.PACKET_LENGTH, mainbuffer.length);
    index = 0; // reset, we should be reading first byte from here on out

    if( c % 1000 == 0 ) console.log('Packets', c); 
      packet = new CaduPacket();
      c++;
      lastSpacePacket = packet.parse(payload, lastSpacePacket);
    // }
  }

  running = false;
}