/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

function runTest() {

  var gfs = Cc["@skrul.com/greasefire/service;1"]
              .getService(Ci.gfIGreasefireService);

  var results = gfs.search(newURI("http://www.google.com"));

  var params = Cc["@mozilla.org/embedcomp/dialogparam;1"]
                 .createInstance(Ci.nsIDialogParamBlock);
  var array = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  array.appendElement(results, false);
  params.objects = array;

  const ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
               .getService(Ci.nsIWindowWatcher);

  ww.openWindow(null,
                "chrome://greasefire/content/results.xul",
                "_blank",
                "chrome,all,dialog=no",
                params);

  return true;
}

function newURI(spec) {
  var ioService = Cc["@mozilla.org/network/io-service;1"].
                  getService(Ci.nsIIOService);

  return ioService.newURI(spec, null, null);
}
