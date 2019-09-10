const CONSTANTS = require('./const');
const utils = require('./utils');
const SpacePacket = require('./space-packet');

class MPduPacket {

  constructor() {
    this.packet = {};
    this.spacePackets = [];
  }

  parse(data, lastSpacePacket) {
    let index = 0;
    for( let key in CONSTANTS.M_PDU.DEF ) {
      this.packet[key] = data.substr(index, CONSTANTS.M_PDU.DEF[key]*2);
      index += CONSTANTS.M_PDU.DEF[key]*2;
    }

    let raw = parseInt('0x'+this.packet.HEADER);
    this.packet.HEADER_PARSED = {};

    index = 0;
    for( let key in CONSTANTS.M_PDU.HEADER_DEF ) {
      let mask = utils.getMask(index, CONSTANTS.M_PDU.HEADER_DEF[key], CONSTANTS.M_PDU.DEF.HEADER*8);
      let value = raw & mask;
      this.packet.HEADER_PARSED[key] = value >>> ((CONSTANTS.M_PDU.DEF.HEADER*8) - CONSTANTS.M_PDU.HEADER_DEF[key] - index);
      index += CONSTANTS.M_PDU.HEADER_DEF[key];
    }

    // 11111111111 = 2047 ... all 11 first header point bits are 1
    if( this.packet.HEADER_PARSED.FIRST_HEADER_POINT === 2047 ) {
      if( lastSpacePacket ) {
        lastSpacePacket.appendData(this.packet.DATA);
        return lastSpacePacket;
      }
      // WARNING: if we have starting paring and get here, badness
      return null;
    } else if( lastSpacePacket && lastSpacePacket.packet.DATA_OVERFLOW ) {
      lastSpacePacket.appendData(this.packet.DATA.substr(0, lastSpacePacket.packet.DATA_OVERFLOW*2));
      // TODO: add this to appendData method
      lastSpacePacket.finalize();
    } else if( lastSpacePacket && lastSpacePacket.packet.PRIMARY_HEADER_NOT_FULLY_SET ) {
      lastSpacePacket.parse(0, this.packet.DATA);
    }

    return this._parseSpacePackets();
  }

  _parseSpacePackets() {
    let spacePacket = new SpacePacket();
    spacePacket.parse(this.packet.HEADER_PARSED.FIRST_HEADER_POINT, this.packet.DATA);
    this.spacePackets.push(spacePacket);
    if( spacePacket.packet.PRIMARY_HEADER_NOT_FULLY_SET ) {
      return spacePacket;
    }

    let startIndex = spacePacket.packet.DATA_END_INDEX;
    while( !spacePacket.packet.DATA_OVERFLOW ) {
      spacePacket = new SpacePacket();
      spacePacket.parse(startIndex, this.packet.DATA);
      this.spacePackets.push(spacePacket);
      if( spacePacket.packet.PRIMARY_HEADER_NOT_FULLY_SET ) {
        return spacePacket;
      }

      startIndex = spacePacket.packet.DATA_END_INDEX;
    }

    return spacePacket;
  }

}

module.exports = MPduPacket;