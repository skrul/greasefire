/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

function GF_Trim(s) {
  return s.replace(/^\s\s*/, "").replace(/\s\s*$/, "");
}

const US_BASE = "http://userscripts.org/scripts/";

function $(id) {
  return document.getElementById(id);
}

function getWebProgress(aIframe) {
  var wp = aIframe.docShell.QueryInterface(Ci.nsIInterfaceRequestor)
               .getInterface(Ci.nsIWebProgress);
  return wp;
}

var PickerController = {

  _list: null,
  _info: null,
  _source: null,
  _busyCount: 0,

  init: function PickerController_init() {

    var params = window.arguments[0].QueryInterface(Ci.nsIDialogParamBlock);
    this._results = params.objects.queryElementAt(0, Ci.nsIArray);
    var uri = params.objects.queryElementAt(1, Ci.nsIURI);

    document.title = "Scripts for \"" + uri.spec + "\"";

    this._install = $("install");

    this._list = $("list");
    this._view = new ResultsView(this._results);
    this._list.view = this._view;
    this._list.addEventListener("select", this, false);

    var flags = Ci.nsIWebProgress.NOTIFY_STATE_REQUEST;

    this._info = $("info");
    this._info.addEventListener("click", this, false);
    var wp = getWebProgress(this._info);
    wp.addProgressListener(this, flags);

    this._source = $("source");
    wp = getWebProgress(this._source);
    wp.addProgressListener(this, flags);

    if (this._results.length > 0) {
      this._list.view.selection.select(0);
    }
  },

  installSelected: function () {

    var index = this._list.view.selection.currentIndex;
    var info = this._view.getInfo(index);

    var ios = Cc["@mozilla.org/network/io-service;1"]
                .getService(Ci.nsIIOService);

    var uriSpec = US_BASE + "source/" + info.scriptId + ".user.js";
    var uri = ios.newURI(uriSpec, null, null);

    window.opener.GM_BrowserUI.startInstallScript(uri, false);
  },

  updateFilter: function() {
    var filter = $("filter").value;
    var a = GF_Trim(filter).split(" ");
    this._view.setFilter(a);
  },

  handleEvent: function (aEvent) {
    if (aEvent.type == "select") {
      var index = this._list.view.selection.currentIndex;
      var info = this._view.getInfo(index);
      this._scriptSelected(info);
      return true;
    }

    if (aEvent.type == "click") {
      var target = aEvent.target;
      if ((target instanceof HTMLAnchorElement ||
           target instanceof HTMLAreaElement ||
           target instanceof HTMLLinkElement) &&
          target.hasAttribute("href")) {
        aEvent.preventDefault();
        var href = target.getAttribute("href");

        var ios = Cc["@mozilla.org/network/io-service;1"]
                    .getService(Ci.nsIIOService);

        if (target.className == "userjs") {
          var uri = ios.newURI(href, null, null);
          window.opener.GM_BrowserUI.startInstallScript(uri, false);
          return false;
        }

        var url = ios.newURI($("url").value, null, null);
        var absolute = url.resolve(href);
        openURL(absolute);
        return false;
      }
    }

  },

  _scriptSelected: function (aInfo) {
    this._install.label = "Install \"" + aInfo.name + "\"";
    var req = new ScriptRequest(aInfo, this);
    req.load();
  },

  _infoLoaded: function (aInfo, aUriSpec) {
    this._info.webNavigation.loadURI(aUriSpec,
                                     Ci.nsIWebNavigation.LOAD_FLAGS_NONE,
                                     null,
                                     null,
                                     null);
    this._source.webNavigation.loadURI(US_BASE + "review/" + aInfo.scriptId + "?format=txt",
                                       Ci.nsIWebNavigation.LOAD_FLAGS_NONE,
                                       null,
                                       null,
                                       null);
  },

  // nsIWebProgressListener
  onStateChange: function (aWebProgress, aRequest,  aStateFlags, aStatus) {

    if (aStateFlags & Ci.nsIWebProgressListener.STATE_START) {
      this._busyCount++;
    }

    if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
      this._busyCount--;
    }

    $("throbber").className = this._busyCount ? "throbber-throb" : "throbber";
  },

  QueryInterface: function (aIID) {
    if (!aIID.equals(Ci.nsISupports) &&
        !aIID.equals(Ci.nsIDOMEventListener) &&
        !aIID.equals(Ci.nsIWebProgressListener) &&
        !aIID.equals(Ci.nsISupportsWeakReference))
      throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  }

}

function ScriptRequest(aScript, aController) {
  this._controller = aController;
  this._script = aScript;
  this._xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);
}

ScriptRequest.prototype = {

  load: function () {

    var url = US_BASE + "show/" + this._script.scriptId;
    this._xhr.addEventListener("load", this, false);
    this._xhr.addEventListener("error", this, false);
    this._xhr.open("GET", url, true);
    this._xhr.send(null);

    $("url").value = url;
  },

  handleEvent: function (aEvent) {

    var uriSpec;
    if (aEvent.type == "load") {
      var css = "";
      css += "#mainmenu, #script_search, #account, #right { display: none }";
      css += "#content { margin: 0 0 0 0 !important }";
      css += "body { background: #ffffff none !important }";
      var text = this._xhr.responseText;

      // fix images with relative paths
      text = text.replace("src=\"/", "src=\"http://userscripts.org/", "g");
      text = "<style>" + css + "</style>" + text;
      uriSpec = "data:text/html," + encodeURIComponent(text);
    }
    else {
      uriSpec = "about:blank";
    }

    this._xhr.removeEventListener("load", this, false);
    this._xhr.removeEventListener("error", this, false);
    this._xhr = null;

    this._controller._infoLoaded(this._script, uriSpec);
  }

}

function ResultsView(aResults) {

  this._a = [];
  this._view = [];
  for (var i = 0; i < aResults.length; i++) {
    var result = aResults.queryElementAt(i, Ci.gfISearchResult);
    this._a.push(result);
    this._view.push(i);
  }
  this._sort();
}

ResultsView.prototype = {
  _treebox: null,
  _selection: null,
  _currentSort: "scriptrank",
  _sorts: {
    scriptname: true,
    scriptrank: false
  },
  getInfo: function (row) {
    return this._a[this._view[row]];
  },
  get rowCount() {
    return this._view.length;
  },
  getCellText: function (row, column) {
    var result = this._a[this._view[row]];
    switch(column.id) {
      case "scriptname":     return result.name;
      case "scriptmatch":    return result.match;
      case "scriptinstalls": return result.installs;
      case "scriptupdated":
        return (new Date(result.updated)).toLocaleDateString();
      case "scriptrank":     return result.rank;
    }
  },
  getCellValue: function (row, column) {
    return this._a[this._view[row]].rank * 100;
  },
  getProgressMode: function (row, column) {
    return Ci.nsITreeView.PROGRESS_NORMAL;
  },
  cycleHeader: function (column) {
    var dir = this._sorts[column.id];
    this._sorts[column.id] = !dir;
    this._currentSort = column.id;
    this._sort();
    this._treebox.invalidate();
  },
  setFilter: function (filter) {
    var oldLength = this._view.length;
    this._view = [];
    if (filter == "") {
      for (var i = 0; i < this._a.length; i++) {
        this._view.push(i);
      }
    }
    else {
      this._a.forEach(function (e, idx) {
        for (var i = 0; i < filter.length; i++) {
          if (e.name.toLowerCase().indexOf(filter[i]) < 0) {
            return;
          }
        }
        this._view.push(idx);
      }, this);
    }

    this._treebox.beginUpdateBatch();
    try {
      this._treebox.rowCountChanged(0, this._view.length - oldLength);
      this._sort();
      this._selection.select(0);
    }
    finally {
      this._treebox.endUpdateBatch();
    }
  },
  _sort: function () {

    var colId = this._currentSort;
    var direction = this._sorts[colId];

    var _a = this._a;
    var cmp = function (aidx, bidx) {

      function getValue(o) {
        switch(colId) {
          case "scriptname":     return o.name.toLowerCase();
          case "scriptmatch":    return o.match;
          case "scriptinstalls": return o.installs;
          case "scriptupdated":  return o.updated;
          case "scriptrank":     return o.rank;
        }
      }

      var a = _a[aidx];
      var b = _a[bidx];
      if (getValue(a) < getValue(b)) {
        return direction ? -1 : 1;
      }
      if (getValue(a) > getValue(b)) {
        return direction ? 1 : -1;
      }
      return 0;
    }

    this._view.sort(cmp);
  },
  get selection() {
    return this._selection;
  },
  set selection(selection) {
    this._selection = selection;
  },
  setTree: function (treebox) { this._treebox = treebox; },
  isContainer: function (row) { return false; },
  isSeparator: function (row) { return false; },
  isSorted: function () { return false; },
  getLevel: function (row) { return 0; },
  getImageSrc: function (row, col) { return null; },
  getRowProperties: function (row, props) {},
  getCellProperties: function (row, col, props) {},
  getColumnProperties: function (colid, col, props) {}
};
