// to assume a full block we need to be able to quick parse a jp2 images
// dimensions. This function quickly (sub ms) parses a jp2 buffer for
// height / width and returns values without parsing further.
module.exports = function getJp2Size(data) {
  var position = 0;
  var end = data.length;
  var sizeSet = false;
  var context = {
    SIZ : {}
  };

  while (position + 1 < end) {
    if( sizeSet ) break;

    var code = readUint16(data, position);
    position += 2;

    var length = 0;
    switch (code) {
      case 0xFF51: // Image and tile size (SIZ)
        length = readUint16(data, position);
        var siz = {};
        siz.Xsiz = readUint32(data, position + 4);
        siz.Ysiz = readUint32(data, position + 8);
        siz.XOsiz = readUint32(data, position + 12);
        siz.YOsiz = readUint32(data, position + 16);
        siz.XTsiz = readUint32(data, position + 20);
        siz.YTsiz = readUint32(data, position + 24);
        siz.XTOsiz = readUint32(data, position + 28);
        siz.YTOsiz = readUint32(data, position + 32);
        
        context.SIZ = siz;
        sizeSet = true;
    }
  }

  let width = context.SIZ.Xsiz - context.SIZ.XOsiz;
  let height = context.SIZ.Ysiz - context.SIZ.YOsiz;
  return {width, height};
}


function readUint16(data, offset) {
  return (data[offset] << 8) | data[offset + 1];
}

function readUint32(data, offset) {
  return ((data[offset] << 24) | (data[offset + 1] << 16) |
         (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
}
