/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

function runTest() {

  var tm = Cc["@mozilla.org/thread-manager;1"].getService(Ci.nsIThreadManager);
  var mainThread = tm.mainThread;

  var gfs = Cc["@skrul.com/greasefire/service;1"]
              .getService(Ci.gfIGreasefireService);

  var u = Cc["@skrul.com/greasefire/updater;1"]
            .getService(Ci.gfIUpdaterService);

  u.updateIntervalMinutes = 2;

  log("index date: " + (new Date(gfs.indexDate)));
  log("next update date: " + (new Date(u.nextUpdateDate)));
  log("update interval: " + u.updateIntervalMinutes);

  var done = false;

  u.addListener({
    onUpdateStarted: function() {
      log("onUpdateStarted");
    },
    onUpdateFinished: function(aStatus, aMessage) {
      log("onUpdateFinished " + aStatus.toString(16) + " " + aMessage);
      done = true;
    },
    onDownloadProgress: function(aCurrentBytes, aTotalBytes) {
      //log("onDownloadProgress " + aCurrentBytes + " " + aTotalBytes);
    }
  });

  for (var i = 0; i < 3; i++) {
    done = false;
    while (!done) {
      mainThread.processNextEvent(true);
    }

    log("index date: " + (new Date(gfs.indexDate)));
    log("next update date: " + (new Date(u.nextUpdateDate)));
    log("update interval: " + u.updateIntervalMinutes);
  }

  return true;
}

function newUri(spec) {
  var ioService = Cc["@mozilla.org/network/io-service;1"].
                  getService(Ci.nsIIOService);

  return ioService.newURI(spec, null, null);
}
