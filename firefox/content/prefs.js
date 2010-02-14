/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

function $(id) {
  return document.getElementById(id);
}

var PrefsController = {

  _gfs: null,
  _up: null,

  init: function PrefsController_init() {
    this._gfs = Cc["@skrul.com/greasefire/service;1"]
                  .getService(Ci.gfIGreasefireService);
    this._up = Cc["@skrul.com/greasefire/updater;1"]
                 .getService(Ci.gfIUpdaterService);

    $("days").value = this._up.updateIntervalMinutes / (24 * 60);

    this._up.addListener(this);
    this._updateDisplay();
  },

  unload: function () {
    this._up.removeListener(this);
  },

  update: function() {
    if (this._up.isUpdating) {
      this._up.cancelUpdate();
    }
    else {
      this._up.startUpdate(false);
    }
  },

  updateInterval: function (aDays) {
    var d = parseInt(aDays);
    if (!isNaN(d) && d >= 0) {
      this._up.updateIntervalMinutes = d * 60 * 24;
    }
    this._updateDisplay();
  },

  updateCheckbox: function (aChecked) {
    if (aChecked) {
      var d = $("days").value;
      if (d == 0) {
        d = 1;
        $("days").value = 1;
      }
      this.updateInterval(d);
    }
    else {
      this._up.updateIntervalMinutes = 0;
    }
    this._updateDisplay();
  },

  onUpdateStarted: function () {
    $("status").value = "Connecting..."
    this._updateDisplay();
  },

  onUpdateFinished: function (aStatus, aMessage) {

    if (aStatus == Cr.NS_OK) {
      $("status").value = "Update complete!";
    }
    else if (aStatus == Cr.NS_BINDING_ABORTED) {
      $("status").value = "Update cancelled";
      $("progress").value = 0;
    }
    else if (aStatus == Cr.NS_ERROR_FILE_ALREADY_EXISTS) {
      $("status").value = "Already up to date.";
      $("progress").value = 0;
    }
    else {
      $("status").value = "Error updating: " + aMessage;
    }

    this._updateDisplay();
  },

  onDownloadProgress: function (aCurrentBytes, aTotalBytes) {
    $("progress").value = (aCurrentBytes / aTotalBytes) * 100;

    if (aCurrentBytes == aTotalBytes) {
      $("status").value = "Extracting new index...";
    }
    else {
      $("status").value = "Downloading " + aCurrentBytes + " of " + aTotalBytes + " bytes";
    }
  },

  _updateDisplay: function () {
    $("index-date").value = (new Date(this._gfs.indexDate)).toLocaleString();
    $("script-count").value = this._gfs.scriptCount;

    if (this._up.updateIntervalMinutes > 0) {
      $("next-update").value = (new Date(this._up.nextUpdateDate)).toLocaleString();
      $("auto").checked = true;
    }
    else {
      $("next-update").value = "n/a";
      $("auto").checked = false;
    }

    if (this._up.isUpdating) {
      $("update-button").label = "Cancel update";
      $("progress-box").hidden = false;
      $("throbber").hidden = false;
    }
    else {
      $("update-button").label = "Update now";
      $("throbber").hidden = true;
    }
  },

  QueryInterface: function (aIID) {
    if (!aIID.equals(Ci.nsISupports) &&
        !aIID.equals(Ci.gfIUpdateListener) &&
        !aIID.equals(Ci.nsIDOMEventListener))
      throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  }

}
