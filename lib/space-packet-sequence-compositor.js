const fs = require('fs-extra');
const path = require('path');
const DIR = path.join(__dirname, '..', 'images', 'test');


if( fs.existsSync(DIR) ) fs.removeSync(DIR);
fs.mkdirpSync(DIR);

class SpacePacketSequenceCompositor {

  constructor() {
    // store data by products
    this.data = {
      image : {},
      generic : {}
    }

    this.dataHandlers = [];

    this.time = Date.now();
  }

  registerDataHandler(fn) {
    this.dataHandlers.push(fn);
  }

  getSequence(id, variant) {
    let type;
    if( variant === 0 ) type = 'generic';
    if( variant === 2 || variant === 3 ) type = 'image';
    if( !type ) return null;

    return this.data[type][id];
  }

  setSequence(id, variant, data) {
    let type;
    if( variant === 0 ) type = 'generic';
    if( variant === 2 || variant === 3 ) type = 'image';
    if( !type ) return null;

    return this.data[type][id] = data;
  }

  async process(spacePacket) {
    let id = spacePacket.packet.PRIMARY_HEADER_PARSED.APPLICATION_PROCESS_IDENTIFIER.toString(16);
    let sequenceFlag = spacePacket.packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS;
    let variant = spacePacket.packet.SECONDARY_HEADER_PARSED.GRB_PAYLOAD_VARIANT;

    // HACK
    // fill in bad data to try and complete sequence anyway
    if( !spacePacket.imagePayload &&
        (variant === 3 || variant === 2) && 
        (sequenceFlag === 0 || sequenceFlag === 2 )) {
      global.filledImagePayloads++;
      spacePacket.imagePayload = {
        DATA : Buffer.alloc(spacePacket.packet.DATA.length)
      };
    }
    if( !spacePacket.imagePayload && !spacePacket.genericPayload ) return;

    let currentSequence = this.getSequence(id, variant);

    if( !currentSequence ) {
      currentSequence = new SequenceBuffer(id, variant);
      currentSequence.add(spacePacket);
      this.setSequence(id, variant, currentSequence);
    } else {
      let success = currentSequence.add(spacePacket);

      // start over
      if( !success ) {
        currentSequence.setValidSequence();
        currentSequence.finalize();
        await this.emitFinalizedSequence(id, variant);

        currentSequence = new SequenceBuffer(id, variant);
        currentSequence.add(spacePacket);
        this.setSequence(id, variant, currentSequence);
      }
    }

    // check if adding the packet completed the sequence
    if( currentSequence.finalized ) {
      await this.emitFinalizedSequence(id, variant);
    }

    // loop through existing sequence
    for( let type in this.data ) {
      let buffers = this.data[type];
      for( let id in buffers ) {
        // this can be null if removed
        if( !buffers[id] ) continue;

        // check for any sequence that is out of time in buffer
        if( buffers[id].finalize() ) {
          await this.emitFinalizedSequence(id, buffers[id].variant);
        }
      }
    }
  }

  async emitFinalizedSequence(id, variant) {
    let sequence = this.getSequence(id, variant);
    this.setSequence(id, variant, null);

    // if we do not have a valid sequence, quite
    if( !sequence.valid ) {
      return;
    }

    if( variant === 2 || variant === 3 ) {
      let data = Buffer.concat(sequence.packets.map(sp => sp.imagePayload.DATA));
      let imgHeader = sequence.packets[0].imagePayload.HEADER;
      let imgData = data.slice(0, imgHeader.OCTET_OFFSET_TO_DQF_FRAGMENT);
      let dfqData = data.slice(imgHeader.OCTET_OFFSET_TO_DQF_FRAGMENT+1, data.length);

      await this.sendToHandlers('image', {
        headers : imgHeader,
        spHeaders : {
          primary: sequence.packets[0].packet.PRIMARY_HEADER_PARSED,
          secondary: sequence.packets[0].packet.SECONDARY_HEADER_PARSED
        },
        data : imgData,
        dfqData : dfqData
      });
    } else if( variant === 0 ) {
      await this.sendToHandlers('generic', {
        headers : sequence.packets[0].genericPayload.HEADER,
        spHeaders : {
          primary: sequence.packets[0].packet.PRIMARY_HEADER_PARSED,
          secondary: sequence.packets[0].packet.SECONDARY_HEADER_PARSED
        },
        data : Buffer.concat(sequence.packets.map(sp => sp.genericPayload.DATA))
      });
    }

  }

  async sendToHandlers(type, data) {
    for(let fn of this.dataHandlers ) {
      await fn({type, data});
    }
  }

}

class SequenceBuffer {

  constructor(id, variant) {
    this.id = id;
    this.variant = variant;
    this.finalized = false;
    this.packets = [];
    this.lastUpdated = -1;
    this.invalidReason = '';
  }

  add(packet) {
    // safety check
    // if we know are start and end, see that the sequence is in the middle
    if( this.packets.length > 1 ) {
      let sequenceId = packet.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT;
      let sequenceFlag = packet.packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS;
      if( sequenceFlag === 3 ) return false;

      let first = this.packets.find(p => (p.packet.PRIMARY_HEADER_PARSED || {}).SEQUENCE_FLAGS === 1);
      let last = this.packets.find(p => (p.packet.PRIMARY_HEADER_PARSED || {}).SEQUENCE_FLAGS === 2);

      if( first ) {
        if( first.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT > sequenceId ) {
          return false;
        }
        if( sequenceFlag !== 0 && sequenceFlag !== 2 ) {
          return false;
        }
      }

      if( last ) {
        if( last.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT < sequenceId ) {
          return false;
        }
        if( sequenceFlag !== 0 && sequenceFlag !== 1 ) {
          return false;
        }
      }
    } 

    this.lastUpdated = Date.now();
    this.packets.push(packet);
    this.setValidSequence();
    this.finalize();

    return true;
  }

  finalize() {
    if( this.finalized ) return true;

    // we have filled a valid sequence, start / stop
    if( this.valid ) {
      this.finalized = true;
      return true;
    }

    let time = Date.now();
    if( time - this.lastUpdated < 10*1000 ) return false;

    this.finalized = true;
    return true;
  }

  hasLoopBack() {
    for( let sp of this.packets ) {
      if( sp.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT === 16383 ) {
        return true;
      }
    }
    return false;
  }

  setValidSequence() {
    // does the sequence count loop back over 16383, if so, adjust counts
    if( this.hasLoopBack() ) {
      for( let sp of this.packets ) {
        if( sp.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT < 8000 ) {
          sp.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT += 16384;
        }
      }
    }

    this.packets.sort((sp1, sp2) => {
      if( sp1.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT < sp2.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT ) return -1;
      if( sp1.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT > sp2.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT ) return 1;
      return 0;
    });

    let start = this.packets[0].packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT;
    for( let i = 1; i < this.packets.length; i++ ) {
      let p = this.packets[i].packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT;
      if( i+start !== p ) {
        this.invalidReason = 'missing seq in packets: '+(i+start);
        this.valid = false;
        return;
      }
      if( i < this.packets.length-1 && this.packets[i].packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS !== 0 ) {
        this.invalidReason = 'middle seq packet not zero: '+this.packets[i].packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS;
        this.valid = false;
        return;
      }
    }

    // check start and end are correct values
    if( this.packets.length === 1 ) {
      if( this.packets[0].packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS !== 3 ) {
        this.invalidReason = 'sequnce of length 1 does not have seq flag of 3';
        this.valid = false;
        return;
      }
    } else {
      if( this.packets[0].packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS !== 1 ||
          this.packets[this.packets.length-1].packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS !== 2 ) {
        this.invalidReason = 'sequnce does not start with flag 1 and end with flag 2';
        this.valid = false;
        return;
      }
    }

    this.valid = true;
  }

}

module.exports = new SpacePacketSequenceCompositor();