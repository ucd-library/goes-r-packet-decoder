const CONSTANTS = require('./const');
const uuid = require('uuid');

class ImagePayload {

  constructor() {
    this.uid = uuid.v4();
    this.HEADER = {};
    this.DATA = '';
  }

  /**
   * @method parse
   * @description parse a image from a space packet
   * 
   * @param {Number} sequenceFlag 
   * @param {Buffer} data 
   */
  parse(sequenceFlag, data) {
    this.sequenceFlag = sequenceFlag;

    // 1: this is a self contained image packet
    // 3: this is the end of a string of image packets
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
   * @description parse the image payload header.  Unlike the other packet headers, these
   * are nice a order of n bytes so no need for the header parsing utility.
   * 
   * @param {Buffer} data
   */
  _parseHeader(data) {
    let header = data.slice(0, CONSTANTS.IMAGE_PAYLOAD.DEF.HEADER);
    this.DATA = data.slice(CONSTANTS.IMAGE_PAYLOAD.DEF.HEADER, data.length);

    let keyBuffer, key;
    let index = 0;
    for( key in CONSTANTS.IMAGE_PAYLOAD.HEADER_DEF ) {
      keyBuffer = header.slice(index, index+CONSTANTS.IMAGE_PAYLOAD.HEADER_DEF[key]);
      this.HEADER[key] = keyBuffer.readUIntBE(0, CONSTANTS.IMAGE_PAYLOAD.HEADER_DEF[key]);
      index += CONSTANTS.IMAGE_PAYLOAD.HEADER_DEF[key];
    }
  }

}

module.exports = ImagePayload;