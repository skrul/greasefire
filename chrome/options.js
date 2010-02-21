function Options() {
  this.throbber_ = null;
}
Options.prototype = {
  init: function() {
    $("#update_interval_days").keyup(function() {
      var val = $(this).val();
      if (val.match(/^\d+$/) && parseInt(val) > 0) {
        $(this).removeClass("error");
        var next_update_date =
          new Date(Date.now() + (val * DAYS_TO_SECONDS * 1000));
        $("#next_update_date").html(next_update_date + "");
        chrome.extension.sendRequest({
          action: "set-settings",
          update_interval_days: val,
          next_update_date: formatISO8601(next_update_date)
        });
      } else {
        $(this).addClass("error");
      }
    });

    $("#scheduled_updates").change(function() {
      chrome.extension.sendRequest({
        action: "set-settings",
        scheduled_updates: $(this).val()
      });
    });

    this.throbber_ = new Throbber(window, document.getElementById("throbber"));
    chrome.extension.onRequest.addListener(bind(this, "onRequest_"));
    this.refresh_();
  },

  update: function(force) {
    chrome.extension.sendRequest({action: force ? "force-update" : "update"});
  },

  refresh_: function() {
    chrome.extension.sendRequest({action: "get-settings"}, function(response) {
      $("#status").html("Ready.");
      $("#index_date").html(parseISO8601(response.current_version) + "");
      $("#script_count").html(response.script_count);
      $("#scheduled_updates").attr("checked", response.scheduled_updates);
      $("#update_interval_days").val(response.update_interval_days);
      $("#next_update_date").html(
        parseISO8601(response.next_update_date) + "");
    });
  },

  onRequest_: function(request, sender, sendRequest) {
    if (request.action == "initialized") {
      this.refresh_();
    }
    if (request.action == "updater-start") {
      $("#status").html("Updating...");
      this.throbber_.start();
    }
    if (request.action == "updater-done") {
      this.throbber_.stop();
      this.refresh_();
    }
    if (request.action == "updater-progress") {
      $("#status").html(request.loaded);
    }
  }
}

var options = new Options();
