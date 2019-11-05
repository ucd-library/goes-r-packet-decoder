const {config} = require('./const');

/**
 * @class ImageBufferGroup
 * @description listen to image payloads (fragments) and group by type until block is completed
 */
class ImageBufferGroup {

  constructor() {
    this.data = {};
  }

  /**
   * @method add
   * @description add a image package (fragement) to the buffer
   * 
   * @param {String} apid GOES-R product id
   * @param {Object} imagePayload space-packet with image payload
   */
  add(apid, imagePayload) {
    let imageId = apid+'-'+imagePayload.HEADER.SECONDS_SINCE_EPOCH;
    let blockId = imageId+'_'+imagePayload.HEADER.IMAGE_BLOCK_SEQUENCE_COUNT;

    // if this is a new block, start a new block buffer
    if( !this.data[blockId] ) {
      this.data[blockId] = new ImageBlockBuffer(apid)
    }

    // add fragment to block buffer
    this.data[blockId].add(imagePayload);
  }

  /**
   * @method finalize
   * @description attempt to finalize all blocks in buffer.  will return all completed
   * image blocks
   * 
   * @returns {Array} Array of objects containing {apid, fragments}
   */
  finalize() {
    let completed = [];
    for( let id in this.data ) {
      let done = this.data[id].finalize();
      if( !done ) continue;

      completed.push({
        apid : this.data[id].apid,
        fragments : this.data[id].fragments
      });
      delete this.data[id];
    }

    return completed;
  }

}

/**
 * @class ImageBlockBuffer
 * @description a buffer for a specific GOES-R product id
 */
class ImageBlockBuffer {

  constructor(apid) {
    this.apid = apid.toString(16);
    this.finalized = false;
    this.fragments = [];
    this.lastUpdated = -1;
  }

  /**
   * @method add
   * @description add a image payload (image fragment) for this block
   * 
   * @param {Object} imagePayload 
   */
  add(imagePayload) {
    this.lastUpdated = Date.now();
    this.fragments.push(imagePayload);
  }

  /**
   * @method finalize
   * @description attempt to finalize this block.  Waits at least 1min with
   * no fragments being added to buffer.  If a minute has passed since last 
   * fragment added, then fragments are sorted by ROW_OFFSET_WITH_IMAGE_BLOCK,
   * a top/left coordinate is returned and the object finalized flag is set to
   * true.
   * 
   * Note. This is not timer system, it is called during the main run loop, so check
   * times may be longer than 1 min.
   */
  finalize() {
    if( this.finalized ) return true;

    let time = Date.now();
    if( time - this.lastUpdated < config.imageBlockBufferTimer ) return false;

    this.finalized = true;

    this.fragments.sort((a, b) => {
      if( a.HEADER.ROW_OFFSET_WITH_IMAGE_BLOCK > b.HEADER.ROW_OFFSET_WITH_IMAGE_BLOCK ) return 1;
      if( a.HEADER.ROW_OFFSET_WITH_IMAGE_BLOCK < b.HEADER.ROW_OFFSET_WITH_IMAGE_BLOCK ) return -1;
      return 0;
    });

    this.left = this.fragments[0].HEADER.UPPER_LOWER_LEFT_X_COORDINATE;
    this.top = this.fragments[0].HEADER.UPPER_LOWER_LEFT_Y_COORDINATE;

    return true;
  }

}

module.exports = new ImageBufferGroup();