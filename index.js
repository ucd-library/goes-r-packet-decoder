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
    if( packets.length === 3 ) break;
  }

  packets.forEach(packet => {
    console.log(packet.mpduPacket.packet.HEADER_PARSED)
    packet.mpduPacket.spacePackets.forEach(sp => {
      sp.DATA_LENGTH = sp.packet.DATA.length / 2;
      delete sp.packet.DATA;
      console.log(sp);
      console.log('');
    });
    console.log('--------------');
  });
  console.log(packets.length);
}

run();