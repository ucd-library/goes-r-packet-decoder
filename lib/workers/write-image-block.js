// const imagemagick = require('imagemagick-native');
const fs = require('fs-extra');

process.on('message', msg => {
  let success = false;

  try {
    msg.data = Buffer.from(msg.data.data);

    // let imgData = imagemagick.convert({
    //   srcData: msg.imgData,
    //   srcFormat : 'JP2',
    //   format: 'PNG',
    //   quality: 100 // (best) to 1 (worst)
    // });
    fs.writeFileSync(msg.filename+'.png', msg.data);
    fs.writeFileSync(msg.filename+'.json', JSON.stringify(msg.headers || {}, '  ', '  '));

    success = true;
  } catch(e) {
    console.log('worker failed to write image', msg.filename,  msg.headers || {});
    // console.log(msg);
  }

  process.send({success, time: msg.imgHeader.SECONDS_SINCE_EPOCH});
});