var LATEST_URL = "http://skrul.com/projects/greasefire/indexes/latest";
var URL = "http://skrul.com/projects/greasefire/indexes/2010-01-21T04:31:30Z/";

function Updater(store) {
  this.store_ = store;
  this.isUpdating_ = false;
}

Updater.prototype = {
  update: wrap(function(callback) {
    this.getCurrentVersion_(function(success, date) {
      console.log(date);
      console.log(formatISO8601(date));
      callback(true);
    });
    return;

    if (this.isUpdating_) {
      callback(false, "Already updating");
    }
    this.isUpdating_ = true;

    var that = this;
    var finish = function(success, error) {
      that.isUpdating_ = false;
      chrome.extension.sendRequest({action: "updater-done"});
      callback(success, error);
    }

    var includes;
    var excludes;
    var scripts;

    var on_progress = function(loaded, total) {
      chrome.extension.sendRequest({action: "updater-progress",
                                    loaded: loaded,
                                    total: total});
    }

    var done_downloading = function(data, error) {
      if (data) {
        scripts = data;
        that.store_.installNewData(
          "1234", includes, excludes, scripts, function() {
          finish(true);
        });
      } else {
        finish(false, error);
      }
    }

    chrome.extension.sendRequest({action: "updater-start"});
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
  }),

  getCurrentVersion_: wrap(function(callback) {
    var downloader = new Downloader();
    downloader.get(LATEST_URL, function(data, error) {
      if (data) {
        var d = parseISO8601(data);
        if (d) {
          callback(true, d);
          return;
        }
      }
      callback(false, error);
    });
  })
}
