var ConvertBase = function (num) {
  return {
      from : function (baseFrom) {
          return {
              to : function (baseTo) {
                  return parseInt(num, baseFrom).toString(baseTo);
              }
          };
      }
  };
};
  
// binary to decimal
ConvertBase.bin2dec = function (num) {
  return ConvertBase(num).from(2).to(10);
};

// binary to hexadecimal
ConvertBase.bin2hex = function (num) {
  return ConvertBase(num).from(2).to(16);
};

// decimal to binary
ConvertBase.dec2bin = function (num) {
  return ConvertBase(num).from(10).to(2);
};

// decimal to hexadecimal
ConvertBase.dec2hex = function (num) {
  return ConvertBase(num).from(10).to(16);
};

// hexadecimal to binary
ConvertBase.hex2bin = function (num) {
  return ConvertBase(num).from(16).to(2);
};

// hexadecimal to decimal
ConvertBase.hex2dec = function (num) {
  return ConvertBase(num).from(16).to(10);
};

class Utils {

  constructor() {
    this.ConvertBase = ConvertBase;
  }

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