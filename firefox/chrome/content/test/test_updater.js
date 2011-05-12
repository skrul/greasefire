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

  log("index date" + (new Date(gfs.indexDate)));

  var done = false;
  var doCancel = false;

  u.addListener({
    onUpdateStarted: function() {
      log("onUpdateStarted");
      if (doCancel) {
        log("cancelling");
        u.cancelUpdate();
      }
    },
    onUpdateFinished: function(aStatus, aMessage) {
      log("onUpdateFinished " + aStatus.toString(16) + " " + aMessage);
      done = true;
    },
    onDownloadProgress: function(aCurrentBytes, aTotalBytes) {
      //log("onDownloadProgress " + aCurrentBytes + " " + aTotalBytes);
    }
  });

  u.startUpdate(true);
  while (!done) {
    mainThread.processNextEvent(true);
  }

  log("index date" + (new Date(gfs.indexDate)));

  done = false;
  u.startUpdate(false);
  while (!done) {
    mainThread.processNextEvent(true);
  }

  log("index date" + (new Date(gfs.indexDate)));

/*
  doCancel = true;

  done = false;
  u.startUpdate(true);
  while (!done) {
    mainThread.processNextEvent(true);
  }

  log("index date" + (new Date(gfs.indexDate)));
*/
  return true;
}
