function Greasefire() {
  this.store_ = new Store();
  this.updater_ = new Updater(this.store_);
  this.updated_tabs_ = {};
}

Greasefire.prototype = {
  init: function() {
    d("greasefire init");
    var that = this;
    // Initialize the store.  This sets up the database and sets up
    // the indexes with any existing data.
    this.store_.init(function(success, error) {
      d("store init " + success + " " + error);
      that.updated_tabs_ = {};

      // Set up listeners.
      chrome.extension.onRequest.addListener(
        bind(that, "onRequest"));
      chrome.tabs.onUpdated.addListener(
        bind(that, "onTabUpdated"));
      chrome.tabs.onSelectionChanged.addListener(
        bind(that, "onTabSelectionChanged"));

      // Test the selected tab.
      chrome.tabs.getSelected(null, function(tab) {
        that.updatePageAction_(tab);
      });
    });
  },

  onRequest: function(request, sender, sendResponse) {
    switch(request.action) {
    case "update":
      this.updateData_(function() {
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

  updateData_: function(callback) {
    this.updater_.update(function() {
      alert("updated");
    });
    callback();
  },

  search_: function(url, callback) {
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
  },

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
    timer.mark("testUrl " + tab.url);
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
