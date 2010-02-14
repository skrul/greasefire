function Wrapper(that, callback) {
  this.that_ = that;
  this.callback_ = callback;
}
Wrapper.prototype = {
  wrap: function(f) {
    var that = this;
    return function() {
      try {
        f.apply(that.that_, arguments);
      } catch(e) {
        that.callback_(false, e);
      }
    };
  }
}

function Timer() {
  this.time_ = (new Date()).getTime();
}
Timer.prototype = {
  mark: function(s) {
    var now = (new Date()).getTime();
    console.log(s + " " + (now - this.time_) + "ms");
    this.time_ = now;
  }
}

function d(s) {
  if (DEBUG) {
    console.log(s.substr(0, 100));
  }
}
