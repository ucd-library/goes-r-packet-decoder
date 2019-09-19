const CONSTANTS = require('./const');
const CaduPacket = require('./cadu-packet');
const imageGenerator = require('./image-generator');

let mainbuffer = new Buffer(0);
let c = 0, running = false;
let payload, packet, lastSpacePacket = null, index;

// https://www.goes-r.gov/users/docs/PUG-GRB-vol4.pdf

let packets = [];

module.exports = (stream) => {
  if( !stream ) stream = process.openStdin();

  stream.on('data', data => {
    mainbuffer = Buffer.concat([mainbuffer, data]);
    runLoop();
  });

  stream.on('close', () => {
    console.log('Stream closed');
    console.log('Space Packets parsed: ', c);
    console.log('images generated: '+imageGenerator.success);
    console.log('images failed: '+imageGenerator.failed);
    

    // console.log(imageGenerator.invalidSequences);

    // let tmp = imageGenerator.invalidSequences
    //   // .filter(s => imageGenerator.validSequences.indexOf(s) > -1)
    //   .filter((value, index, array) => {
    //     return (index === 0) || (value !== array[index-1]);
    //   });
    console.log('images invalid sequences: '+tmp.length);
    // console.log(tmp);

    analyze();
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


function runLoop() {
  if( running ) return;
  running = true;

  index = mainbuffer.indexOf(CONSTANTS.CADU.SYNC, 0, 'hex');
  while( index !== -1 && mainbuffer.length > (index + CONSTANTS.CADU.PACKET_LENGTH)  ) {
    payload = mainbuffer.slice(index, index+CONSTANTS.CADU.PACKET_LENGTH);
    mainbuffer = mainbuffer.slice(index+CONSTANTS.CADU.PACKET_LENGTH, mainbuffer.length);
    index = 0; // reset, we should be reading first byte from here on out


    packet = new CaduPacket();
    packets.push(packet);
    lastSpacePacket = packet.parse(payload, lastSpacePacket);
    if( !packet._isValidPacket() ) continue;

    for( let sp of packet.mpduPacket.spacePackets ) {
      c++;
      if( !sp.finalized ) continue;
      imageGenerator.process(sp);
    }

  }

  running = false;
}