const fs = require('fs-extra');
const path = require('path');
const {exec} = require('child_process');

function _exec(cmd, args={}) {
  return new Promise((resolve, reject) => {
    exec(cmd, args, (err, stdout, stderr) => {
      if( err ) reject(err);
      else resolve({stdout, stderr});
    })
  });
}


module.exports = async (images) => {
  let images = await fs.readdir(partsDir);
  images.sort((a,b) => {
    a = parseInt(a.split('_')[1].split('.')[0]);
    b = parseInt(b.split('_')[1].split('.')[0]);
    if( a < b ) return -1;
    if( a > b ) return 1;
    return 0;
  });
  console.log(images);
  images = images.map(img => path.join(partsDir, img)).join(' ');

  let outputImage = path.join(finalDir, time+'_'+block+'.png');
  
  console.log(`convert ${images} -append ${outputImage}`);
  await _exec(`convert ${images} -append ${outputImage}`);
}