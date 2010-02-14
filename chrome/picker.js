function load() {
  var timer = new Timer();
  var url = decodeURIComponent(location.search.substr(5));

  timer.mark("start search");
  chrome.extension.sendRequest({action: "search", url: url},
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
}

load();
