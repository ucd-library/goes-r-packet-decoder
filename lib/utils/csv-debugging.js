const stringify = require('csv-stringify');
const fs = require('fs-extra');
const path = require('path');


//https://csv.js.org/stringify/api/ 
let dir = path.join(__dirname, '..', '..', 'csv-debug');

class CsvDebugging {

  constructor() {
    this.headers = {
      cadu : false,
      mpdu : false,
      spacePacket : false,
      imagePacket : false,
      genericPacket : false
    }

    this.csv = {
      cadu : stringify(),
      mpdu : stringify(),
      spacePacket : stringify(),
      imagePacket : stringify(),
      genericPacket : stringify()
    }

    for( let key in this.csv ) {
      this.setWriteHandler(key);
    }

    if( fs.existsSync(dir) ) {
      fs.removeSync(dir);
    }
    fs.mkdirpSync(dir);
  }

  setWriteHandler(key) {
    let file = path.join(dir, key+'.csv');
    this.csv[key].on('readable', () => {
      let row;
      while(row = this.csv[key].read()){
        fs.appendFileSync(file, row);
      }
    });
  }

  async writeFiles() {
    for( let key in this.csv ) {
      this.csv[key].end();
    }
  }

  addCadu(caduPacket) {
    let row = [caduPacket.uid];
    let header = !this.headers.cadu ? ['uid'] : null;
    this.headers.cadu = true;

    for( let key in caduPacket.packet.HEADER_PARSED ) {
      if( header ) header.push(key);
      row.push(caduPacket.packet.HEADER_PARSED[key]);
    }

    if( header ) header.push('VALID_CRC');
    row.push(caduPacket.validCrc);

    if( header ) this.csv.cadu.write(header);
    this.csv.cadu.write(row);

    this.addMpdu(caduPacket.uid, caduPacket.mpduPacket);
  }

  addMpdu(caduId, mpduPacket) {
    if( !mpduPacket ) return;

    let row = [mpduPacket.uid, caduId];
    let header = !this.headers.mpdu ? ['uid', 'cadu_uid'] : null;
    this.headers.mpdu = true;

    for( let key in mpduPacket.packet.HEADER_PARSED ) {
      if( header ) header.push(key);
      row.push(mpduPacket.packet.HEADER_PARSED[key]);
    }

    if( header ) this.csv.mpdu.write(header);
    this.csv.mpdu.write(row);

    let packets = mpduPacket.spacePackets || [];
    for( let packet of packets ) {
      this.addSpacePacket(caduId, mpduPacket.uid, packet);
    }
  }

  addSpacePacket(caduId, mpduId, spacePacket) {
    if( !spacePacket ) return;

    let row = [spacePacket.uid, caduId, mpduId];
    let header = !this.headers.spacePacket ? ['uid', 'cadu_uid', 'mpdu_uid'] : null;
    this.headers.spacePacket = true;

    for( let key in spacePacket.packet.PRIMARY_HEADER_PARSED ) {
      if( header ) header.push(key);
      row.push(spacePacket.packet.PRIMARY_HEADER_PARSED[key]);
    }

    for( let key in spacePacket.packet.SECONDARY_HEADER_PARSED ) {
      if( header ) header.push(key);
      row.push(spacePacket.packet.SECONDARY_HEADER_PARSED[key]);
    }

    if( header ) this.csv.spacePacket.write(header);
    this.csv.spacePacket.write(row);

    this.addImagePacket(caduId, mpduId, spacePacket.uid, spacePacket.imagePayload);
    this.addGenericPacket(caduId, mpduId, spacePacket.uid, spacePacket.genericPayload);
  }

  addGenericPacket(caduId, mpduId, spacePacketId, genericPacket) {
    if( !genericPacket ) return;
    if( Object.keys(genericPacket.HEADER || {}).length === 0 ) return;

    let row = [genericPacket.uid, caduId, mpduId, spacePacketId];

    let header = !this.headers.genericPacket ? ['uid', 'cadu_uid', 'mpdu_uid', 'space_packet_uid'] : null;
    this.headers.genericPacket = true;

    for( let key in genericPacket.HEADER ) {
      if( header ) header.push(key);
      row.push(genericPacket.HEADER[key]);
    }

    if( header ) this.csv.genericPacket.write(header);
    this.csv.genericPacket.write(row);
  }

  addImagePacket(caduId, mpduId, spacePacketId, imagePacket) {
    if( !imagePacket ) return;
    if( Object.keys(imagePacket.HEADER || {}).length === 0 ) return;

    let row = [imagePacket.uid, caduId, mpduId, spacePacketId];

    let header = !this.headers.imagePacket ? ['uid', 'cadu_uid', 'mpdu_uid', 'space_packet_uid'] : null;
    this.headers.imagePacket = true;

    for( let key in imagePacket.HEADER ) {
      if( header ) header.push(key);
      row.push(imagePacket.HEADER[key]);
    }

    if( header ) this.csv.imagePacket.write(header);
    this.csv.imagePacket.write(row);
  }

}

module.exports = new CsvDebugging();