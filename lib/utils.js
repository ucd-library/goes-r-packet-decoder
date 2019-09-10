const ConvertBase = require('./convert');

class Utils {

  readBinary(data, start, offset, length) {
    let mask = this.getMask(start, offset, length);
  
    let stBinData = ConvertBase.dec2bin(data);
    let stBinMask = ConvertBase.dec2bin(mask);
    while( stBinData.length < length ) stBinData = '0'+stBinData;
    while( stBinMask.length < length ) stBinMask = '0'+stBinMask;
  
    stBinData = stBinData.substr(start, offset);
    stBinMask = stBinMask.substr(start, offset);

    data = ConvertBase.bin2dec(stBinData);
    mask = ConvertBase.bin2dec(stBinMask);
  
    return data & mask; 
  }

  getMask(start, offset, length) {
    let v = '';
    for( var i = 0; i < start; i++ ) v += '0';
    for( var i = 0; i < offset; i++ ) v += '1';
    for( var i = 0; i < length-offset-start; i++ ) v += '0';
  
    let hex = ConvertBase.bin2hex(v);
    return parseInt('0x'+hex);
  }

  flipEndian(str) {
    let newStr = '';
    for( let i = str.length-2; i >=0; i -= 2 ) {
      newStr += str[i]+str[i+1];
    }
    return newStr;
  }

}

module.exports = new Utils;