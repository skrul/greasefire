/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */

var GreasefireController = {

  _XUL_NS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",
  _appContext: null,
  _menuItem: null,
  _currentResults: null,
  _currentURI: null,
  _toolbutton: null,
  init: function() {
    XPCOMUtils.defineLazyGetter(this, "_gfs", function() {
      return Cc["@skrul.com/greasefire/service;1"].getService().wrappedJSObject;
    });

    window.addEventListener("load", this, false);
  },

  _newLocation: function(aURI) {
    this._currentURI = aURI;
    if (aURI) {
      this._currentResults = this._gfs.search(aURI);
    } else {
      this._currentResults = null;
    }

    this._updateMenu();
  },
  isFirefox4GM : function() {
    return document.getElementById("greasemonkey-tbb") != null;
  },
  isScriptish : function(){
    return document.getElementById("scriptish_general_menu") != null;
  },
  _setupMenu: function() {
    if (this._menuItem)
        return false;

    var popup = null;

    if (this.isFirefox4GM()) { //firefox 4
      this._toolbutton = document.getElementById("greasemonkey-tbb");
    } else if (this.isScriptish()) {
      this._toolbutton = document.getElementById("scriptish-button");
    } else {
      return false;
    }

	popup = this._toolbutton.firstChild;

    popup.insertBefore(document.createElementNS(this._XUL_NS, "menuseparator"),
                       popup.firstChild);
    this._menuItem = document.createElementNS(this._XUL_NS, "menuitem");
    // Use "onmouseup" here to trigger the picker window.  This was previously
    // "oncommand" but this caused a strange bug (only on windows) where right
    // clicking on an installed script in the same popup menu would cause the
    // oncommand event to be triggered.
    this._menuItem.setAttribute("onmouseup",
                                "GreasefireController.openResults()");
    popup.insertBefore(this._menuItem, popup.firstChild);

    window.removeEventListener("aftercustomization", this, false);
    this._newLocation(gBrowser.currentURI);
  },

  _updateMenu: function() {
    if (!this._menuItem)
      return false;

    var count = this._currentResults ? this._currentResults.length : 0;

    this._menuItem.setAttribute("label", (count + " script(s) available"));
    this._menuItem.setAttribute("disabled", count == 0 ? "true" : "false");

    if (this._toolbutton) {
      if (count > 0) {
        this._toolbutton.classList.add("tbb-scripts-available");
      } else {
        this._toolbutton.classList.remove("tbb-scripts-available");
      }
    }
  },

  openResults: function() {
    if (!this._currentResults || !this._currentResults.length)
      return false;

    var params = {
      results: this._currentResults,
      currentURI: this._currentURI
    };

    openDialog("chrome://greasefire/content/picker.xul",
               "",
               "chrome,dialog=no,resizable",
               params);
  },

  handleEvent: function(aEvent) {
    switch (aEvent.type) {
    case "load":
      window.addEventListener("aftercustomization", this, false);
      gBrowser.addProgressListener(this);
      // no break
    case "aftercustomization":
      this._setupMenu();
      break;
    }
  },

  // nsIWebProgress
  onLocationChange: function(aProgress, aRequest, aURI) {
    this._newLocation(aURI);
  }
}

GreasefireController.init();
