const fs = require('fs-extra');

process.on('message', msg => {
  let success = false;

  try {
    fs.writeFileSync(msg.filename+'.json', JSON.stringify(msg.headers || {}, '  ', '  '));
    success = true;
  } catch(e) {
    console.log('worker failed to write image', msg.filename,  msg.headers || {});
  }

  process.send({success});
});