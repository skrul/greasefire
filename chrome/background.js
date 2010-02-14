var DEBUG = true;

var store = new Store();
var updater = new Updater(store);

function load() {
  store.init(function(success, error) {
    console.log("callback " + success + " " + error);

    chrome.extension.onRequest.addListener(
      function(request, sender, sendResponse) {
        if (request.action == "update") {
          updater.update();
          sendResponse({});
          return;
        }

        if (request.action == "search") {
          console.log("search " + request.url);
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
      }
    );

    chrome.tabs.onUpdated.addListener(function(tagId, changeInfo, tab) {
      if (tab.status == "complete" &&
          store.includes() &&
          tab.url.match(/^http/)) {
        console.log("test " + tab.url);
        var matches = {};
        var timer = new Timer();
        store.includes().search(tab.url, matches, true);
        timer.mark("search " + tab.url);
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
    });
  });

  chrome.pageAction.onClicked.addListener(function(tab) {
    chrome.tabs.create({url: "picker.html?url=" + encodeURIComponent(tab.url)});
  });
}
