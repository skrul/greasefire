function update() {
  chrome.extension.sendRequest({action: "update"});
}

function load() {
  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      if (request.action == "progress") {
        document.getElementById("progress").value = request.loaded;
      }
      if (request.action == "message") {
        document.getElementById("progress").value = request.message;
      }
    }
  );
}
