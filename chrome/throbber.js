function Throbber(window, div) {
  this.win_ = window;
  this.div_ = div;
  this.id_ = null;
  this.running_ = false;
  this.pos_ = 0;
}
Throbber.prototype = {
  start: function() {
    if (this.running_)
      return;

    this.running_ = true;
    this.startTimer_();
  },
  stop: function() {
    this.running_ = false;
    this.win_.clearTimeout(this.id_);
    delete this.id_;
  },
  tick_: function() {
    if (!this.running_)
      return;
    this.pos_++;
    if (this.pos_ > 35)
      this.pos_ = 0;
    $(this.div_).css({backgroundPosition: (this.pos_ * -16) + "px"});
    this.startTimer_();
  },
  startTimer_: function() {
    var that = this;
    this.id_ = this.win_.setTimeout(function() { that.tick_(); }, 50);
  }
}
