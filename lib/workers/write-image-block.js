// const imagemagick = require('imagemagick-native');
const fs = require('fs-extra');

process.on('message', msg => {
  let success = false;

  try {
    msg.data = Buffer.from(msg.data.data);
    fs.writeFileSync(msg.filename+'.jp2', msg.data);
    fs.writeFileSync(msg.filename+'.json', JSON.stringify(msg.headers || {}, '  ', '  '));

    success = true;
  } catch(e) {
    console.log('worker failed to write image', e, msg.filename,  msg.headers || {});
    // console.log(msg);
  }

  process.send({success, time: msg.headers.SECONDS_SINCE_EPOCH});
});