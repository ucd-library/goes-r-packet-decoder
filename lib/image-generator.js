const fs = require('fs-extra');
const path = require('path');
const imagemagick = require('imagemagick-native');
const DIR = path.join(__dirname, '..', 'images', 'test');
const { fork } = require('child_process');

if( fs.existsSync(DIR) ) fs.removeSync(DIR);
fs.mkdirpSync(DIR);

const WRITER_COUNT = 3;

class ImageGenerator {

  constructor() {
    // store data by products
    this.data = {}
    this.success = 0;
    this.failed = 0;
    this.invalidSequences = [];
    this.validSequences = [];

    this.writeQueue = [];

    this.busy = [];
    this.imageWriters = [];
    for( let i = 0; i < WRITER_COUNT; i++ ) {
      this._initChildMessageHandler(i)
    }
  }

  _initChildMessageHandler(index) {
    let child = fork(path.join(__dirname, 'write-image.js'));

    this.busy.push(null);
    this.imageWriters.push(child);

    child.on('message', msg => {
      console.log('worker finished', msg, index);
      this.busy[index].promise.resolve();
      this.busy[index] = null;
      this.checkQueue();
    });
  }

  process(spacePacket) {
    if( !spacePacket.imagePayload ) return;

    let id = spacePacket.packet.PRIMARY_HEADER_PARSED.APPLICATION_PROCESS_IDENTIFIER.toString(16);
    let sequenceFlag = spacePacket.packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS;
    let currentSequence = this.data[id];
    
    // Might need to re-think this
    if( currentSequence && sequenceFlag !== 0 && sequenceFlag !== 2 ) {
      // console.error(`Packets out of sequence for ${id}.  Ignoring`, currentSequence === undefined || currentSequence === null, sequenceFlag);
      this.data[id] = null;
      return;
    }

    if( !currentSequence && (sequenceFlag === 1 || sequenceFlag === 3) ) {
      this.data[id] = [spacePacket]
      if( sequenceFlag === 3 ) {
        return this.finalize(id);
      }
      return;
    }

    if( currentSequence ) {
      currentSequence.push(spacePacket);
      if( sequenceFlag === 2 ) {
        return this.finalize(id);
      }
    }
    
    // console.error(`Error processing space packet for ${id}.  Ignoring`, currentSequence === undefined || currentSequence === null, sequenceFlag);
  }

  isValidSequence(id) {
    let sequence = this.data[id];
    sequence.sort((sp1, sp2) => {
      if( sp1.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT < sp2.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT ) return -1;
      if( sp1.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT > sp2.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT ) return 1;
      return 0;
    });

    let imgHeader = sequence[0].imagePayload.HEADER;
    let filename = id+'_'+
      imgHeader.IMAGE_BLOCK_SEQUENCE_COUNT+'_'+
      imgHeader.ROW_OFFSET_WITH_IMAGE_BLOCK+'_'+
      imgHeader.IMAGE_BLOCK_HEIGHT+'_'+
      imgHeader.IMAGE_BLOCK_WIDTH;

    let start = sequence[0].packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT;
    for( let i = 1; i < sequence.length; i++ ) {
      let p = sequence[i].packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT;
      if( i+start !== p ) {
        this.invalidSequences.push(filename);
        return false;
      }
    }

    this.validSequences.push(filename);
    return true;
  }

  async finalize(id, resolve, reject) {
    let validSequence = this.isValidSequence(id);
    if( !validSequence ) {
      this.data[id] = null;
      return;
    }
    let sequence = this.data[id];

    let imgHeader = sequence[0].imagePayload.HEADER;
    let data = Buffer.concat(sequence.map(sp => sp.imagePayload.DATA));
    let imgData = data.slice(0, imgHeader.OCTET_OFFSET_TO_DQF_FRAGMENT);
    let dfqData = data.slice(imgHeader.OCTET_OFFSET_TO_DQF_FRAGMENT+1, data.length);
    
    let filename = path.join(DIR, id+'_'+
      imgHeader.IMAGE_BLOCK_SEQUENCE_COUNT+'_'+
      imgHeader.ROW_OFFSET_WITH_IMAGE_BLOCK+'_'+
      imgHeader.IMAGE_BLOCK_HEIGHT+'_'+
      imgHeader.IMAGE_BLOCK_WIDTH);

    await this.writeImage({imgHeader, imgData, filename});
    // try {
    //   imgData = imagemagick.convert({
    //     srcData: imgData,
    //     srcFormat : 'JP2',
    //     format: 'PNG',
    //     quality: 100 // (best) to 1 (worst)
    //   });
    //   fs.writeFileSync(path.join(DIR, filename+'.png'), imgData);
    //   this.success++;
    // } catch(e) {
    //   console.log('Failed to convert jp2 to png, ', id);
    //   console.log(imgData.length, imgHeader, data.length);
    //   this.failed++;
    // } 
    
    // if( fs.existsSync(path.join(DIR, filename+'.json')) ) {
    //   console.log('dup file', filename);
    // }
    // fs.writeFileSync(path.join(DIR, filename+'.json'), JSON.stringify(imgHeader, '  ', '  '));

    this.data[id] = null;
  }

  writeImage(msg) {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({msg, promise: {resolve, reject}});
      this.checkQueue();
    });
  }

  checkQueue() {
    if( this.writeQueue.length === 0 ) {
      if( this.streamClosed ) process.exit();
      return;
    }

    for( let i = 0; i < this.busy.length; i++ ) {
      if( !this.busy[i] ) {
        this.busy[i] = this.writeQueue.shift();
        console.log('sending msg to worker ', i);
        this.imageWriters[i].send(this.busy[i].msg);
        return;
      }
    }
  }

}

module.exports = new ImageGenerator();