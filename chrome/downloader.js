function Downloader(on_progress) {
  var that = this;
  this.req_ = null;
  this.callback_ = null;
  this.on_progress_ = on_progress;
  this.request_listener_ = function(event) { that.onRequestEvent_(event); }
}

Downloader.prototype = {
  get: function(url, callback) {
    this.callback_ = callback;
    this.req_ = new XMLHttpRequest();
    this.req_.overrideMimeType("text/plain; charset=x-user-defined");
    this.req_.addEventListener("progress", this.request_listener_, false);
    this.req_.addEventListener("load", this.request_listener_, false);
    this.req_.addEventListener("error", this.request_listener_, false);
    this.req_.addEventListener("abort", this.request_listener_, false);
    this.req_.open("GET", url, true);
    this.req_.send(null);
    d("downloading " + url);
  },

  onRequestEvent_: function(event) {
    if (event.type == "progress" && this.on_progress_) {
      this.on_progress_(event.loaded, event.total);
      return;
    }

    var data = this.req_.responseText;
    var stauts = this.req_.statusText;
    this.req_.removeEventListener("progress", this.request_listener_, false);
    this.req_.removeEventListener("load", this.request_listener_, false);
    this.req_.removeEventListener("error", this.request_listener_, false);
    this.req_.removeEventListener("abort", this.request_listener_, false);
    this.req_ = null;

    if (event.type == "abort" || event.type == "error") {
      d("download failed");
      this.callback_(null, status);
    } else {
      d("download ok");
      this.callback_(data);
    }
  }
}
