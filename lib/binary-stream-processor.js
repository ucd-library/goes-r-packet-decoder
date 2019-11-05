const CONSTANTS = require('./const');
const CaduPacket = require('./cadu-packet');
const spSequenceCompositor = require('./space-packet-sequence-compositor');
const imageBuffer = require('./image-block-buffer');
const csvDebug = require('./utils/csv-debugging');
const path = require('path');
const uuid = require('uuid');
const request = require('request');
const WriteLocalFsDispatcher = require('./workers/write-local-fs-dispatcher');

// https://www.goes-r.gov/users/docs/PUG-GRB-vol4.pdf


class BinaryStreamProcessor {

  /**
   * @constructor
   * 
   * @param {Object} opts
   * @param {Boolean} opts.csvDebug dump packet header information to CSV files
   * @param {Object} opts.imageBlock image block dissemination options
   * @param {Object} opts.imageBlock.localFs write blocks to local dist
   * @param {Number} opts.imageBlock.localFs.workers number of write workers.  defaults to 3
   * @param {String} opts.imageBlock.localFs.path path to write files, defauls to current working dir
   * @param {Object} opts.imageBlock.post send HTTP POST of image block to service
   * @param {String} opts.imageBlock.post.url url to POST to
   * @param {Object} opts.imageBlock.post.headers HTTP Headers to include in POST
   * @param {Object} opts.generic generic payload dissemination options
   * @param {Object} opts.generic.localFs write generic payload to file system
   * @param {Number} opts.generic.localFs.workers number of write workers, defualts to 1
   * @param {String} opts.generic.localFs.path path to write files, defauls to current working dir
   * @param {Object} opts.generic.post send HTTP POST of generic payload to service
   * @param {String} opts.generic.post.url url to POST to
   * @param {Object} opts.generic.post.headers HTTP Headers to include in POST
   */
  constructor(opts={}) {
    this.opts = opts;
    this.imageBlockOpts = opts.imageBlock || false;
    this.genericOpts = opts.generic || false;
    this.packetCount = 0;

    if( !opts.csvDebug ) opts.csvDebug = false;

    if( opts.imageBlock && opts.imageBlock.localFs ) {
      if( typeof opts.imageBlock.localFs !== 'object' ) opts.imageBlock.localFs =  {};
      if( !opts.imageBlock.localFs.workers ) opts.imageBlock.localFs.workers = 3;
      if( !opts.imageBlock.localFs.path ) opts.imageBlock.localFs.path = path.join(process.cwd(), 'image-blocks');
      opts.imageBlock.localFs.type = 'image';
      this.localFsImageBlockWriter = new WriteLocalFsDispatcher(opts.imageBlock.localFs);
    }

    if( opts.imageBlock && opts.imageBlock.post ) {
      if( typeof opts.imageBlock.post !== 'object' ) opts.imageBlock.post = {};
      if( !opts.imageBlock.post.url ) {
        console.warn('No imageBlock POST url provided.  Ignoring');
        opts.imageBlock.post = null;
      }
    }

    if( opts.generic && opts.generic.localFs ) {
      if( typeof opts.generic.localFs !== 'object' ) opts.generic.localFs =  {};
      if( !opts.generic.localFs.workers ) opts.generic.localFs.workers = 31
      if( !opts.generic.localFs.path ) opts.generic.localFs.path = path.join(process.cwd(), 'image-blocks');
      opts.generic.localFs.type = 'image';
      this.localFsGenericPayloadWriter = new WriteLocalFsDispatcher(opts.generic.localFs);
    }

    if( opts.generic && opts.generic.post ) {
      if( typeof opts.generic.post !== 'object' ) opts.generic.post = {};
      if( !opts.generic.post.url ) {
        console.warn('No generic POST url provided.  Ignoring');
        opts.generic.post = null;
      }
    }

    this.running = false;
    this.lastSpacePacket = null;
    this.mainbuffer = Buffer.alloc(0);

    spSequenceCompositor.registerDataHandler(async msg => {
      if( msg.type === 'image' ) {
        await this._handleImageFragment(msg.data);
      } else if( msg.type === 'generic' ) {
        await this._handleGenericPayload(msg.data);
      }
    });
  }

  /**
   * @method pipe
   * @description pipe a stream to main read loop. This starts the main run loop.  Will run
   * until stream closes
   * 
   * @param {Object} stream if null, will pipe from standard in
   */
  pipe(stream) {
    this.startTime = Date.now();
    if( !stream ) stream = process.openStdin();

    stream.on('data', async data => {
      this.mainbuffer = Buffer.concat([this.mainbuffer, data]);
      await this._runLoop();
    });
  
    stream.on('close', async () => {
      console.log('Stream closed, packets: '+this.packetCount+', time: '+(Date.now() - this.startTime)+'ms');
      spSequenceCompositor.streamClosed = true;
      if( this.opts.csvDebug ) await csvDebug.writeFiles();
    });
  }

  async _runLoop() {
    if( this.running ) return;
    this.running = true;
    
    let payload, packet;
    // find first instance of sync bytes
    let index = this.mainbuffer.indexOf(CONSTANTS.CADU.SYNC, 0, 'hex');

    while( index !== -1 && this.mainbuffer.length > (index + CONSTANTS.CADU.PACKET_LENGTH)  ) {
      payload = this.mainbuffer.slice(index, index+CONSTANTS.CADU.PACKET_LENGTH);
      this.mainbuffer = this.mainbuffer.slice(index+CONSTANTS.CADU.PACKET_LENGTH, this.mainbuffer.length);
      index = 0; // reset, we should be reading first byte from here on out
  
      packet = new CaduPacket();
      this.lastSpacePacket = packet.parse(payload, this.lastSpacePacket);
      this.packetCount++;
      
      if( this.csvDebug ) {
        csvDebug.addCadu(packet);
      }

      if( !packet._isValidPacket() ) continue;
  
      for( let sp of packet.mpduPacket.spacePackets ) {
        if( !sp.finalized ) continue;
        await spSequenceCompositor.process(sp);
      }

      this._writeStats();
    }
  


    this.running = false;
  }

  _writeStats() {
    if( this.packetCount % 100 !== 0 ) return;
    let packetsPerSecond = this.packetCount / ((Date.now() - this.startTime) / 1000);
    process.stdout.clearLine();  // clear current text
    process.stdout.cursorTo(0);  // move cursor to beginning of line
    process.stdout.write('packets/sec: ' + packetsPerSecond.toFixed());
  }


  async _handleImageFragment(image) {
    let data = {
      HEADER : image.headers,
      DATA : image.data,
      SPACE_PACKET_HEADER : image.spHeaders
    }
    imageBuffer.add(image.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER, data);
    let blocks = imageBuffer.finalize();


    if( !this.imageBlockOpts ) return;

    for( let block of blocks ) {
      if( block.fragments.length === 0 ) continue;

      if( this.localFsImageBlockWriter ) {
        let blockid = uuid.v4();
        for( let i = 0; i < block.fragments.length; i++ ) {
          let filename = block.apid+'_'+blockid+'_'+i;
          let headers = {
            imagePayload : block.fragments[i].HEADER,
            spacePacket : block.fragments[i].SPACE_PACKET_HEADER
          }

          this.localFsImageBlockWriter.write(headers, block.fragments[i].data, filename);
        }
      }

      if( this.imageBlockOpts.post ) {
        let params = {
          method : 'POST',
          url : this.imageBlockOpts.post.url,
          headers : this.imageBlockOpts.post.headers || {},
          formData : {
            type : 'image',
            apid : block.apid,
            fragmentsCount : block.fragments.length
          }
        }


        for( let i = 0; i < block.fragments.length; i++ ) {
          let headers = {
            imagePayload : block.fragments[i].HEADER,
            spacePacket : block.fragments[i].SPACE_PACKET_HEADER
          }

          params.formData['fragment_data_'+i] = block.fragments[i].DATA;
          params.formData['fragment_headers_'+i] = JSON.stringify(headers);
        } 

        try {
          await this._request(params);
        } catch(e) {
          // TODO
        }
      }
    }

  }

  async _handleGenericPayload(generic) {
    // if( generic.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER > 1536 ) {
    //   return;
    // }
    // if( generic.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER < 768 ||
    //   generic.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER > 771) {
    //   return;
    // }

    if( !this.genericOpts ) return;

    if( this.localFsGenericPayloadWriter ) {
      let filename = generic.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER+'_'+generic.HEADER.SECONDS_SINCE_EPOCH
      this.localFsGenericPayloadWriter.write(generic.headers, generic.data, filename);
    }

    if( this.genericOpts.post ) {
      let params = {
        method : 'POST',
        url : this.genericOpts.post.url,
        headers : this.genericOpts.post.headers || {},
        formData : {
          apid : generic.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER.toString(16),
          type : 'generic',
          spacePacketHeaders : JSON.stringify(generic.spHeaders),
          headers : JSON.stringify(generic.headers),
          data : generic.data
        }
      }

      try {
        await this._request(params);
      } catch(e) {
        // TODO
      }
    }
  }

  _request(params) {
    return new Promise((resolve, reject) => {
      request(params, (err, resp) => {
        if( err ) reject(err);
        else resolve(resp);
      })
    });
  }

}


module.exports = BinaryStreamProcessor;