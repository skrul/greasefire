/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

function GF_Trim(s) {
  return s.replace(/^\s\s*/, "").replace(/\s\s*$/, "");
}

const US_BASE = "http://greasefire.userscripts.org/scripts/";

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
  _tabpanels: null,
  _scriptInfoLoaded: false,
  _scriptSourceLoaded: false,
  _busyCount: 0,

  init: function PickerController_init() {

    var params = window.arguments[0];
    this._results = params.results;
    var uri = params.currentURI;

    document.title = "Scripts for \"" + uri.spec + "\"";

    this._install = $("install");

    this._list = $("list");
    this._list.classList.add("pickerlist-ff4");
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

    this._tabpanels = $("tabpanels");
    this._tabpanels.addEventListener("select", this, false);

    if (this._results.length > 0) {
      this._list.view.selection.select(0);
    }
  },

  _installScript: function(aURL) {
    var win = Services.wm.getMostRecentWindow("navigator:browser");

    // If we don't have a recent window, open a new one
    if (!win) {
      window.open(aURL);
      return;
    }

    var uri = Services.io.newURI(aURL, null, null);

    if (win.GM_BrowserUI)  // for GM
      win.GM_BrowserUI.startInstallScript(uri, false);
    else if (win.Scriptish_installUri) // for Scriptish
      win.Scriptish_installUri(uri, win);
  },

  installSelectedScript: function () {
    var index = this._list.view.selection.currentIndex;
    var info = this._view.getInfo(index);

    var uriSpec = US_BASE + "source/" + info.scriptId + ".user.js";
    this._installScript(uriSpec);
  },

  updateFilter: function() {
    var filter = $("filter").value;
    var a = GF_Trim(filter).split(" ");
    this._view.setFilter(a);
  },

  handleEvent: function (aEvent) {
    // This select event is for either the result list or tab panel.
    if (aEvent.type == "select") {
      // If the list selection changed, clear the load flags.
      if (aEvent.target.id == "list") {
        this._scriptInfoLoaded = false;
        this._scriptSourceLoaded = false;
      }
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

        if (target.className == "userjs") {
          this._installScript(href);
          return false;
        }

        // HACK: remove the greasefire subdomain from the URL so
        // clicked links go back to http://userscripts.org
        var currentUrl = $("url").value;
        currentUrl = currentUrl.replace("http://greasefire.", "http://");

        var url = Services.io.newURI(currentUrl, null, null);
        var absolute = url.resolve(href);

        // Append source=greasefire so we can track clicks back to the
        // main site.
        absolute += absolute.indexOf("?") == -1 ? "?" : "&";
        absolute += "source=greasefire";
        openURL(absolute);
        return false;
      }
    }

  },

  _scriptSelected: function (aInfo) {
    this._install.label = "Install \"" + aInfo.name + "\"";

    if (this._tabpanels.selectedPanel.id == "info_panel") {
      this._loadInfo(aInfo);
    } else {
      this._loadSource(aInfo);
    }
  },

  _loadInfo: function (aInfo) {
    var uri = US_BASE + "show/" + aInfo.scriptId;
    $("url").value = uri;
    if (this._scriptInfoLoaded) {
      return;
    }
    this._info.webNavigation.loadURI(uri,
                                     Ci.nsIWebNavigation.LOAD_FLAGS_NONE,
                                     null,
                                     null,
                                     null);
    this._scriptInfoLoaded = true;
  },

  _loadSource: function(aInfo) {
    var uri = US_BASE + "review/" + aInfo.scriptId + ".txt";
    $("url").value = uri;
    if (this._scriptSourceLoaded) {
      return;
    }
    this._source.webNavigation.loadURI(
      uri,
      Ci.nsIWebNavigation.LOAD_FLAGS_NONE,
      null,
      null,
      null);
    this._scriptSourceLoaded = true;
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

  QueryInterface: XPCOMUtils.generateQI([
      Ci.nsISupports, Ci.nsIDOMEventListener, Ci.nsIWebProgressListener,
      Ci.nsISupportsWeakReference])

}

function ResultsView(aResults) {

  this._a = aResults;
  this._view = [];
  for (var len = aResults.length, i = 0; i < len; i++) {
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
          if (e.name.toLowerCase().indexOf(filter[i].toLowerCase()) < 0) {
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
