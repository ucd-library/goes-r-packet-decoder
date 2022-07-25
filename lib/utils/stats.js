

class Stats {

  constructor() {
    this.startTime = Date.now();
    this.running = false;

    this.windowSize = 5;

    this.data = {
      paduPackets : 0,
      spacePackets : 0,
      paduInvalid : 0,
      spaceInvalid : 0,
      mbits : 0
    }

    this.avg = {
      mbits : {},
      packets : {},
      invalid : {},
      failedPosts : {}
    }

    this.windowPointers = {
      mbits : Date.now(),
      packets : Date.now(),
      invalid : Date.now(),
      failedPosts : Date.now()
    };

    this.firstRender = true;
  }

  enable(opts) {
    if( this.running ) return;
    this.opts = opts;
    this.running = true;

    // check for empty prior window
    setInterval(() => {
      let time = Date.now();
      let pWin = this.getWindow(time, true);
      for( let key in this.windowPointers ) {
        if( this.avg[key][pWin] === 0 ) continue;
        if( time - this.windowPointers[key] > 2000 ) {
          this.avg[key][pWin] = 0;
        }
      }
    }, 250);


    setInterval(() => {
      if( this.opts.consoleLogStatus ) {
        this.redraw();
      } 
      if( this.opts.statusCallback ) {
        this.opts.statusCallback(this._getStats());
      }
    }, 1000);
  }

  getWindow(time, prior=false) {
    if( !time ) time = Date.now();
    let window = Math.floor(time / 1000) % this.windowSize;
    if( prior === true ) {
      window = window-1;
      if( window < 0 ) window = this.windowSize-1;
    }
    return window;
  }

  addMBits(value) {
    this._update('mbits', value);
    this.data.mbits += value;
  }

  addValidSpacePacket() {
    this._update('packets');
    this.data.spacePackets++;
  }

  addInvalidSpacePacket() {
    this._update('invalid');
    this.data.spaceInvalid++;
  }

  addValidPaduPacket() {
    this._update('packets');
    this.data.paduPackets++;
  }

  addInvalidPaduPacket() {
    this._update('invalid');
    this.data.paduInvalid++;
  }

  _update(type, value) {
    let window = this.getWindow();

    // check for reset
    let lastWindow = this.getWindow(this.windowPointers[type]);
    if( lastWindow !== window ) {
      this.avg[type][window] = 0;
    }

    if( !this.avg[type][window] ) this.avg[type][window] = value || 1;
    else this.avg[type][window] += value || 1;

    this.windowPointers[type] = Date.now();
  }

  _getStats() {
    let packetsPerSecond = (Object.values(this.avg.packets).reduce((a,b) => a + b, 0) / this.windowSize);
    let invalidPacketsPerSecond = (Object.values(this.avg.invalid).reduce((a,b) => a + b, 0) / this.windowSize);
    let mbitsPerSecond = (Object.values(this.avg.mbits).reduce((a,b) => a + b, 0) / this.windowSize);
    let uptime = Math.floor((Date.now() - this.startTime)/1000);

    return {packetsPerSecond, mbitsPerSecond, invalidPacketsPerSecond, uptime}
  }

  redraw() {
    let {packetsPerSecond, mbitsPerSecond, invalidPacketsPerSecond, uptime} = this._getStats();

    if( !process.stdout ) return;

    if( !this.firstRender ) {
      process.stdout.moveCursor(0, -8);
      process.stdout.clearLine();  // clear current text
      process.stdout.cursorTo(0);  // move cursor to beginning of line
    }
    this.firstRender = false;

    process.stdout.write(
`total padu packets   : ${this.data.paduPackets}
total space packets  : ${this.data.spacePackets}
total padu invalid   : ${this.data.paduInvalid}
total space invalid  : ${this.data.spaceInvalid}
packet rate          : ${packetsPerSecond.toFixed()}/sec
invalid rate         : ${invalidPacketsPerSecond.toFixed()}/sec
mbites received      : ${this.data.mbits.toFixed(2)}
avg mbites/sec       : ${mbitsPerSecond.toFixed(2)}
uptime               : ${uptime}s`);
}

}

module.exports = new Stats();