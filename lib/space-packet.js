const CONSTANTS = require('./const');
const utils = require('./utils');
const ImagePayload = require('./image-payload');
const ConvertBase = require('./convert');

class SpacePacket {

  constructor() {
    this.packet = {};
  }

  parse(startIndex, data) {
    let index = startIndex*2;

    if( this.packet.PRIMARY_HEADER_NOT_FULLY_SET ) {
      let missingLength = (CONSTANTS.SPACE_PACKET.DEF.PRIMARY_HEADER*2) - this.packet.PRIMARY_HEADER.length;
      this.packet.PRIMARY_HEADER += data.substr(0, missingLength);
      startIndex = missingLength;
    } else {
      this.packet.PRIMARY_HEADER = data.substr(index, CONSTANTS.SPACE_PACKET.DEF.PRIMARY_HEADER*2);
    }

    if( this.packet.PRIMARY_HEADER.length < CONSTANTS.SPACE_PACKET.DEF.PRIMARY_HEADER*2 ) {
      if( this.packet.PRIMARY_HEADER_NOT_FULLY_SET ) throw new Error('badness');
      this.packet.PRIMARY_HEADER_NOT_FULLY_SET = true;
      return;
    }



    this._parseHeader();
    // the secondary header is considered part of the data payload and may exist in multiple m_pdu packets 
    // so you can't read it yet

    // start of space packet + primary header + secondary header
    let dataStart = startIndex*2 + CONSTANTS.SPACE_PACKET.DEF.PRIMARY_HEADER*2;

    // https://www.goes-r.gov/users/docs/PUG-GRB-vol4.pdf
    // see section 4.5.1 Primary Header Data Fields
    // under Packet Data Length
    // "This 16 bit field contains the size in octets of the Packet less the size of the Packet Primary Header plus one"
    // thus where the space packet started + header length + this random unexplained 1 byte plus the Packet Data Length
    let dataEnd = (startIndex*2) + (CONSTANTS.SPACE_PACKET.DEF.PRIMARY_HEADER*2) + 2 + (this.packet.PRIMARY_HEADER_PARSED.PACKET_DATA_LENGTH*2) ;

    this.packet.START_INDEX = startIndex;
    this.packet.DATA_START_INDEX = dataStart/2;
    this.packet.DATA_END_INDEX = dataEnd/2;

    let actualEnd = dataEnd > data.length ? data.length : dataEnd;
    this.packet.DATA = data.substr(dataStart, actualEnd - dataStart);

    if( dataEnd > data.length ) {
      this.packet.DATA_OVERFLOW = (dataEnd - data.length)/2;
    } else {
      this.finalize();
    }

  }

  _parseHeader() {
    let header = Buffer.from(this.packet.PRIMARY_HEADER, 'hex').readUIntBE(0, 6);
    this.packet.PRIMARY_HEADER_PARSED = {};

    let index = 0;
    for( let key in CONSTANTS.SPACE_PACKET.PRIMARY_HEADER_DEF ) {
      this.packet.PRIMARY_HEADER_PARSED[key] = utils.readBinary(
        header, 
        index, 
        CONSTANTS.SPACE_PACKET.PRIMARY_HEADER_DEF[key], 
        this.packet.PRIMARY_HEADER.length*4
      );
      if( key === 'APPLICATION_PROCESS_IDENTIFIER' ) {
        this.packet.PRIMARY_HEADER_PARSED.APPLICATION_PROCESS_IDENTIFIER_HEX = ConvertBase.dec2hex(this.packet.PRIMARY_HEADER_PARSED.APPLICATION_PROCESS_IDENTIFIER);
      }
      index += CONSTANTS.SPACE_PACKET.PRIMARY_HEADER_DEF[key];
    }
  }

  _parseSecondaryHeader() {
    let lInNibble = CONSTANTS.SPACE_PACKET.DEF.SECONDARY_HEADER*2;
    this.packet.SECONDARY_HEADER = this.packet.DATA.substr(0, lInNibble);
    this.packet.DATA = this.packet.DATA.substr(lInNibble, this.packet.DATA.length-lInNibble);

    this.packet.SECONDARY_HEADER_PARSED = {};
  
    // we have to split this up, greater than 48 bits :(
    let header = Buffer.from(this.packet.SECONDARY_HEADER, 'hex').readUIntBE(0, 2);
    this.packet.SECONDARY_HEADER_PARSED['DAYS_SINCE_THE_EPOCH'] = utils.readBinary(
      header, 
      0, 
      CONSTANTS.SPACE_PACKET.SECONDARY_HEADER_DEF.DAYS_SINCE_THE_EPOCH, 
      2
    );
    
    // now read the rest
    header = this.packet.SECONDARY_HEADER.substr(4, this.packet.SECONDARY_HEADER.length-4);
    let headerLength = header.length;

    header = Buffer.from(header, 'hex').readUIntBE(0, 6);
  
    let index = 0;
    for( let key in CONSTANTS.SPACE_PACKET.SECONDARY_HEADER_DEF ) {
      if( key === 'DAYS_SINCE_THE_EPOCH' ) continue;
      this.packet.SECONDARY_HEADER_PARSED[key] = utils.readBinary(
        header, 
        index, 
        CONSTANTS.SPACE_PACKET.SECONDARY_HEADER_DEF[key], 
        headerLength*8
      );
      index += CONSTANTS.SPACE_PACKET.SECONDARY_HEADER_DEF[key];
    }
  }

  appendData(data) {
    this.packet.APPENDED_DATA = data.length;
    this.packet.DATA += data;
  }

  finalize() {
    this._parseSecondaryHeader();

    // TODO: check packet type
    this.imagePayload = new ImagePayload();
    this.imagePayload.parse(this.packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS, this.packet.DATA);
  }
}

module.exports = SpacePacket;