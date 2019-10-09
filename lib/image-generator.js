const fs = require('fs-extra');
const path = require('path');
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
      if( msg.success ) this.success++;
      else this.failed++;
      
      // let total = this.success+this.failed;
      // let avg = Math.floor((Date.now()-t) / total );

      // let faketime = new Date(STREAM_START_TIME.getTime() + (Date.now() - t));
      // let imgtime = new Date((msg.time*1000)+946728000000);

      // console.log(
      //   'worker finished: '+index, 
      //   ', total write attempts: '+total,',', 
      //   avg + ' avg ms/w',',',
      //   Math.floor(((TOTAL_IMAGES-total) * avg ) / 60000) + ' eta (min), ',
      //   'imgtime: ',imgtime.toISOString(),
      //   ', faketime diff: ', (faketime - imgtime)
      // );
      this.busy[index].promise.resolve();
      this.busy[index] = null;
      this.checkQueue();
    });
  }

  process(spacePacket) {
    let id = spacePacket.packet.PRIMARY_HEADER_PARSED.APPLICATION_PROCESS_IDENTIFIER.toString(16);
    let sequenceFlag = spacePacket.packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS;
    // console.log(id, sequenceFlag, spacePacket.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT, spacePacket.imagePayload? true : false);

    // HACK
    // fill in bad data to try and complete sequence anyway
    if( !spacePacket.imagePayload && sequenceFlag === 0 ) {
      spacePacket.imagePayload = {
        DATA : Buffer.alloc(spacePacket.packet.DATA.length)
      };
    }

    if( !spacePacket.imagePayload ) return;

    let currentSequence = this.data[id];
   
    // console.log(id, sequenceFlag, spacePacket.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT);

    // Might need to re-think this
    if( currentSequence && sequenceFlag !== 0 && sequenceFlag !== 2 ) {
      console.error(`Packets out of sequence for ${id}.  Ignoring`, sequenceFlag);
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
      let last = currentSequence[currentSequence.length-1];
      if( spacePacket.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT < 8000 && last.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT > 16380 ) {
        // fixing loopback sequence count
        spacePacket.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT += 16384;
      }

      currentSequence.push(spacePacket);
      if( sequenceFlag === 2 ) {
        return this.finalize(id);
      }
      return;
    }
    
    // console.error(`Error processing space packet for ${id}`, currentSequence ? true : false, sequenceFlag, spacePacket.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT);
  }

  isValidSequence(id, sequence) {
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
        // console.log(i+'-'+sequence.length, i+start, p, sequence[i-1].packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT)
        // this.invalidSequences.push(filename);

        return false;
      }
    }

    // check start and end are correct values
    if( sequence.length === 1 ) {
      if( sequence[0].packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS !== 3 ) {
        // this.invalidSequences.push(filename);
        return false;
      }
    } else {
      if( sequence[0].packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS !== 1 ||
          sequence[sequence.length-1].packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS !== 2 ) {
        // this.invalidSequences.push(filename);
        return false;
      }
    }

    // this.validSequences.push(filename);
    return true;
  }

  async finalize(id) {
    let sequence = this.data[id];
    this.data[id] = null;

    let validSequence = this.isValidSequence(id, sequence);
    if( !validSequence ) {
      this.data[id] = null;
      return;
    }

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
  }

  writeImage(msg) {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({msg, promise: {resolve, reject}});
      this.checkQueue();
    });
  }

  checkQueue() {
    if( this.writeQueue.length === 0 ) {
      if( this.streamClosed ) {
        console.log('images generated: '+this.success);
        console.log('images failed: '+this.failed);
        // console.log('images invalid sequences: '+this.invalidSequences.length);
        process.exit();
      }
      return;
    }

    for( let i = 0; i < this.busy.length; i++ ) {
      if( !this.busy[i] ) {
        let t = this.writeQueue.shift();
        t.promise.resolve();
        // this.busy[i] = this.writeQueue.shift();
        // this.busy[i].promise.resolve();
        this.imageWriters[i].send(this.busy[i].msg);
        return;
      }
    }
  }
}

module.exports = new ImageGenerator();