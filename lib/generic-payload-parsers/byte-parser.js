
module.exports = (def, buffer, offset=0) => {
  let data = {};
  let index = offset;
  for( let key in def ) {
    data[key] = buffer.subarray(index, index+def[key].size);

    if( def[key].type === 'float' ) {
      data[key] = data[key].readFloatLE(0);
    } else if ( def[key].type === 'int16' ) {
      data[key] = data[key].readInt16LE(0);
    } else if ( def[key].type === 'uint16' ) {
      data[key] = data[key].readUInt16LE(0);
    } else if ( def[key].type === 'uint32' ) {
      data[key] = data[key].readUInt32LE(0);
    } else if ( def[key].type === 'uint64' ) {
      data[key] = data[key].readBigUInt64LE(0);
    }

    if( def[key].scale ) {
      data[key] = data[key] * def[key].scale;
    }
    if( def[key].offset ) {
      data[key] = data[key] + def[key].offset;
    }

    index += def[key].size;
  }

  return data;
}