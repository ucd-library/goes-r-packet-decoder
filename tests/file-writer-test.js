const Processor = require('../lib/binary-stream-processor');
const path = require('path');
const fs = require('fs-extra');

let ROOT_DIR = path.join(process.cwd(), 'goes-r-products');
let imageDir = path.join(ROOT_DIR, 'imageBlockFragments');
let genericDir = path.join(ROOT_DIR, 'generic');

(async function() {
  if( fs.existsSync(imageDir) ) await fs.remove(imageDir);
  await fs.mkdirs(imageDir);

  if( fs.existsSync(genericDir) ) await fs.remove(genericDir);
  await fs.mkdirs(genericDir);

  let processor = new Processor({
    consoleLogStatus : true,
    live : false,
    imageBlock : {
      localFs : {
        path: imageDir
      }
    },
    generic : {
      localFs : {
        path: genericDir
      }
    }
  })

  processor.pipe(fs.createReadStream(path.join(__dirname, 'testsecdecorded.dat')));
})();

