const CONSTANTS = require('./const');
const uuid = require('uuid');

class GenericPayload {

  constructor() {
    this.uid = uuid.v4();
    this.HEADER = {};
    this.DATA = '';
  }

  /**
   * @method parse
   * @description parse a generic payload from a space packet
   * 
   * @param {Number} sequenceFlag 
   * @param {Buffer} data 
   */
  parse(sequenceFlag, data) {
    this.sequenceFlag = sequenceFlag;

    // 1: this is a self contained generic packet
    // 3: this is the end of a string of generic packets
    if( sequenceFlag === 1 || sequenceFlag === 3 ) {
      this._parseHeader(data);

    // sequence flags 0 & 2 would not contain header information
    // just set DATA
    } else {
      this.DATA = data.slice(0, data.length);
    }
  }

  /**
   * @method _parseHeader
   * @description parse the generic payload header.  Unlike the other packet headers, these
   * are nice a order of n bytes so no need for the header parsing utility.
   * 
   * @param {Buffer} data
   */
  _parseHeader(data) {
    let header = data.slice(0, CONSTANTS.GENERIC_PAYLOAD.DEF.HEADER);
    this.DATA = data.slice(CONSTANTS.GENERIC_PAYLOAD.DEF.HEADER, data.length);

    let keyBuffer, key;
    let index = 0;
    for( key in CONSTANTS.GENERIC_PAYLOAD.HEADER_DEF ) {
      keyBuffer = header.slice(index, index+CONSTANTS.GENERIC_PAYLOAD.HEADER_DEF[key]);
      this.HEADER[key] = keyBuffer.readUIntBE(0, CONSTANTS.GENERIC_PAYLOAD.HEADER_DEF[key]);
      index += CONSTANTS.GENERIC_PAYLOAD.HEADER_DEF[key];
    }
  }

}

module.exports = GenericPayload;