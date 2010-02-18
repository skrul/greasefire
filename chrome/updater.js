var URL = "http://skrul.com/projects/greasefire/indexes/";

function Updater(store) {
  this.store_ = store;
  this.isUpdating_ = false;
}

Updater.prototype = {
  update: wrap(function(force, callback) {
    if (this.isUpdating_) {
      callback(false, "Already updating");
      return;
    }

    var that = this;
    this.getVersion_(URL + "latest", function(success, latest_version) {
      if (!success) {
        callback(false, "can't read version");
        return;
      }

      var current_version = that.store_.current_version();
      d("latest version " + latest_version);
      d("current version " + current_version);
      if (!force && current_version && latest_version <= current_version) {
        callback(true);
        return;
      }

      var base_url = URL + formatISO8601(latest_version);
      that.updateFromBaseUrl_(base_url, latest_version, callback);
    });
  }),

  updateWithLocalData: wrap(function(callback) {
    if (this.isUpdating_) {
      callback(false, "Already updating");
      return;
    }

    var that = this;
    this.getVersion_("indexes/latest", function(success, local_version) {
      if (!success) {
        callback(false, "can't read local version");
        return;
      }
      d("local version " + local_version);
      that.updateFromBaseUrl_("indexes", local_version, callback);
    });
  }),

  updateFromBaseUrl_: wrap(function(base_url, version, callback) {
    d("Updater.updateFromBaseUrl_ " + base_url + " " + version);

    var that = this;
    this.isUpdating_ = true;
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
          version, includes, excludes, scripts, function() {
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
    includes.load(document, base_url + "/include.png", function() {
      total += includes.length();
      on_progress(total, 0);
      excludes.load(document, base_url + "/exclude.png", function() {
        total += excludes.length();
        on_progress(total, 0);
        downloader.get(base_url + "/scripts.txt", done_downloading);
      });
    });
  }),

  getVersion_: wrap(function(url, callback) {
    var downloader = new Downloader();
    downloader.get(url + "?" + Math.random(), function(data, error) {
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
