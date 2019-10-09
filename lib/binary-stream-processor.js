const CONSTANTS = require('./const');
const CaduPacket = require('./cadu-packet');
const imageGenerator = require('./image-generator');
const csvDebug = require('./utils/csv-debugging');


let mainbuffer = Buffer.alloc(0);
let c = 0, running = false;
let payload, packet, lastSpacePacket = null, index;

// https://www.goes-r.gov/users/docs/PUG-GRB-vol4.pdf

// let packets = [];

module.exports = (stream) => {
  if( !stream ) stream = process.openStdin();

  stream.on('data', async data => {
    mainbuffer = Buffer.concat([mainbuffer, data]);
    await runLoop();
  });

  stream.on('close', async () => {
    console.log('Stream closed');
    console.log('Space Packets parsed: ', c);
    imageGenerator.streamClosed = true;
    // analyze();

    await csvDebug.writeFiles();
  });

}

function analyze() {
  let index = packets[0].packet.HEADER_PARSED.H_VIRTUAL_CHANNEL_FRAME_COUNT;
  for( let i = 0; i < packets.length; i++ ) {
    if( packets[i].packet.HEADER_PARSED.H_SPACECRAFT_ID !== 80 ) continue;
    
    if( index !== packets[i].packet.HEADER_PARSED.H_VIRTUAL_CHANNEL_FRAME_COUNT ) {
      console.log('Missing CADU packet: ', packets[i].packet.HEADER_PARSED.H_VIRTUAL_CHANNEL_FRAME_COUNT, index)
    }
    index++;
  }
}


async function runLoop() {
  if( running ) return;
  running = true;

  index = mainbuffer.indexOf(CONSTANTS.CADU.SYNC, 0, 'hex');
  while( index !== -1 && mainbuffer.length > (index + CONSTANTS.CADU.PACKET_LENGTH)  ) {
    payload = mainbuffer.slice(index, index+CONSTANTS.CADU.PACKET_LENGTH);
    mainbuffer = mainbuffer.slice(index+CONSTANTS.CADU.PACKET_LENGTH, mainbuffer.length);
    index = 0; // reset, we should be reading first byte from here on out


    packet = new CaduPacket();
    // packets.push(packet);
    lastSpacePacket = packet.parse(payload, lastSpacePacket);
    
    csvDebug.addCadu(packet);
    
    if( !packet._isValidPacket() ) continue;

    for( let sp of packet.mpduPacket.spacePackets ) {
      c++;
      if( !sp.finalized ) continue;
      await imageGenerator.process(sp);
    }

  }

  running = false;
}