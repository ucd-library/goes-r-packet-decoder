const CONSTANTS = require('./const');
const utils = require('./utils');
const SpacePacket = require('./space-packet');
const uuid = require('uuid');

class MPduPacket {

  constructor() {
    this.uid = uuid.v4();
    this.packet = {};
    this.spacePackets = [];
  }

  /**
   * @method parse
   * @description parse a mpdu packet. These packets may have multiple space packets or just
   * part of the contents of a single packet.  Additionally, there may be a partially filled
   * space packet based, which needs to be filled with the first bytes of the m_pdu packet.
   * 
   * @param {Buffer} payload packet bytes
   * @param {SpacePacket} lastSpacePacket
   * 
   * @returns {SpacePacket} returns null or SpacePacket if there are is a partially filled
   * space packet at the end of the this m_pdu packet.
   */
  parse(payload, lastSpacePacket) {
    let index = 0;

    // split out the header and the payload bytes
    for( let key in CONSTANTS.M_PDU.DEF ) {
      this.packet[key] = payload.slice(index, index+CONSTANTS.M_PDU.DEF[key]);
      index += CONSTANTS.M_PDU.DEF[key];
    }

    // parse the header
    this.packet.HEADER_PARSED = utils.parseHeader(this.packet.HEADER, CONSTANTS.M_PDU.HEADER_DEF);

    // 11111111111 = 2047 ... all 11 first header point bits are 1
    if( this.packet.HEADER_PARSED.FIRST_HEADER_POINT === 2047 ) {
      if( lastSpacePacket ) {
        lastSpacePacket.appendData(this.packet.DATA);
        return lastSpacePacket;
      }
      // WARNING: if we have starting paring and get here, badness
      console.warn('Received m_pdu packet that said it was a continuation but no prior space packet set');
      return null;

    // if we have a last space packet that didn't include the full payload
    // so it's waiting for the overflow data on this packet (first bytes)
    } else if( lastSpacePacket && lastSpacePacket.packet.DATA_OVERFLOW ) {
      lastSpacePacket.appendData(this.packet.DATA.slice(0, lastSpacePacket.packet.DATA_OVERFLOW));
      // TODO: add this to appendData method
      lastSpacePacket.finalize();
      this.spacePackets.push(lastSpacePacket);

    // if we had a last space packet but the packet didn't even have all of the primary
    // header. In this case we still don't know how big the packet even is!
    } else if( lastSpacePacket && lastSpacePacket.packet.PRIMARY_HEADER_NOT_FULLY_SET ) {
      lastSpacePacket.parse(0, this.packet.DATA);
      if( lastSpacePacket.finalized ) {
        this.spacePackets.push(lastSpacePacket);
      }
    }

    return this._parseSpacePackets();
  }

  /**
   * @method _parseSpacePackets
   * @description we may have more than one space packet per m_pdu packet.  This function
   * starts reading at the FIRST_HEADER_POINT byte provided by the header.  Then loops
   * through reading space packets until there are no bytes left.  The space packet
   * stores it's size, which is used to read the next block.
   */
  _parseSpacePackets() {
    // create and read the first space packet
    let spacePacket = new SpacePacket();
    spacePacket.parse(this.packet.HEADER_PARSED.FIRST_HEADER_POINT, this.packet.DATA);

    // check that the space packet was able to read the full header, if not, return packet
    // to fill via next m_pdu packet.
    if( spacePacket.packet.PRIMARY_HEADER_NOT_FULLY_SET ) {
      return spacePacket;
    }

    // our start index is wherever the last space packet left off.
    let startIndex = spacePacket.packet.DATA_END_INDEX;

    // while we haven't read more bytes than exist in this m_pdu packet, read space packets.
    while( !spacePacket.packet.DATA_OVERFLOW ) {
      this.spacePackets.push(spacePacket);

      // we have read to the exact end of the packet
      if( this.packet.DATA.length === startIndex ) {
        return null;
      }

      spacePacket = new SpacePacket();
      spacePacket.parse(startIndex, this.packet.DATA);

      // just like above check that the space packet was able to read the full header, 
      // if not, return packet to fill via next m_pdu packet.
      if( spacePacket.packet.PRIMARY_HEADER_NOT_FULLY_SET ) {
        return spacePacket;
      }

      // update read index
      startIndex = spacePacket.packet.DATA_END_INDEX;
    }

    // return spacePacket so we can fill
    return spacePacket;
  }

}

module.exports = MPduPacket;