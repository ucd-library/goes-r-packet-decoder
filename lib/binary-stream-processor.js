const CONSTANTS = require('./const');
const CaduPacket = require('./cadu-packet');

let mainbuffer = new Buffer(0);
let c = 0, running = false;
let payload, packet, lastSpacePacket = null, index;

module.exports = (stream) => {


  stream.on('data', data => {
    mainbuffer = Buffer.concat([mainbuffer, data]);
    runLoop();
  });

  stream.on('close', () => {
    console.log(c);
  });

}

function runLoop() {
  if( running ) return;
  running = true;

  index = mainbuffer.indexOf(CONSTANTS.CADU.SYNC, 0, 'hex');
  while( index !== -1 && mainbuffer.length > (index + CONSTANTS.CADU.PACKET_LENGTH)  ) {
    payload = mainbuffer.slice(index, index+CONSTANTS.CADU.PACKET_LENGTH);
    mainbuffer = mainbuffer.slice(index+CONSTANTS.CADU.PACKET_LENGTH, mainbuffer.length);

    if( c < 10 ) {
      packet = new CaduPacket();
      c++;
      lastSpacePacket = packet.parse(payload, lastSpacePacket);
    }
  }

  running = false;
}