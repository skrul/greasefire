function Greasefire() {
  this.store_ = new Store();
  this.updater_ = new Updater(this.store_);
  // What tabs remain to be requeried after an index update.
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
      d("Store initialized with version " + current_version +
        " script count " + that.store_.script_count());
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
    this.updater_.startScheduledUpdates();

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
      timer.done("init complete");
      chrome.extension.sendRequest({action: "initialized"});
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
    case "navigate":
      this.navigate_(request.url);
      sendResponse({});
      break;
    case "get-settings":
      sendResponse({
        script_count: this.store_.script_count(),
        current_version: this.store_.current_version().getTime(),
        enable_scheduled_updates: this.updater_.enable_scheduled_updates(),
        next_update_date: this.updater_.next_update_date().getTime()
      });
      break;
    case "set-settings":
      if ("enable_scheduled_updates" in request) {
        this.updater_.set_enable_scheduled_updates(
          request.enable_scheduled_updates);
      }
      break;
    case "reset":
      this.reset_(function() {
        sendResponse({});
      });
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

  reset_: function(callback) {
    var that = this;
    this.store_.reset(function(success) {
      that.updater_.reset();
      callback(success);
    });
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
    var timer = new Timer();

    var excludes = {};
    this.store_.excludes().search(url, excludes, false);
    var matches = {};
    this.store_.includes().search(url, matches, false, excludes);
    var ids = [];
    for (var id in matches) {
      ids.push(id);
    }
    var that = this;
    this.store_.getScriptDetails(ids, function(status, results) {
      if (status) {
        // Add matched character count back to the results.
        for (id in results) {
          results[id].matches = matches[id];
        }
        that.rankResults_(results);
        callback(true, results);
      } else {
        callback(false);
      }
      timer.mark("search " + url);
    });
  }),

  rankResults_: function(results) {
    var updated_min = null;
    var updated_max = null;
    var average_reviews_min = null;
    var average_reviews_max = null;
    var matches_min = null;
    var matches_max = null;

    for (var id in results) {
      var result = results[id];
      if (updated_min == null || result.updated < updated_min) {
        updated_min = result.updated;
      }
      if (updated_max == null || result.updated > updated_max) {
        updated_max = result.updated;
      }

      if (average_reviews_min == null ||
          result.average_reviews < average_reviews_min) {
        average_reviews_min = result.average_reviews;
      }
      if (average_reviews_max == null ||
          result.average_reviews > average_reviews_max) {
        average_reviews_max = result.average_reviews;
      }
      if (matches_min == null || result.match < matches_min) {
        matches_min = result.match;
      }
      if (matches_max == null || result.match > matches_max) {
        matches_max = result.match;
      }
    }

    var updated_range = updated_max - updated_min;
    var average_reviews_range = average_reviews_max - average_reviews_min;;
    var matches_range = matches_max - matches_min;

    for (id in results) {
      var result = results[id];
      var updated = updated_range > 0 ?
          (result.updated - updated_min) / updated_range : 1;
      var average_reviews = average_reviews_range > 0 ?
          (result.average_reviews - average_reviews_min) /
              average_reviews_range : 1;
      var matches = matches_range > 0 ?
          (result.matches - matches_min) / matches_range : 1;
      results[id].rank = (average_reviews * .5) +
                         (updated * .25) +
                         (matches * .25);
    }
  },

  navigate_: function(url) {
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
