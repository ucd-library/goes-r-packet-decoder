const fs = require('fs-extra');
const CONSTANTS = require('./lib/const');
const CaduPacket = require('./lib/cadu-packet');
const path = require('path');
const concatImages = require('./lib/concat-image-rows');

const imgDir = path.join(__dirname, 'images');
const partsDir = path.join(imgDir, 'parts');
const finalDir = path.join(imgDir, 'final');

async function run() {
  await fs.remove(imgDir);
  await fs.mkdirp(partsDir);
  await fs.mkdirp(finalDir);
  
  let content = await fs.readFile('subgrabpackets.dat');

  let indexBuf = content.indexOf(CONSTANTS.CADU.SYNC, 0, 'hex');

  content = content.toString('hex');

  
  let index = content.indexOf(CONSTANTS.CADU.SYNC.toLowerCase());

  console.log(index, indexBuf);
  return;

  let packets = [];
  let lastSpacePacket = null;

  while( index < content.length ) {
    let packet = new CaduPacket();
    packets.push(packet);
    lastSpacePacket = packet.parse(index, content, lastSpacePacket);    
    index += CONSTANTS.CADU.PACKET_LENGTH*2;
    // if( packets.length === 1000 ) break;
  }


  let validSpacePackets = [];
  packets.forEach((packet, i) => {
    packet.mpduPacket.spacePackets.forEach((sp, j) => {
      if( sp.packet.PRIMARY_HEADER_PARSED.APPLICATION_PROCESS_IDENTIFIER === 1108 ) return;
      validSpacePackets.push(sp);
    });
  });


  let testImageSpacePackets = validSpacePackets.filter(sp => sp.packet.PRIMARY_HEADER_PARSED.APPLICATION_PROCESS_IDENTIFIER_HEX === '91');
  // console.log(testImageSpacePackets.length);



  let currentImage = null;
  let currentBlock = -1;
  let epoch = new Date(2000, 1, 1, 0, 0, 0, 0);
  let lastHeader = null;

  for( let sp of testImageSpacePackets ) {
    if( !sp.imagePayload ) return;

    let SF = sp.packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS;
    let complete = false;

    if( currentImage && currentBlock === -1 ) {
      currentBlock = currentImage.header.IMAGE_BLOCK_SEQUENCE_COUNT;
    } else if( currentImage && currentBlock !== currentImage.header.IMAGE_BLOCK_SEQUENCE_COUNT ) {


      try {
        await concatImages(partsDir, finalDir, currentImage.header.SECONDS_SINCE_EPOCH, currentBlock);
      } catch(e) {
        console.log(e);
      }


      console.log(lastHeader);

      if( currentBlock === 207 ) {
        process.exit();
      }

      await fs.remove(partsDir);
      await fs.mkdirp(partsDir);
      currentBlock = currentImage.header.IMAGE_BLOCK_SEQUENCE_COUNT;
    }

    if( SF === 0 && currentImage ) {
      currentImage.data = Buffer.concat([currentImage.data, Buffer.from(sp.imagePayload.DATA, 'hex')]);
    } else if( SF === 1 ) {
      currentImage = {
        data : Buffer.from(sp.imagePayload.DATA, 'hex'),
        header : sp.imagePayload.HEADER
      }
    } else if( SF === 2 && currentImage ) {
      currentImage.data = Buffer.concat([currentImage.data, Buffer.from(sp.imagePayload.DATA, 'hex')]);
      complete = true;
    } else if( SF === 3 ) {
      currentImage = {
        data : Buffer.from(sp.imagePayload.DATA, 'hex'),
        header : sp.imagePayload.HEADER
      }
      complete = true;
    }

    if( complete ) {
      // let d = new Date(epoch.getTime() + (currentImage.header.SECONDS_SINCE_EPOCH*1000));

      let imgName = currentImage.header.IMAGE_BLOCK_SEQUENCE_COUNT+'_'+currentImage.header.ROW_OFFSET_WITH_IMAGE_BLOCK+'.jp2';
      lastHeader = currentImage.header;

      fs.writeFileSync(path.join(partsDir, imgName), currentImage.data);

      currentImage = null;
    }
  }

}

run();