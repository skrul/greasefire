var DEBUG = true;

var store = new Store();
var updater = new Updater(store);
var updated_tabs = {};

function load() {
  store.init(function(success, error) {
    d("callback " + success + " " + error);
    updated_tabs = {};

    chrome.extension.onRequest.addListener(
      function(request, sender, sendResponse) {
        if (request.action == "update") {
          updater.update();
          sendResponse({});
          return;
        }

        if (request.action == "search") {
          d("search " + request.url);
          var matches = {};
          var timer = new Timer();
          store.includes().search(request.url, matches, false);
          var ids = [];
          for (var id in matches) {
            ids.push(id);
          }
          store.getScriptDetails(ids, function(status, results) {
            if (status) {
              for (id in results) {
                results[id].matches = matches[id];
              }
              sendResponse({status: true, results: results});
            } else {
              sendResponse({status: false});
            }
            timer.mark("search " + request.url);
          });
        }

        if (request.action == "install") {
          installScript(request.url);
        }
      }
    );

    chrome.tabs.onUpdated.addListener(function(tagId, changeInfo, tab) {
      testUrl(tab);
    });

    chrome.tabs.onSelectionChanged.addListener(function(tabId, selectInfo) {
      if (!(tabId in updated_tabs)) {
        chrome.tabs.get(tabId, function(tab) {
          testUrl(tab);
          updated_tabs[tabId] = true;
        });
      }
    });

  });
}

function isValid(tab) {
  return tab.status == "complete" && tab.url.match(/^http/);
}

function testUrl(tab) {
  if (!isValid(tab)) {
    chrome.pageAction.hide(tab.id);
    return;
  }

  var matches = {};
  var timer = new Timer();
  store.includes().search(tab.url, matches, true);
  timer.mark("testUrl " + tab.url);
  var found = false;
  for (var id in matches) {
    found = true;
    console.log(id + " " + matches[id]);
  }
  if (found) {
    chrome.pageAction.show(tab.id);
  } else {
    chrome.pageAction.hide(tab.id);
  }
}

function installScript(url) {
  chrome.tabs.executeScript(null, {
    code: "window.location = '" + url + "';"
  });
}
