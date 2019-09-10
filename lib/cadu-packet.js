const CONSTANTS = require('./const');
const utils = require('./utils');
const MPduPacket = require('./m-pdu-packet');

class CaduPacket {

  constructor() {
    this.packet = {};
  }

  parse(startIndex, data, lastSpacePacket) {
    let raw = data.substr(startIndex, CONSTANTS.CADU.PACKET_LENGTH*2);

    let index = 0;
    for( let key in CONSTANTS.CADU.DEF ) {
      this.packet[key] = raw.substr(index, CONSTANTS.CADU.DEF[key]*2);
      index += CONSTANTS.CADU.DEF[key]*2;
    }

    this._parseHeader();

    this.mpduPacket = new MPduPacket();

    // possibly returns a space packet that is waiting to be filled with data
    return this.mpduPacket.parse(this.packet.DATA, lastSpacePacket);
  }

  _parseHeader() {
    let header = Buffer.from(this.packet.HEADER, 'hex').readUIntBE(0, 6);
    this.packet.HEADER_PARSED = {};

    let index = 0;
    for( let key in CONSTANTS.CADU.HEADER_DEF ) {
      this.packet.HEADER_PARSED[key] = utils.readBinary(
        header, 
        index, 
        CONSTANTS.CADU.HEADER_DEF[key], 
        this.packet.HEADER.length*4
      );
      index += CONSTANTS.CADU.HEADER_DEF[key];
    }
  }

}

module.exports = CaduPacket;