const fs = require('fs-extra');
const CONSTANTS = require('./lib/const');
const CaduPacket = require('./lib/cadu-packet');

async function run() {
  let content = await fs.readFile('subgrabpackets.dat');
  content = content.toString('hex');
  
  let index = content.indexOf(CONSTANTS.CADU.SYNC.toLowerCase());
  let packets = [];
  let lastSpacePacket = null;

  while( index < content.length ) {
    let packet = new CaduPacket();
    packets.push(packet);
    lastSpacePacket = packet.parse(index, content, lastSpacePacket);
    
    index += CONSTANTS.CADU.PACKET_LENGTH*2;
  }

  packets.forEach((packet, i) => {
    packet.mpduPacket.spacePackets.forEach((sp, j) => {
      if( sp.packet.PRIMARY_HEADER_PARSED.APPLICATION_PROCESS_IDENTIFIER === 1108 ) return;

      // sp.DATA_LENGTH = sp.packet.DATA.length / 2;
      // delete sp.packet.DATA;
      console.log(
        sp.packet.PRIMARY_HEADER_PARSED.APPLICATION_PROCESS_IDENTIFIER,
        sp.packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS,
        sp.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT
      );
      if( sp.packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS === 1 ) {
        console.log(sp.imagePayload.HEADER);
      }
      // if( sp.imagePayload ) console.log(sp.imagePayload.HEADER);
      // console.log('-------------');
    });
  });
  console.log(packets.length);
}

run();