const CONSTANTS = require('./const');
const utils = require('./utils');
const MPduPacket = require('./m-pdu-packet');
const convert = require('./convert');

// CRC: https://public.ccsds.org/Pubs/732x0b3e1.pdf
// Page 4-7

class CaduPacket {

  constructor() {
    this.packet = {};
  }

  /**
   * @method parse
   * @description parse a cadu packet.  The payload is expected to be a full Cadu packet
   * with the starting bytes being the Sync code (0x1ACFFC1D) and length of 2048 bytes
   * 
   * @param {Buffer} payload
   * @param {SpacePacket} lastSpacePacket if the last space packet parsed from the last cadu packet
   * was not complete, it should be pased to the parse function here so it can be appended to.
   * 
   * @returns {SpacePacket} either returns null or a SpacePacket waiting for data from the next
   * cadu packet.
   */
  parse(payload, lastSpacePacket) {
    let index = 0;
    for( let key in CONSTANTS.CADU.DEF ) {
      this.packet[key] = payload.slice(index, index+CONSTANTS.CADU.DEF[key]);
      index += CONSTANTS.CADU.DEF[key];
    }

    this._parseHeader();

    this.mpduPacket = new MPduPacket();

    // possibly returns a space packet that is waiting to be filled with data
    return this.mpduPacket.parse(this.packet.DATA, lastSpacePacket);
  }

  _parseHeader() {
    this.packet.HEADER_PARSED = utils.parseHeader(this.packet.HEADER, CONSTANTS.CADU.HEADER_DEF);
  }

}

module.exports = CaduPacket;