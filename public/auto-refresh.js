export class AutoRefresh {
  constructor(refresh, {interval = 5000, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id)} = {}) {
    Object.assign(this, {refresh, interval, setTimer, clearTimer, enabled:true, visible:true, pending:0, timer:null});
  }
  clear() { if (this.timer !== null) this.clearTimer(this.timer); this.timer=null; }
  schedule() {
    this.clear();
    if(this.enabled && this.visible && !this.pending) this.timer=this.setTimer(()=>{this.timer=null;void this.refreshNow();},this.interval);
  }
  async refreshNow() {
    this.clear();this.pending++;
    try { await this.refresh(); } finally { this.pending--;this.schedule(); }
  }
  start() { return this.refreshNow(); }
  setEnabled(value) { this.enabled=value;this.schedule(); }
  setVisible(value) {
    this.visible=value;this.clear();
    if(value && this.enabled && !this.pending) void this.refreshNow();
  }
}
