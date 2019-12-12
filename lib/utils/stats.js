

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
      packets : {},
      invalid : {},
      failedPosts : {}
    }

    this.firstRender = true;
    this.currentWindow = this.getWindow();
  }

  enable() {
    if( this.running ) return;
    this.running = true;

    setInterval(() => {
      this.avg.packets[this.getWindow()] = 0;
      this.avg.invalid[this.getWindow()] = 0;
      this.avg.failedPosts[this.getWindow()] = 0;
      this.redraw();
    }, 1000);
  }

  getWindow() {
    return Math.floor(Date.now() / 1000) % 5;
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

  _update(type) {
    let window = this.getWindow();
    if( !this.avg[type][window] ) this.avg[type][window] = 1;
    else this.avg[type][window] += 1;
  }

  redraw() {
    let packetsPerSecond = (Object.values(this.avg.packets).reduce((a,b) => a + b, 0) / 5);
    let invalidPacketsPerSecond = (Object.values(this.avg.invalid).reduce((a,b) => a + b, 0) / 5);
    let uptime = Math.floor((Date.now() - this.startTime)/1000);

    if( !process.stdout ) return;

    if( !this.firstRender ) {
      process.stdout.moveCursor(0, -7);
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
uptime               : ${uptime}s`);
}

}

module.exports = new Stats();