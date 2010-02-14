function load() {
  chrome.tabs.getSelected(null, function(tab) {
    var timer = new Timer();
    timer.mark("start search");
    chrome.extension.sendRequest(
      {action: "search", url: tab.url},
      function(response) {
        timer.mark("end search");
        if (response.status) {
          var html = "";
          for (var id in response.results) {
            var uso_url =
              "http://userscripts.org/scripts/source/" + id + ".user.js";
            html += "<p><a href='" + uso_url + "'>" +
              response.results[id].name + "</a></p>";
          }
          $("#results").html(html);
          timer.mark("end html");
        }
      });
  });

  $("#results").click(function(e) {
    var url = e.target.href;
    if (url) {
      chrome.extension.sendRequest({action: "install", url: url});
      window.close();
    }
  });
}
