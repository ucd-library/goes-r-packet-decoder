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

  parse(payload, lastSpacePacket) {
    let index = 0;
    for( let key in CONSTANTS.CADU.DEF ) {
      this.packet[key] = payload.slice(index, index+CONSTANTS.CADU.DEF[key]);
      index += CONSTANTS.CADU.DEF[key];
    }

    this._parseHeader();
    console.log(this.packet.HEADER_PARSED);

    // this.mpduPacket = new MPduPacket();

    // possibly returns a space packet that is waiting to be filled with data
    // return this.mpduPacket.parse(this.packet.DATA, lastSpacePacket);
  }

  _parseHeader() {
    let header = this.packet.HEADER.readUIntBE(0, 6);
    this.packet.HEADER_PARSED = {};

    let index = 0;
    for( let chunk of CONSTANTS.CADU.HEADER_DEF ) {
      let shift = chunk.size;
      // slice of chunk of header
      console.log(index, index+chunk.size);
      let header = this.packet.HEADER.slice(index, index+chunk.size).readUIntBE(0, chunk.size/8);
      index += chunk.size/8;

      for( let key in chunk.headers ) {
        shift -= chunk.headers[key].length
        // console.log(key, shift);
        // console.log(convert.dec2bin(header), convert.dec2bin(chunk.headers[key].mask))
        // console.log(convert.dec2bin(header >>> shift), convert.dec2bin(chunk.headers[key].mask >>> shift))
        this.packet.HEADER_PARSED[key] = (header >>> shift) & (chunk.headers[key].mask >>> shift);
        // console.log(convert.dec2bin(this.packet.HEADER_PARSED[key]));
      }
    }

    // let shift = CONSTANTS.CADU.DEF.HEADER*8;
    // for( let key in CONSTANTS.CADU.HEADER_DEF ) {
    //   shift -= CONSTANTS.CADU.HEADER_DEF[key].length;
    //   console.log(key, shift)
    //   console.log(convert.dec2bin(header), convert.dec2bin(header << 2));
    //   console.log(convert.dec2bin(CONSTANTS.CADU.HEADER_DEF[key].mask), convert.dec2bin(CONSTANTS.CADU.HEADER_DEF[key].mask  >>> 2));
    //   this.packet.HEADER_PARSED[key] = (header >>> 2) & (CONSTANTS.CADU.HEADER_DEF[key].mask >>> 2);
    //   console.log(this.packet.HEADER_PARSED[key]);
    // }
  }

}

module.exports = CaduPacket;