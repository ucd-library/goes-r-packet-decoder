const CONSTANTS = require('./const');
const utils = require('./utils');

class ImagePayload {

  constructor() {
    this.HEADER = {};
    this.DATA = '';
  }

  parse(sequenceFlag, data) {
    if( sequenceFlag === 1 || sequenceFlag === 3 ) {
      this._parseHeader(data);
    } else {
      this.DATA = data.slice(0, data.length-2);
    }
  }

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