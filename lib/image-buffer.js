
class ImageBufferGroup {

  constructor() {
    this.data = {};
  }

  add(apid, imagePayload) {
    let imageId = apid+'-'+imagePayload.HEADER.SECONDS_SINCE_EPOCH;
    let blockId = imageId+'_'+imagePayload.HEADER.IMAGE_BLOCK_SEQUENCE_COUNT;

    // if( !this.data[imageId] ) {
    //   this.data[imageId] = new ImageBuffer(apid);
    // }
    // if( !this.data[imageId].blocks[blockId] ) {
    //   this.data[imageId].blocks[blockId] = new ImageBlockBuffer()
    // }

    // this.data[imageId].blocks[blockId].add(imagePayload);

    if( !this.data[blockId] ) {
      this.data[blockId] = new ImageBlockBuffer(apid)
    }
    this.data[blockId].add(imagePayload);
  }

  finalize() {
    let completed = [];
    for( let id in this.data ) {
      let done = this.data[id].finalize();
      if( !done ) continue;

      completed.push(this.data[id]);
      delete this.data[id];
    }

    // console.log(Object.keys(this.data).length);
    if( completed.length ) {
      console.log(
        'found '+completed.length+' completed blocks', 
        completed.map(ib => [ib.apid, Object.keys(ib.fragments).length] )
      );
      // console.log(Object.keys(this.data).length, Object.keys(this.data));
    }
    return completed;
  }

}

class ImageBuffer {

  constructor(apid) {
    this.apid = apid.toString(16);
    this.blocks = {};
  }

  finalize() {
    let completed = true;
    for( let id in this.blocks ) {
      completed = this.blocks[id].finalize();
      if( !completed ) return false;
    }
    return completed;
  }

}

class ImageBlockBuffer {

  constructor(apid) {
    this.apid = apid.toString(16);
    this.finalized = false;
    this.fragments = [];
    this.lastUpdated = -1;
  }

  add(imagePayload) {
    this.lastUpdated = Date.now();
    this.fragments.push(imagePayload);
  }

  finalize() {
    if( this.finalized ) return true;

    let time = Date.now();
    if( time - this.lastUpdated < 60*1000 ) return false;

    this.finalized = true;

    // console.log(this.fragments.length);
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