var URL = "http://skrul.com/projects/greasefire/indexes/2010-01-21T04:31:30Z/";

function Updater(store) {
  var that = this;
  this.store_ = store;
  this.isUpdating_ = false;
  this.request_listener_ = function(event) { that.onRequestEvent_(event); }
}

Updater.prototype = {
  update: function(callback) {
    var that = this;
    var finish = function(success, error) {
      that.isUpdating_ = false;
      callback(success, error);
    }

    if (this.isUpdating_) {
      callback(false, "Already updating");
    }
    this.isUpdating_ = true;

    var includes;
    var excludes;
    var scripts;

    var on_progress = function(loaded, total) {
      chrome.extension.sendRequest({action: "progress",
                                    loaded: loaded,
                                    total: total});
    }

    var done_downloading = function(data, error) {
      if (data) {
        scripts = data;
        that.store_.installNewData(
          "1234", includes, excludes, scripts, function() {
          // send message to update status of all tabs
          finish(true);
        });
      } else {
        finish(false, error);
      }
    }

    var downloader = new Downloader(on_progress);
    includes = new Stream();
    excludes = new Stream();
    var total = 0;
    includes.load(document, URL + "include.png", function() {
      total += includes.length();
      on_progress(total, 0);
      excludes.load(document, URL + "exclude.png", function() {
        total += excludes.length();
        on_progress(total, 0);
        downloader.get(URL + "scripts.txt", done_downloading);
      });
    });
  }
}
