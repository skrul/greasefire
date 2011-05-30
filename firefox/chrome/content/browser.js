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
  $: function(aID) document.getElementById(aID),

  init: function() {
    XPCOMUtils.defineLazyGetter(this, "_gfs", function() {
      return Cc["@skrul.com/greasefire/service;1"].getService().wrappedJSObject;
    });

    window.addEventListener("load", this, false);
  },

  _newLocation: function(aURI) {
    this._currentURI = aURI;
    this._currentResults = aURI ? this._gfs.search(aURI) : null;
    this._updateMenu();
  },

  _setupMenu: function() {
    if (this._menuItem)
      return false;

    this._toolbutton = this.$("greasemonkey-tbb") || this.$("scriptish-button");

    // Github #8: Prevent the JS error when neither GM or Scriptish are enabled
    if (!this._toolbutton)
      return false;

    var popup = this._toolbutton.firstChild;
    popup.insertBefore(document.createElementNS(this._XUL_NS, "menuseparator"),
                       popup.firstChild);

    this._menuItem = document.createElementNS(this._XUL_NS, "menuitem");
    this._menuItem.setAttribute("oncommand",
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
    this._menuItem.setAttribute("disabled", count == 0);

    if (this._toolbutton) {
      if (count > 0)
        this._toolbutton.classList.add("tbb-scripts-available");
      else
        this._toolbutton.classList.remove("tbb-scripts-available");
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
