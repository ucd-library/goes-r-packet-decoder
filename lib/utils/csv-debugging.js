const stringify = require('csv-stringify');
const fs = require('fs-extra');
const path = require('path');
const stringifier = stringify()


let dir = path.join(__dirname, '..', '..', 'csv-debug');

class CsvDebugging {

  constructor() {
    this.headers = {
      cadu : false,
      mpdu : false,
      spacePacket : false,
      imagePacket : false
    }

    this.csv = {
      cadu : [],
      mpdu : [],
      spacePacket : [],
      imagePacket : []
    }

    if( fs.existsSync(dir) ) {
      fs.removeSync(dir);
    }
    fs.mkdirpSync(dir);
  }

  async writeFiles() {
    for( let name of this.csv ) {
      let data = await this._generateCsv(this.csv[name]);
      await fs.writeFile(path.join(dir, name+'.csv'), data);
    }
  }

  _generateCsv(data) {
    return new Promise((resolve, reject) => {
      stringify(data, (err, output) => {
        if( err ) reject(err);
        else resolve(output);
      })
    });
  }

  addCadu(caduPacket) {
    let row = [caduPacket.id];
    let header = !this.headers.cadu ? ['uid'] : null;
    this.headers.cadu = false;

    for( let key in caduPacket.packet.HEADER_PARSED ) {
      if( header ) header.push(key);
      row.push(caduPacket.packet.HEADER_PARSED[key]);
    }

    if( header ) header.push('VALID_CRC');
    row.push(caduPacket.validCrc);

    if( header ) this.csv.cadu.push(header);
    this.csv.cadu.push(row);

    this.addMpdu(caduPacket.id, caduPacket.mpduPacket);
  }

  addMpdu(caduId, mpduPacket) {
    if( !mpduPacket ) return;

    let row = [mpduPacket.id, caduId];
    let header = !this.headers.mpdu ? ['uid', 'cadu_uid'] : null;
    this.headers.mpdu = false;

    for( let key in mpduPacket.packet.HEADER_PARSED ) {
      if( header ) header.push(key);
      row.push(mpduPacket.packet.HEADER_PARSED[key]);
    }

    if( header ) this.csv.mpdu.push(header);
    this.csv.mpdu.push(row);

    let packets = mpduPacket.spacePackets || [];
    for( let packet of packets ) {
      this.addSpacePacket(caduId, mpduPacket.id, packet);
    }
  }

  addSpacePacket(caduId, mpduId, spacePacket) {
    if( !spacePacket ) return;

    let row = [spacePacket.id, caduId, mpduId];
    let header = !this.headers.spacePacket ? ['uid', 'cadu_uid', 'mpdu_uid'] : null;
    this.headers.spacePacket = false;

    for( let key in spacePacket.packet.PRIMARY_HEADER_PARSED ) {
      if( header ) header.push(key);
      row.push(spacePacket.packet.PRIMARY_HEADER_PARSED[key]);
    }

    for( let key in spacePacket.packet.SECONDARY_HEADER_PARSED ) {
      if( header ) header.push(key);
      row.push(spacePacket.packet.SECONDARY_HEADER_PARSED[key]);
    }

    if( header ) this.csv.spacePacket.push(header);
    this.csv.spacePacket.push(row);

    this.addImagePacket(caduId, mpduId, spacePacket.id, spacePacket.imagePayload);
  }

  addImagePacket(caduId, mpduId, spacePacketId, imagePacket) {
    if( !imagePacket ) return;

    let row = [imagePacket.id, caduId, mpduId, spacePacketId];
    let header = !this.headers.imagePacket ? ['uid', 'cadu_uid', 'mpdu_uid', 'space_packet_uid'] : null;
    this.headers.imagePacket = false;

    for( let key in imagePacket.HEADER ) {
      if( header ) header.push(key);
      row.push(imagePacket.HEADER[key]);
    }

    if( header ) this.csv.imagePacket.push(header);
    this.csv.imagePacket.push(row);
  }

}

module.exports = new CsvDebugging();