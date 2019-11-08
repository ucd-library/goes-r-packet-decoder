const parser = require('./byte-parser');

const PARSER_FLASH_DEF = {
  flash_id : {size: 2, type: 'uint16'},
  flash_time_offset_of_first_event : {size: 2, type: 'int16'},
  flash_time_offset_of_last_event : {size: 2, type: 'int16'},
  flash_frame_time_offset_of_first_event : {size: 2, type: 'int16'},
  flash_frame_time_offset_of_last_event : {size: 2, type: 'int16'},
  flash_lat : {size: 4, type: 'float'},
  flash_lon : {size: 4, type: 'float'},
  flash_area : {size: 2, type: 'int16'},
  flash_energy : {size: 2, type: 'uint16'},
  flash_quality_flag : {size: 2, type: 'uint16'}
}

const PARSER_EVENT_DEF = {
  event_id : {size: 4, type: 'uint32'},
  event_time_offset : {size: 2, type: 'int16'},
  event_lat : {size: 2, type: 'uint16', scale: 0.00203128, offset: -66.56},
  event_lon : {size: 2, type: 'uint16', scale: 0.00203128, offset: -70.44},
  event_energy : {size: 2, type: 'uint16'},
  event_parent_group_id : {size: 4, type: 'uint32'}
}

class LightningDetection {
  
  parseFlashData(data) {
    return this._parse(data, PARSER_FLASH_DEF);
  }

  parseEventData(data) {
    return this._parse(data, PARSER_EVENT_DEF);
  }

  _parse(data, def) {
    let count = data.subarray(0, 8).readBigInt64LE(0);
    let offset = 8;
    let result = [];

    let chunkSize = 0;
    for( let key in def ) chunkSize += def[key].size;

    for( let i = 0; i < count; i++ ) {
      result.push(parser.parse(def, data, offset));
      offset += chunkSize;
    }

    return result;
  }

}

module.exports = new LightningDetection();