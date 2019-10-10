const CONSTANTS = require('./const');
const CaduPacket = require('./cadu-packet');
const spSequenceCompositor = require('./space-packet-sequence-compositor');
const imageBuffer = require('./image-buffer');
const csvDebug = require('./utils/csv-debugging');


let mainbuffer = Buffer.alloc(0);
let c = 0, running = false;
let payload, packet, lastSpacePacket = null, index;

// https://www.goes-r.gov/users/docs/PUG-GRB-vol4.pdf

// let packets = [];

global.spacePackets = 0;
global.spacePacketErrors = 0;
global.invalidSequences = 0;
global.filledImagePayloads = 0;

spSequenceCompositor.registerDataHandler(async msg => {
  if( msg.type === 'image' ) {
    await handleImageFragment(msg.data);
  } else if( msg.type === 'generic' ) {
    await handleGenericPayload(msg.data);
  }
});

module.exports = (stream) => {
  if( !stream ) stream = process.openStdin();

  stream.on('data', async data => {
    mainbuffer = Buffer.concat([mainbuffer, data]);
    await runLoop();
  });

  stream.on('close', async () => {
    console.log('Stream closed');
    console.log('Space Packets parsed: ', c);
    spSequenceCompositor.streamClosed = true;
    await csvDebug.writeFiles();
    console.log(global.spacePackets,
      global.spacePacketErrors, global.invalidSequences, global.filledImagePayloads);
  });
}

async function handleImageFragment(image) {
  let data = {
    HEADER : image.headers,
    DATA : image.data
  }
  imageBuffer.add(image.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER, data);
  imageBuffer.finalize();
}

async function handleGenericPayload(generic) {
  if( generic.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER > 1536 ) {
    return;
  }
  if( generic.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER <  768 ||
    generic.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER > 771) {
    return;
  }

  console.log('------');
  console.log(generic.headers);
  console.log(generic.spHeaders);
  console.log(generic.data.toString());
  console.log('------');
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
      await spSequenceCompositor.process(sp);
    }

  }

  running = false;
}