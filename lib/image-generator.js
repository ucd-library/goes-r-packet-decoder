const fs = require('fs-extra');
const path = require('path');
const imagemagick = require('imagemagick-native');
const DIR = path.join(__dirname, '..', 'images', 'test');

if( fs.existsSync(DIR) ) fs.removeSync(DIR);
fs.mkdirpSync(DIR);

class ImageGenerator {

  constructor() {
    // store data by products
    this.data = {}
    this.success = 0;
    this.failed = 0;
  }

  process(spacePacket) {
    if( !spacePacket.imagePayload ) return;

    let id = spacePacket.packet.PRIMARY_HEADER_PARSED.APPLICATION_PROCESS_IDENTIFIER.toString(16);
    let sequenceFlag = spacePacket.packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS;
    let currentSequence = this.data[id];
    
    if( currentSequence && sequenceFlag !== 0 && sequenceFlag !== 2 ) {
      // console.error(`Packets out of sequence for ${id}.  Ignoring`, currentSequence === undefined || currentSequence === null, sequenceFlag);
      this.data[id] = null;
      return;
    }

    if( !currentSequence && (sequenceFlag === 1 || sequenceFlag === 3) ) {
      this.data[id] = [spacePacket];
      if( sequenceFlag === 3 ) this.finalize(id);
      return;
    }

    if( currentSequence ) {
      currentSequence.push(spacePacket);
      if( sequenceFlag === 2 ) this.finalize(id);
      return;
    }
    
    // console.error(`Error processing space packet for ${id}.  Ignoring`, currentSequence === undefined || currentSequence === null, sequenceFlag);
  }

  finalize(id) {
    let sequence = this.data[id];
    sequence.sort((sp1, sp2) => {
      if( sp1.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT < sp2.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT ) return -1;
      if( sp1.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT > sp2.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT ) return 1;
      return 0;
    });

    let imgHeader = sequence[0].imagePayload.HEADER;
    let data = Buffer.concat(sequence.map(sp => sp.imagePayload.DATA));
    let imgData = data.slice(0, imgHeader.OCTET_OFFSET_TO_DQF_FRAGMENT);
    let dfqData = data.slice(imgHeader.OCTET_OFFSET_TO_DQF_FRAGMENT+1, data.length);
    
    let filename = id+'_'+
      imgHeader.SECONDS_SINCE_EPOCH+'_'+
      imgHeader.UPPER_LOWER_LEFT_X_COORDINATE+'_'+
      imgHeader.UPPER_LOWER_LEFT_Y_COORDINATE;



    try {
      imgData = imagemagick.convert({
        srcData: imgData,
        srcFormat : 'JP2',
        format: 'PNG',
        quality: 100 // (best) to 1 (worst)
      });
      fs.writeFileSync(path.join(DIR, filename+'.png'), imgData);
      this.success++;
    } catch(e) {
      console.log('Failed to convert jp2 to png, ', id);
      console.log(imgData.length, imgHeader.OCTET_OFFSET_TO_DQF_FRAGMENT, data.length);

      let start = sequence[0].packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT;
      console.log(sequence[0].packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS);
      for( let i = 1; i < sequence.length; i++ ) {
        let p = sequence[i].packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT;
        if( i+start !== p ) {
          console.error('invalid sequence', i+start, p);
          console.log(JSON.stringify(sequence.map(sp => sp.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT)))
          break;
        }
      }
      console.log(sequence[sequence.length-1].packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS);

      this.failed++;
    } 
    fs.writeFileSync(path.join(DIR, filename+'.json'), JSON.stringify(imgHeader, '  ', '  '));

    this.data[id] = null;
  }

}

module.exports = new ImageGenerator();