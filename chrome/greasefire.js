function Greasefire() {
  this.store_ = new Store();
  this.updater_ = new Updater(this.store_, 60 * 60, new Date(0));
  this.updated_tabs_ = {};
}

Greasefire.prototype = {
  init: function() {
    var timer = new Timer();
    d("greasefire init");
    var that = this;
    // Initialize the store.  This sets up the database and sets up
    // the indexes with any existing data.
    this.store_.init(function(success, error) {
      timer.mark("store init " + success + " " + error);
      if (!success) {
        d("Error Initializing store: " + error);
        return;
      }

      var current_version = that.store_.current_version();
      d("Store initialized with version " + current_version);
      if (current_version) {
        that.finishInit_(timer);
        return;
      }

      // If there is no current data, load the local copy.
      that.updater_.updateWithLocalData(function(success, error) {
        if (!success) {
          d("Could not update with local data: " + error);
          return;
        }
        that.finishInit_(timer);
      });
    });
  },

  finishInit_: function(timer) {
    this.updated_tabs_ = {};

    // Start scheduled updates.
    this.updater_.enableScheduledUpdates();

    // Set up listeners.
    chrome.extension.onRequest.addListener(
      bind(this, "onRequest"));
    chrome.tabs.onUpdated.addListener(
      bind(this, "onTabUpdated"));
    chrome.tabs.onSelectionChanged.addListener(
      bind(this, "onTabSelectionChanged"));

    // Test the selected tab.
    var that = this;
    chrome.tabs.getSelected(null, function(tab) {
      that.updatePageAction_(tab);
      timer.mark("init complete");
    });
  },

  onRequest: function(request, sender, sendResponse) {
    d("onRequest " + request.action);
    switch(request.action) {
    case "update":
      this.updateData_(false, function() {
        sendResponse({});
      });
      break;
    case "force-update":
      this.updateData_(true, function() {
        sendResponse({});
      });
      break;
    case "search":
      this.search_(request.url, function(status, results) {
        sendResponse({status: status, results: results});
      });
      break;
    case "install":
      this.installScript_(request.url);
      sendResponse({});
      break;
    }
  },

  onTabUpdated: function(tagId, changeInfo, tab) {
    this.updatePageAction_(tab);
  },

  onTabSelectionChanged: function(tabId, selectInfo) {
    if (!(tabId in this.updated_tabs_)) {
      var that = this;
      chrome.tabs.get(tabId, function(tab) {
        that.updatePageAction_(tab);
        that.updated_tabs_[tabId] = true;
      });
    }
  },

  updateData_: wrap(function(force, callback) {
    d("updateData");
    var timer = new Timer();
    this.updater_.update(force, function() {
      timer.mark("updated");
    });
    callback();
  }),

  search_: wrap(function(url, callback) {
    d("search " + url);
    var matches = {};
    var timer = new Timer();
    this.store_.includes().search(url, matches, false);
    var ids = [];
    for (var id in matches) {
      ids.push(id);
    }
    this.store_.getScriptDetails(ids, function(status, results) {
      if (status) {
        for (id in results) {
          results[id].matches = matches[id];
        }
        callback(true, results);
      } else {
        callback(false);
      }
      timer.mark("search " + url);
    });
  }),

  installScript_: function(url) {
    chrome.tabs.executeScript(null, {
      code: "window.location = '" + url + "';"
    });
  },

  updatePageAction_: function(tab) {
    if (!this.isValid_(tab)) {
      chrome.pageAction.hide(tab.id);
      return;
    }

    var matches = {};
    var timer = new Timer();
    this.store_.includes().search(tab.url, matches, true);
    // TODO: check excludes.
    timer.mark("updatePageAction " + tab.url);
    var found = false;
    for (var id in matches) {
      found = true;
      break;
    }
    if (found) {
      chrome.pageAction.show(tab.id);
    } else {
      chrome.pageAction.hide(tab.id);
    }
  },

  isValid_: function(tab) {
    return tab.status == "complete" && tab.url.match(/^http/);
  }
}
