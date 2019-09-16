const CONSTANTS = require('./const');
const utils = require('./utils');
const SpacePacket = require('./space-packet');
const convert = require('./convert');

class MPduPacket {

  constructor() {
    this.packet = {};
    this.spacePackets = [];
  }

  parse(payload, lastSpacePacket) {
    let index = 0;
    for( let key in CONSTANTS.M_PDU.DEF ) {
      this.packet[key] = payload.slice(index, index+CONSTANTS.M_PDU.DEF[key]);
      index += CONSTANTS.M_PDU.DEF[key];
    }

    this.packet.HEADER_PARSED = utils.parseHeader(this.packet.HEADER, CONSTANTS.M_PDU.HEADER_DEF);

    // 11111111111 = 2047 ... all 11 first header point bits are 1
    if( this.packet.HEADER_PARSED.FIRST_HEADER_POINT === 2047 ) {
      if( lastSpacePacket ) {
        lastSpacePacket.appendData(this.packet.DATA);
        return lastSpacePacket;
      }
      // WARNING: if we have starting paring and get here, badness
      return null;

    // if we have a last space packet that didn't include the full payload
    // so it's waiting for the overflow data on this packet (first bytes)
    } else if( lastSpacePacket && lastSpacePacket.packet.DATA_OVERFLOW ) {
      lastSpacePacket.appendData(this.packet.DATA.slice(0, lastSpacePacket.packet.DATA_OVERFLOW));
      // TODO: add this to appendData method
      lastSpacePacket.finalize();

    // if we had a last space packet but the packet didn't even have all of the primary
    // header. In this case we still don't know how big the packet even is!
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