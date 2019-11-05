const data = require('./apid.json');

const EMPTY = {
  RESERVED_FOR_GS : {
    label : 'Reserved for GS',
    ranges : [
      ['1A0', '1AF'],
      ['1D0', '283'],
      ['360', '360'],
      ['3E0', '3E1'],
      ['450', '45B'],
      ['4E0', '4E5'],
      ['560', '562'],
      ['600', '7F7']
    ]
  },
  SPARE : {
    label : 'Spare',
    ranges : [
      ['1B0', '1CF'],
      ['284', '2FF'],
      ['304', '35F'],
      ['361', '37F'],
      ['384', '3DF'],
      ['3E2', '3FF'],
      ['402', '40F'],
      ['412', '41F'],
      ['422', '42F'],
      ['432', '44F'],
      ['45C', '47F'],
      ['48C', '4DF'],
      ['4E6', '4FF'],
      ['502', '55F'],
      ['563', '57F'],
      ['581', '5FF']
    ]
  },
  RESERVED_BY_CCSDS_STANDARD : {
    label : 'Reserved by CCSDS Standard',
    ranges : [
      ['7F8', '7FE']
    ]
  },
  RESERVED_FOR_GS_ACTIVE_FILL : {
    label : 'Reserved for GS (active fill)',
    ranges : [
      ['7FF', '7FF']
    ]
  }
}

class APID {

  constructor() {
    this.lookup = {};
    this.empty = EMPTY;

    for( let key in data ) {
      this.lookup[data[key].apid.toLowerCase()] = data[key];
    }

    for( let key in this.empty ) {
      let ranges = this.empty[key].ranges;
      for( let i = 0; i < ranges.length; i++ ) {
        ranges[i] = [parseInt('0x'+ranges[i][0]), parseInt('0x'+ranges[i][1])];
      }
    }
  }

  get(apid) {
    let key = apid;
    if( typeof key === 'string' ) {
      key = key.toLowerCase();
    } else {
      key = key.toString(16);
    }

    let info = this.lookup[key];
    if( info ) return info;

    return this.getEmpty(apid);
  }

  getEmpty(apid) {
    let key = apid;
    if( typeof apid === 'string' ) {
      key = parseInt('0x'+key);
    }

    for( let id in this.empty ) {
      let ranges = this.empty[id].ranges;
      for( let range of ranges ) {
        // console.log(id, range[0],  key, range[1])
        if( range[0] <= key && key <= range[1] ) {
          return {
            range,
            empty : true,
            label : this.empty[id].label
          }
        }
      }
    }

    return false;
  }

}

module.exports = new APID();