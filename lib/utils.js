const ConvertBase = require('./convert');

class Utils {

  parseHeader(buffer, DEFINITION) {
    let index = 0;
    let parsedHeader = {};
    let chunk, key, byteChunkSize, header, shift;

    for( chunk of DEFINITION ) {
      shift = chunk.size;

      // slice of chunk of header
      byteChunkSize = chunk.size/8;
      header = buffer.slice(index, index+byteChunkSize).readUIntBE(0, byteChunkSize);
      index += byteChunkSize;

      for( key in chunk.headers ) {
        shift -= chunk.headers[key].length;
        parsedHeader[key] = (header >>> shift) & (chunk.headers[key].mask);
      }
    }

    return parsedHeader
  }

}

function maskHelper(start, offset, length=0) {
  let v = '';
  for( var i = 0; i < start; i++ ) v += '0';
  for( var i = 0; i < offset; i++ ) v += '1';
  for( var i = 0; i < length-offset-start; i++ ) v += '0';

  return ConvertBase.bin2hex(v);
}

module.exports = new Utils;