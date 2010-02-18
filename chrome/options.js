var throbber;

function do_update() {
  chrome.extension.sendRequest({action: "update"});
}

function do_force_update() {
  chrome.extension.sendRequest({action: "force-update"});
}

function load() {
  throbber = new Throbber(window, document.getElementById("throbber"));
  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      if (request.action == "updater-start") {
        throbber.start();
      }
      if (request.action == "updater-done") {
        throbber.stop();
      }
      if (request.action == "updater-progress") {
        document.getElementById("progress").value = request.loaded;
      }
    }
  );
}
