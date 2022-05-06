

class Stats {

  constructor() {
    this.startTime = Date.now();
    this.running = false;

    this.data = {
      paduPackets : 0,
      spacePackets : 0,
      paduInvalid : 0,
      spaceInvalid : 0,
      bytes : 0
    }

    this.avg = {
      bytes : {},
      packets : {},
      invalid : {},
      failedPosts : {}
    }

    this.firstRender = true;
    this.currentWindow = this.getWindow();
  }

  enable(opts) {
    if( this.running ) return;
    this.opts = opts;
    this.running = true;

    setInterval(() => {
      this.avg.bytes[this.getWindow()] = 0;
      this.avg.packets[this.getWindow()] = 0;
      this.avg.invalid[this.getWindow()] = 0;
      this.avg.failedPosts[this.getWindow()] = 0;

      if( this.opts.consoleLogStatus ) {
        this.redraw();
      } 
      if( this.opts.statusCallback ) {
        this.opts.statusCallback(this._getStats());
      }
    }, 1000);
  }

  getWindow() {
    return Math.floor(Date.now() / 1000) % 5;
  }

  addBytes(value) {
    this._update('bytes', value);
    this.data.bytes += value;
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
    if( !this.avg[type][window] ) this.avg[type][window] = value || 1;
    else this.avg[type][window] += value || 1;
  }

  _getStats() {
    let packetsPerSecond = (Object.values(this.avg.packets).reduce((a,b) => a + b, 0) / 5);
    let invalidPacketsPerSecond = (Object.values(this.avg.invalid).reduce((a,b) => a + b, 0) / 5);
    let mbytesPerSecond = (Object.values(this.avg.bytes).reduce((a,b) => a + b, 0) / 5);
    let uptime = Math.floor((Date.now() - this.startTime)/1000);

    return {packetsPerSecond, mbytesPerSecond, invalidPacketsPerSecond, uptime}
  }

  redraw() {
    let {packetsPerSecond, mbytesPerSecond, invalidPacketsPerSecond, uptime} = this._getStats();

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
mbytes received      : ${this.data.bytes.toFixed(2)}
avg mbytes/sec       : ${mbytesPerSecond.toFixed(2)}
uptime               : ${uptime}s`);
}

}

module.exports = new Stats();