const imagemagick = require('imagemagick-native');
const fs = require('fs-extra');

process.on('message', msg => {
  let success = false;
  //console.log(msg);
  try {
    msg.imgData = Buffer.from(msg.imgData.data);

    let imgData = imagemagick.convert({
      srcData: msg.imgData,
      srcFormat : 'JP2',
      format: 'PNG',
      quality: 100 // (best) to 1 (worst)
    });
    fs.writeFileSync(msg.filename+'.png', imgData);
    fs.writeFileSync(msg.filename+'.json', JSON.stringify(msg.imgHeader, '  ', '  '));

    success = true;
  } catch(e) {
    // console.log(e);
  }

  process.send({success});
});