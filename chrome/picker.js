var HOUR_MS = 1000 * 60 * 60;
var DAY_MS = HOUR_MS * 24;

$(document).ready(function() {
  chrome.tabs.getSelected(null, function(tab) {
    var timer = new Timer();
    timer.mark("start search");
    chrome.extension.sendRequest(
      {action: "search", url: tab.url},
      function(response) {
try {
        timer.mark("end search");
        if (response.status) {
          var results = [];
          for (var id in response.results) {
            var r = response.results[id];
            r.id = id;
            var updated = new Date(r.updated);
            r.updated_formatted = formatDate(updated);
            r.updated_iso8601 = formatISO8601(updated);
            results.push(r);
          }

          results.sort(function(a, b) {
            return b.rank - a.rank;
          });

          $("#results").pureJSTemplate({
            id   : "tpl",
            data : {
              results: results
            }
          });
          timer.mark("end html");
        }
} catch(e) { alert(e); }
      });

  });

  $("#results").click(function(e) {
    var url = e.target.href;
    if (!url)
      return;

    var a = url.match(/chrome-extension:\/\/[^/]*(.*)/);
    if (!(a && a.length == 2))
      return;

    url = "http://userscripts.org" + a[1];
    chrome.tabs.create({url: url});
    window.close();
  });
});

function formatDate(d) {
  var age = Date.now() - d.getTime();
  if (age < DAY_MS)
    return Math.floor(age / HOUR_MS) + " hours";
  var month_name = d.toString().split(" ")[1];
  return month_name + " " + d.getDate() + " " + d.getFullYear();
}
