const CONSTANTS = require('./const');
const utils = require('./utils');

class ImagePayload {

  constructor() {
    this.HEADER = {};
    this.DATA = '';
  }

  parse(data) {
    let lInNibble = CONSTANTS.IMAGE_PAYLOAD.DEF.HEADER*2;
    let headerStr = data.substr(0, lInNibble);
    this.data = data.substr(lInNibble, data.length-lInNibble);

    for( let key in CONSTANTS.IMAGE_PAYLOAD.HEADER_DEF ) {
      let strLength = CONSTANTS.IMAGE_PAYLOAD.HEADER_DEF[key]/4;
      this.HEADER[key] = parseInt('0x'+utils.flipEndian(headerStr.substr(0, strLength)));
      headerStr = headerStr.substr(strLength, headerStr.length-strLength);
    }
  }

}

module.exports = ImagePayload;