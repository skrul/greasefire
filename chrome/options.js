function Options() {
  this.throbber_ = null;
  // False until we know the service is running.
  this.is_alive_ = false;
}
Options.prototype = {
  init: function() {
    $("#enable_scheduled_updates").change(function() {
      chrome.extension.sendRequest({
        action: "set-settings",
        enable_scheduled_updates: $(this).val() == "on"
      });
    });

    this.throbber_ = new Throbber(window, document.getElementById("throbber"));
    chrome.extension.onRequest.addListener(bind(this, "onRequest_"));
    this.refresh_();
  },

  update: function(force) {
    chrome.extension.sendRequest({action: force ? "force-update" : "update"});
  },

  reset: function() {
    chrome.extension.sendRequest({action: "reset"}, function(response) {
      $("#status").html("Settings reset.  Restart the extension.");
    });
  },

  refresh_: function() {
    chrome.extension.sendRequest({action: "get-settings"}, function(response) {
      if (!this.is_alive_) {
        this.is_alive_ = true;
        $("#status").html("Ready.");
      }
      $("#index_date").html(new Date(response.current_version) + "");
      $("#script_count").html(response.script_count);
      $("#enable_scheduled_updates").attr(
        "checked", response.enable_scheduled_updates);
      $("#next_update_date").html(new Date(response.next_update_date) + "");
    });
  },

  onRequest_: function(request, sender, sendRequest) {
    if (request.action == "initialized") {
      this.is_alive_ = true;
      $("#status").html("Ready.");
      this.refresh_();
    }
    if (request.action == "updater-start") {
      $("#status").html("Updating...");
      this.throbber_.start();
    }
    if (request.action == "updater-done") {
      this.throbber_.stop();
      $("#status").html("Ready.");
      this.refresh_();
    }
    if (request.action == "updater-status") {
      $("#status").html(request.message);
    }
    if (request.action == "updater-progress") {
      $("#status").html(request.loaded);
    }
  }
}

var options = new Options();
