/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
if(!("Cc" in window))
  window.Cc = Components.classes;
if(!("Ci" in window))
  window.Ci = Components.interfaces;

var GreasefireController = {

  _XUL_NS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
  _ios: null,
  _gfs: null,
  _appContext: null,
  _menuItem: null,
  _currentResults: null,
  _currentURI: null,
  _monkey: null,

  init: function() {
    this._ios = Cc["@mozilla.org/network/io-service;1"]
                  .getService(Ci.nsIIOService);
    this._gfs = Cc["@skrul.com/greasefire/service;1"]
                  .getService(Ci.gfIGreasefireService);

    window.addEventListener("load", this, false);
    window.addEventListener("unload", this, false);
  },

  _newLocation: function(aURI) {
    this._currentURI = aURI;
    if (aURI) {
      this._currentResults = this._gfs.search(aURI);
    }
    else {
      this._currentResults = null;
    }

    this._updateMenu();
  },

  _setupMenu: function() {
    var popup = document.getElementById("gm-status-popup");
    popup.insertBefore(
      document.createElementNS(this._XUL_NS, "menuseparator"),
      popup.firstChild);
    this._menuItem = document.createElementNS(this._XUL_NS, "menuitem");
    // Use "onmouseup" here to trigger the picker window.  This was previously
    // "oncommand" but this caused a strange bug (only on windows) where right
    // clicking on an installed script in the same popup menu would cause the
    // oncommand event to be triggered.
    this._menuItem.setAttribute("onmouseup",
                                "GreasefireController.openResults()");
    popup.insertBefore(this._menuItem, popup.firstChild);

    this._monkey = document.getElementById("gm-status-image");
  },

  _updateMenu: function() {

    var count = this._currentResults ? this._currentResults.length : 0;
    var label;
    switch(count) {
    case 0:
      label = "No scripts available";
      break;
    case 1:
      label = "1 script available";
      break;
    default:
      label = count + " scripts available";
    }

    this._menuItem.setAttribute("label", label);
    this._menuItem.setAttribute("disabled", count == 0 ? "true" : "false");

    var classList = this._monkey.className.split(" ");
    classList = classList.filter(function(e) {
      return e != "scripts-available";
    });

    if (count > 0) {
      classList.push("scripts-available");
    }
    this._monkey.className = classList.join(" ");
  },

  openResults: function() {

    if (!this._currentResults) {
      return;
    }

    var params = Cc["@mozilla.org/embedcomp/dialogparam;1"]
                   .createInstance(Ci.nsIDialogParamBlock);
    var array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    array.appendElement(this._currentResults, false);
    array.appendElement(this._currentURI, false);
    params.objects = array;

    openDialog("chrome://greasefire/content/picker.xul",
               "",
               "chrome,dialog=no,resizable",
               params);
  },

  handleEvent: function(aEvent) {

    if (aEvent.type == "load") {
      this._setupMenu();

      gBrowser.addProgressListener(this,
                                   Ci.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
    }
  },

  // nsIWebProgress
  onLocationChange: function(aProgress, aRequest, aURI)
  {
    this._newLocation(aURI);
  },

  onStateChange: function() {},
  onProgressChange: function() {},
  onStatusChange: function() {},
  onSecurityChange: function() {},
  onLinkIconAvailable: function() {}
}

GreasefireController.init();
