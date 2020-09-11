const {config} = require('./const');

class SpacePacketSequenceCompositor {

  constructor() {
    // store data by products and time
    this.data = {}
    // array of callback to handle data ready events
    this.dataHandlers = [];
  }

  registerDataHandler(fn) {
    this.dataHandlers.push(fn);
  }

  getSequence(apid) {
    return this.data[apid];
  }

  setSequence(apid, sequenceBuffer) {
    return this.data[apid] = sequenceBuffer;
  }

  removeSequence(apid) {
    this.data[apid] = null;
  }

  async process(spacePacket) {
    let id = spacePacket.packet.PRIMARY_HEADER_PARSED.APPLICATION_PROCESS_IDENTIFIER.toString(16);
    let time = spacePacket.packet.SECONDARY_HEADER_PARSED.DAYS_SINCE_THE_EPOCH+'_'+
                spacePacket.packet.SECONDARY_HEADER_PARSED.MILLISECONDS_OF_THE_DAY;
    let variant = spacePacket.packet.SECONDARY_HEADER_PARSED.GRB_PAYLOAD_VARIANT;

    if( !spacePacket.imagePayload && !spacePacket.genericPayload ) return;

    let currentSequence = this.getSequence(id);

    if( !currentSequence ) {
      currentSequence = new SequenceBuffer(id, time, variant);
      currentSequence.add(spacePacket);
      this.setSequence(id, currentSequence);
    } else {
      // if this fails, it means the current packet was unable
      // to insert into sequence, so we will fire off the 
      // current sequence and start again.
      let success = currentSequence.add(spacePacket);

      // start over
      if( !success ) {
        currentSequence.setValidSequence();
        currentSequence.finalize();
        await this.emitFinalizedSequence(id);

        currentSequence = new SequenceBuffer(id, time, variant);
        currentSequence.add(spacePacket);
        this.setSequence(id, currentSequence);
      }
    }

    // check if adding the packet completed the sequence
    if( currentSequence.finalized ) {
      await this.emitFinalizedSequence(id);
    }

    // loop through existing sequence
    for( let apid in this.data ) {
      let buffer = this.data[apid];

      if( buffer && buffer.finalize() ) {
        await this.emitFinalizedSequence(apid);
      }
    }
  }

  async emitFinalizedSequence(apid) {
    let sequence = this.getSequence(apid);
    this.removeSequence(apid);

    // if we do not have a valid sequence, quite
    if( !sequence.valid ) {
      return;
    }

    if( sequence.variant === 2 || sequence.variant === 3 ) {
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
    } else if( sequence.variant === 0 ) {
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

  constructor(apid, time, variant) {
    this.apid = apid;
    this.time = time;
    this.variant = variant;
    this.finalized = false;
    this.packets = [];
    this.lastUpdated = -1;
    this.invalidReason = '';
    this.expired = false;

    this.loopBack = false;
  }

  add(packet) {
    // safety check
    // if we know are start and end, see that the sequence is in the middle
    if( this.packets.length > 1 ) {
      let sequenceId = packet.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT;
      if( this.hasLoopBack() && sequenceId < 8000 ) {
        sequenceId += 16384;
      }

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
    if( time - this.lastUpdated < config.imageFragmentBufferTimer ) return false;

    this.expired = true;
    this.finalized = true;
    return true;
  }

  hasLoopBack() {
    if( this.loopBack ) return true;

    for( let sp of this.packets ) {
      if( sp.packet.PRIMARY_HEADER_PARSED.PACKET_SEQUENCE_COUNT === 16383 ) {
        this.loopBack = true;
        break;
      }
    }

    return this.loopBack;
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
        // check if this is a duplicate
        if( i+start-1 === p ) {
          start--; // adjust offset to 'skip' packet
          continue;
        }

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