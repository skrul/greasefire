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
  _inited: false,
  init: function() {
    XPCOMUtils.defineLazyServiceGetter(
        this, "_gfs", "@skrul.com/greasefire/service;1",
        "gfIGreasefireService");

    window.addEventListener("load", this, false);
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
  isFirefox4GM : function() {
	return document.getElementById("greasemonkey-tbb") != null;
  },
  isScriptish : function(){
	return document.getElementById("scriptish_general_menu") != null;
  },
  _setupMenu: function() {
    var popup = null;
	if(this.isFirefox4GM()){ //firefox 4
		this._toolbutton = document.getElementById("greasemonkey-tbb");
	}else if(this.isScriptish()){
		this._toolbutton = document.getElementById("scriptish-button");
	}
	if(!this._toolbutton) //ugithub #8 :for prevening the js error when no greasemonkey or scriptish enabled
		return false;

	this._inited = true;

	popup = this._toolbutton.firstChild;

    popup.insertBefore(document.createElementNS(this._XUL_NS, "menuseparator"),
                       popup.firstChild);
    this._menuItem = document.createElementNS(this._XUL_NS, "menuitem");
    // Use "onmouseup" here to trigger the picker window.  This was previously
    // "oncommand" but this caused a strange bug (only on windows) where right
    // clicking on an installed script in the same popup menu would cause the
    // oncommand event to be triggered.
    this._menuItem.setAttribute("label","Grease File...");
    this._menuItem.setAttribute("onmouseup",
                                "GreasefireController.openResults()");
    popup.insertBefore(this._menuItem, popup.firstChild);
  },

  _updateMenu: function() {
    if(!this._inited)
	   return false;

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

    if (this._toolbutton) {
      if (count > 0) {
        this._toolbutton.classList.add("tbb-scripts-available");
      } else {
        this._toolbutton.classList.remove("tbb-scripts-available");
      }
    }
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

      gBrowser.addProgressListener(this);
    }
  },

  // nsIWebProgress
  onLocationChange: function(aProgress, aRequest, aURI) {
    this._newLocation(aURI);
  }
}

GreasefireController.init();
