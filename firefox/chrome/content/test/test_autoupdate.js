/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");

function runTest() {
  var mainThread = Services.tm.mainThread;

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
