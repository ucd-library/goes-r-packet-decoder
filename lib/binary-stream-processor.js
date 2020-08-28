const CONSTANTS = require('./const');
const CaduPacket = require('./cadu-packet');
const spSequenceCompositor = require('./space-packet-sequence-compositor');
const imageBuffer = require('./image-block-buffer');
const csvDebug = require('./utils/csv-debugging');
const path = require('path');
const uuid = require('uuid');
const request = require('request');
const apidUtils = require('./utils/apid');
const stats = require('./utils/stats');
const WriteLocalFsDispatcher = require('./workers/write-local-fs-dispatcher');

// https://www.goes-r.gov/users/docs/PUG-GRB-vol4.pdf


class BinaryStreamProcessor {

  /**
   * @constructor
   * 
   * @param {Object} opts
   * @param {Boolean} opts.live defaults to true.  If you do not have a live feed from the satalite (ie you are stream from pre-recored file), you want to set this to false
   * @param {Boolean} opts.consoleLogStatus write parsed packets/second and uptime to console.  nice for debugging.
   * @param {Boolean} opts.csvDebug dump packet header information to CSV files
   * @param {Number} opts.H_SPACECRAFT_ID override the default spacecraft id (currently 130, GOES WEST)
   * @param {RegExp|Function} opts.filter filter by apid.  Either provide RegExp or function which will be passed hex string value of apid
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
    this.running = false;
    this.lastSpacePacket = null;
    this.mainbuffer = Buffer.alloc(0);
    this.failedPostCount = 0;
    this.packet = null;
    this.index = null;

    this._initOpts(opts);

    // register our callback from the space packet sequence compositor
    spSequenceCompositor.registerDataHandler(async msg => {
      if( msg.type === 'image' ) {
        await this._handleImageFragment(msg.data);
      } else if( msg.type === 'generic' ) {
        await this._handleGenericPayload(msg.data);
      }
    });
  }

  _initOpts(opts) {
    this.opts = opts;
    this.imageBlockOpts = opts.imageBlock || false;
    this.genericOpts = opts.generic || false;

    if( !opts.csvDebug ) opts.csvDebug = false;

    if( this.opts.filter ) {
      if( typeof this.opts.filter === 'function') {
        this.opts.filterIsFn = true;
      }
    }

    if( this.opts.live === false ) {
      // if this is not a live stream, ie we are reading from a pre-recored file, we need to speed up the image
      // buffer time or things get out of wack
      CONSTANTS.config.imageBlockBufferTimer = 2 * 1000;
    }

    // are we writing image blocks to the local filesystem?
    if( opts.imageBlock && opts.imageBlock.localFs ) {
      if( typeof opts.imageBlock.localFs !== 'object' ) opts.imageBlock.localFs =  {};
      if( !opts.imageBlock.localFs.workers ) opts.imageBlock.localFs.workers = 3;
      if( !opts.imageBlock.localFs.path ) opts.imageBlock.localFs.path = path.join(process.cwd(), 'image-blocks');
      opts.imageBlock.localFs.type = 'image';
      this.localFsImageBlockWriter = new WriteLocalFsDispatcher(opts.imageBlock.localFs);
    }

    // are we POSTing image blocks to a service?
    if( opts.imageBlock && opts.imageBlock.post ) {
      if( typeof opts.imageBlock.post !== 'object' ) opts.imageBlock.post = {};
      if( !opts.imageBlock.post.url ) {
        console.warn('No imageBlock POST url provided.  Ignoring');
        opts.imageBlock.post = null;
      }
    }

    // are we writing generic payload to the local filesystem?
    if( opts.generic && opts.generic.localFs ) {
      if( typeof opts.generic.localFs !== 'object' ) opts.generic.localFs =  {};
      if( !opts.generic.localFs.workers ) opts.generic.localFs.workers = 31
      if( !opts.generic.localFs.path ) opts.generic.localFs.path = path.join(process.cwd(), 'image-blocks');
      opts.generic.localFs.type = 'generic';
      this.localFsGenericPayloadWriter = new WriteLocalFsDispatcher(opts.generic.localFs);
    }

    // are we POSTing generic payloads to a service?
    if( opts.generic && opts.generic.post ) {
      if( typeof opts.generic.post !== 'object' ) opts.generic.post = {};
      if( !opts.generic.post.url ) {
        console.warn('No generic POST url provided.  Ignoring');
        opts.generic.post = null;
      }
    }
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
      if( this.opts.consoleLogStatus && !stats.running ) {
        stats.enable();
      }

      stats.data.bytes += data.length / 1000000;

      this.mainbuffer = Buffer.concat([this.mainbuffer, data]);
      await this._runLoop();
    });
  
    stream.on('close', async () => {
      console.log('Stream closed');
      spSequenceCompositor.streamClosed = true;
      if( this.opts.csvDebug ) await csvDebug.writeFiles();
      process.exit();
    });
  }

  /**
   * @method _runLoop
   * @description main run loop.  finds the first instance of the SYNC byte, then continuously reads packets
   * until the mainBuffer has less bytes than it takes to read a space packet.  Additionally this loop stores
   * 'half parsed' space packats that are waiting for the new CADU packet.
   */
  async _runLoop() {
    if( this.running ) return;
    this.running = true;

    // find first instance of sync bytes
    this.index = this.mainbuffer.indexOf(CONSTANTS.CADU.SYNC, 0, 'hex');

    while( this.index !== -1 && this.mainbuffer.length > (this.index + CONSTANTS.CADU.PACKET_LENGTH)  ) {
      this.payload = this.mainbuffer.slice(this.index, this.index+CONSTANTS.CADU.PACKET_LENGTH);
      this.mainbuffer = this.mainbuffer.slice(this.index+CONSTANTS.CADU.PACKET_LENGTH, this.mainbuffer.length);
      this.index = 0; // reset, we should be reading first byte from here on out
  
      this.packet = new CaduPacket(this.opts.H_SPACECRAFT_ID);
      this.lastSpacePacket = this.packet.parse(this.payload, this.lastSpacePacket);

      if( this.opts.csvDebug ) {
        csvDebug.addCadu(this.packet);
      }

      if( this.packet.isFillPacket() ) {
        // TODO: add stat
        continue;
      } else if( !this.packet.isValidPacket() ) {
        stats.addInvalidPaduPacket();
        continue;
      } else {
        stats.addValidPaduPacket();
      }

      for( let sp of this.packet.mpduPacket.spacePackets ) {
        if( !sp.finalized ) continue;
        await spSequenceCompositor.process(sp);
      }

    }

    this.running = false;
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
      if( apidUtils.getEmpty(block.apid) ) {
        continue;
      }
      if( this.filter(block.apid) ) {
        continue;
      }

      if( this.localFsImageBlockWriter ) {
        for( let i = 0; i < block.fragments.length; i++ ) {
          let headers = {
            imagePayload : block.fragments[i].HEADER,
            spacePacket : block.fragments[i].SPACE_PACKET_HEADER
          }
          let filename = block.apid+'_'+headers.imagePayload.SECONDS_SINCE_EPOCH+'_'+
            headers.imagePayload.IMAGE_BLOCK_SEQUENCE_COUNT+'_'+
            headers.imagePayload.UPPER_LOWER_LEFT_X_COORDINATE+'_'+
            headers.imagePayload.UPPER_LOWER_LEFT_Y_COORDINATE+'_'+
            +i;

          this.localFsImageBlockWriter.write(headers, block.fragments[i].DATA, filename);
        }
      }

      if( this.imageBlockOpts.post ) {
        let params = {
          method : 'POST',
          url : this.imageBlockOpts.post.url,
          headers : this.imageBlockOpts.post.headers || {},
          timeout : 30000,
          formData : {
            type : 'image',
            apid : block.apid,
            streamName : this.opts.name || 'goes-r-stream',
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


        this._request(params)
          .catch(e => this.failedPostCount++ )
      }
    }

  }

  async _handleGenericPayload(generic) {
    if( !this.genericOpts ) return;

    if( apidUtils.getEmpty(generic.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER.toString(16)) ) {
      return;
    }
    if( this.filter(generic.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER) ) {
      return;
    }

    if( this.localFsGenericPayloadWriter ) {
      let filename = generic.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER.toString(16)+'_'+generic.headers.SECONDS_SINCE_EPOCH
      this.localFsGenericPayloadWriter.write(generic.headers, generic.data, filename);
    }

    if( this.genericOpts.post ) {
      let params = {
        method : 'POST',
        url : this.genericOpts.post.url,
        headers : this.genericOpts.post.headers || {},
        timeout : 30000,
        formData : {
          apid : generic.spHeaders.primary.APPLICATION_PROCESS_IDENTIFIER.toString(16),
          type : 'generic',
          streamName : this.opts.name || 'goes-r-stream',
          spacePacketHeaders : JSON.stringify(generic.spHeaders),
          headers : JSON.stringify(generic.headers),
          data : generic.data
        }
      }

      this._request(params)
          .catch(e => this.failedPostCount++)
    }
  }

  filter(apid) {
    if( !this.opts.filter ) return false;
    if( this.opts.filterIsFn ) {
      return this.opts.filter(apid) ? false : true;
    }
    return this.opts.filter.test(apid) ? false : true;
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