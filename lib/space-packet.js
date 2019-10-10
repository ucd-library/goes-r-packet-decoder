const CONSTANTS = require('./const');
const utils = require('./utils');
const ImagePayload = require('./image-payload');
const GenericPayload = require('./generic-payload');
const {crc32} = require('crc');
const uuid = require('uuid');

class SpacePacket {

  constructor() {
    this.uid = uuid.v4();
    this.packet = {};
  }

  /**
   * @method parse
   * @description parse a space packet.  This may be called more than once if the space packet primary
   * header is spread across more than one m_pdu packet.
   * 
   * @param {Number} startIndex FIRST_HEADER_POINT (byte that first header starts at) for this packet.  May be
   * null if this.PRIMARY_HEADER_NOT_FULLY_SET flag is set
   * @param {Buffer} data m_pdu packet data
   */
  parse(startIndex, data) {
    // we are filling up a packet that didn't even get a full primary header from last m_pdu packet (see below).
    if( this.packet.PRIMARY_HEADER_NOT_FULLY_SET ) {
      let missingLength = (CONSTANTS.SPACE_PACKET.DEF.PRIMARY_HEADER) - this.packet.PRIMARY_HEADER.length;
      this.packet.PRIMARY_HEADER = Buffer.concat([this.packet.PRIMARY_HEADER, data.slice(0, missingLength)]);
      startIndex = missingLength;

    // the full primary header exists in this m_pdu packet
    } else {
      this.packet.PRIMARY_HEADER = data.slice(startIndex, startIndex+CONSTANTS.SPACE_PACKET.DEF.PRIMARY_HEADER);
    }

    // if we didn't even get enough bytes for the primary header, we can't do anything else
    // with this space packet.  Just set the flag a wait for next packet.
    if( this.packet.PRIMARY_HEADER.length < CONSTANTS.SPACE_PACKET.DEF.PRIMARY_HEADER ) {
      if( this.packet.PRIMARY_HEADER_NOT_FULLY_SET ) throw new Error('badness');
      this.packet.PRIMARY_HEADER_NOT_FULLY_SET = true;
      return;
    }


    // the secondary header is considered part of the data payload and may exist in multiple m_pdu packets 
    // so you can't read it yet.  Only reading primary header here.
    this._parsePrimaryHeader();

    // start of space packet + primary header + secondary header
    let dataStart = startIndex + CONSTANTS.SPACE_PACKET.DEF.PRIMARY_HEADER;

    // https://www.goes-r.gov/users/docs/PUG-GRB-vol4.pdf
    // see section 4.5.1 Primary Header Data Fields
    // under Packet Data Length
    // "This 16 bit field contains the size in octets of the Packet less the size of the Packet Primary Header plus one"
    // thus where the space packet started + header length + this random unexplained 1 byte plus the Packet Data Length
    let dataEnd = startIndex + CONSTANTS.SPACE_PACKET.DEF.PRIMARY_HEADER + 1 + this.packet.PRIMARY_HEADER_PARSED.PACKET_DATA_LENGTH;

    this.packet.START_INDEX = startIndex;
    this.packet.DATA_START_INDEX = dataStart;
    this.packet.DATA_END_INDEX = dataEnd;

    // does this packet overflow or is it self contained
    let actualEnd = dataEnd > data.length ? data.length : dataEnd;
    this.packet.DATA = data.slice(dataStart, actualEnd);

    if( dataEnd > data.length ) { // we have to wait for next packet
      this.packet.DATA_OVERFLOW = dataEnd - data.length;
    } else { // we are ready to 'finalize' the parsing of this packet
      this.finalize();
    }
  }

  /**
   * @method _parsePrimaryHeader
   * @description parse the primary header for this space packet.  The packet header data (this.packet.PRIMARY_HEADER)
   * field is expected to already be set.
   */
  _parsePrimaryHeader() {
    this.packet.PRIMARY_HEADER_PARSED = utils.parseHeader(this.packet.PRIMARY_HEADER, CONSTANTS.SPACE_PACKET.PRIMARY_HEADER_DEF);
    this.pid = this.packet.PRIMARY_HEADER_PARSED.APPLICATION_PROCESS_IDENTIFIER.toString(16);
  }

  appendData(data) {
    this.packet.APPENDED_DATA = data.length;
    this.packet.DATA = Buffer.concat([this.packet.DATA, data]);
  }

  finalize() {
    // Secondary Header Flag:
    // "This bit is set to 0b1 for all GRB Space Packets. All GRB Space Packets contain a secondary header."
    this.packet.SECONDARY_HEADER = this.packet.DATA.slice(0, CONSTANTS.SPACE_PACKET.DEF.SECONDARY_HEADER);
    this.packet.SECONDARY_HEADER_PARSED = utils.parseHeader(this.packet.SECONDARY_HEADER, CONSTANTS.SPACE_PACKET.SECONDARY_HEADER_DEF);
    this.packet.CRC = this.packet.DATA.slice(this.packet.DATA.length-4, this.packet.DATA.length);
    this.packet.DATA = this.packet.DATA.slice(CONSTANTS.SPACE_PACKET.DEF.SECONDARY_HEADER, this.packet.DATA.length-4);

    // CHECK CRC
    let frame = Buffer.concat([this.packet.PRIMARY_HEADER, this.packet.SECONDARY_HEADER, this.packet.DATA]);
    let crc = crc32(frame).toString(16);
    this.validCrc = this.packet.CRC.toString('hex').replace(/^0+/,'') === crc;

    global.spacePackets++;
    if( !this.validCrc ) global.spacePacketErrors++;

    // https://www.goes-r.gov/users/docs/PUG-GRB-vol4.pdf
    // see table 4.5.2-2
    if( this.validCrc ) {

      if( this.packet.SECONDARY_HEADER_PARSED.GRB_PAYLOAD_VARIANT === 3 ||
          this.packet.SECONDARY_HEADER_PARSED.GRB_PAYLOAD_VARIANT === 2 ) {
        this.imagePayload = new ImagePayload();
        this.imagePayload.parse(this.packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS, this.packet.DATA);
      } else if( this.packet.SECONDARY_HEADER_PARSED.GRB_PAYLOAD_VARIANT === 0 ) {
        this.genericPayload = new GenericPayload();
        this.genericPayload.parse(this.packet.PRIMARY_HEADER_PARSED.SEQUENCE_FLAGS, this.packet.DATA);
      }

    }
    this.finalized = true;
  }
}

module.exports = SpacePacket;