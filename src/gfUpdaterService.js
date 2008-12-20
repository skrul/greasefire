/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

const MINUTE_IN_MS = 60 * 1000;

const DEBUG = false;

const NS_PROFILE_STARTUP_OBSERVER_ID  = "profile-after-change";
const NS_PROFILE_SHUTDOWN_OBSERVER_ID = "profile-before-change";

const UPDATE_URL = "http://skrul.com/projects/greasefire/update.php";

const JARFILES = ["include.dat", "exclude.dat", "scripts.db", "info.ini"];

function TRYIGNORE(aFunc) {
  try {
    aFunc();
  }
  catch (e) {
    Cu.reportError(e);
  }
}

function d(s) {
  if (DEBUG) {
    dump("gfUpdaterService: " + s + "\n");
  }
}

function gfUpdaterService() {
  d("ctor");

  this._gfs = null;
  this._prefs = null;
  this._isUpdating = false;
  this._listeners = [];

  this._nextUpdate = null;
  this._timer = null;
  this._wbp = null;
  this._timer;

  var obs = Cc["@mozilla.org/observer-service;1"]
              .getService(Ci.nsIObserverService);
  obs.addObserver(this, NS_PROFILE_STARTUP_OBSERVER_ID, false);
  obs.addObserver(this, NS_PROFILE_SHUTDOWN_OBSERVER_ID, false);
}

gfUpdaterService.prototype = {
  classDescription: "Greasefire Updater Service",
  classID:          Components.ID("{7c5b9317-0b18-4390-9a0a-a594d544a99f}"),
  contractID:       "@skrul.com/greasefire/updater;1"
}

gfUpdaterService.prototype._startup =
function gfUpdaterService__startup()
{
  d("startup");

  this._gfs = Cc["@skrul.com/greasefire/service;1"]
                .getService(Ci.gfIGreasefireService);

  this._prefs = Cc["@mozilla.org/preferences-service;1"]
                  .getService(Components.interfaces.nsIPrefService)
                  .getBranch("greasefire.");

  // If we are overdue for an update at startup, push it a minute in the future
  // so we don't slow down startup
  if (this.updateIntervalMinutes > 0 && Date.now() > this.nextUpdateDate) {
    this._updateNextUpdateDate(1);
  }

  this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  this._timer.initWithCallback(this,
                               MINUTE_IN_MS,
                               Ci.nsITimer.TYPE_REPEATING_SLACK);
}

gfUpdaterService.prototype._shutdown =
function gfUpdaterService__shutdown()
{
  d("shutdown");

  if (this._timer) {
    this._timer.cancel();
    this._timer = null;
  }
}

gfUpdaterService.prototype._updateNextUpdateDate =
function gfUpdaterService__updateNextUpdateDate(aMinutes)
{
  var ms = aMinutes * MINUTE_IN_MS;
  this._prefs.setCharPref("next_update_date", Date.now() + ms);
}

gfUpdaterService.prototype._processDownload =
function gfUpdaterService__processDownload()
{
  var zipReader = Cc["@mozilla.org/libjar/zip-reader;1"]
                    .createInstance(Ci.nsIZipReader);

  var status = Cr.NS_OK;
  var message = "OK";

  try {
    zipReader.open(this._dest);
    JARFILES.forEach(function(e) {
      zipReader.test(e);
    });

    // Create a temp dir for unpacking
    var em = Cc["@mozilla.org/extensions/manager;1"]
               .getService(Ci.nsIExtensionManager);
    var installLocation = em.getInstallLocation("greasefire@skrul.com");
    var exDir = installLocation.location;
    exDir.append("greasefire@skrul.com");

    var unpackDir = exDir.clone();
    unpackDir.append("indexes.new");
    unpackDir.createUnique(Ci.nsIFile.DIRECTORY_TYPE, 0755);

    JARFILES.forEach(function(e) {
      var f = unpackDir.clone();
      f.append(e);
      zipReader.extract(e, f);
    });

    var oldIndexDir = exDir.clone();
    oldIndexDir.append("indexes");

    var backupDir = exDir.clone();
    backupDir.append("indexes.backup");
    backupDir.createUnique(Ci.nsIFile.DIRECTORY_TYPE, 0755);

    // Stop the greasefire service and move the dirs around
    this._gfs.shutdown();
    try {
      if (oldIndexDir.exists()) {
        oldIndexDir.moveTo(backupDir, "");
      }
      unpackDir.moveTo(null, "indexes");
      this._gfs.startup();
    }
    catch (e) {
      // Something went wrong, move things back
      Cu.reportError("Error moving indexes " + e.message);
      status = Cr.NS_ERROR_FAILURE;
      message = "Error moving indexes: " + e.message;

      unpackDir.remove(true);
      oldIndexDir.moveTo(exDir, "");
      this._gfs.startup();
    }

    // Everything is ok, delete the backup dir
    backupDir.remove(true);
  }
  catch (e) {
    Cu.reportError(e);
    if (status = Cr.NS_OK) {
      status = Cr.NS_ERROR_FAILURE;
      message = e.message;
    }
  }

  TRYIGNORE(function() {
    zipReader.close();
  });

  this._updateFinished(status, message);
}

gfUpdaterService.prototype._updateFinished =
function gfUpdaterService__updateFinished(aStatus, aMessage) {

  this._isUpdating = false;

  if (this._dest) {
    var dest = this._dest;
    TRYIGNORE(function() {
      dest.remove(false);
    });
    this._dest = null;
  }

  if (this._wbp) {
    this._wbp.progressListener = null;
  }
  this._wbp = null;

  this._notify(function(l) {
    l.onUpdateFinished(aStatus, aMessage);
  });
}

gfUpdaterService.prototype._notify =
function gfUpdaterService__notify(aFunc)
{
  this._listeners.forEach(function(l) {
    try {
      aFunc(l);
    }
    catch (e) {
      Cu.reportError(e);
    }
  });
}

// gfIUpdaterService
gfUpdaterService.prototype.startUpdate =
function gfUpdaterService_startUpdate(aForce)
{
  if (this._isUpdating) {
    return;
  }

  this._isUpdating = true;
  this._notify(function(l) {
    l.onUpdateStarted();
  });

  try {
    this._wbp = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
                  .createInstance(Ci.nsIWebBrowserPersist);
    this._wbp.progressListener = this;

    // Create a destination file for the download
    this._dest = Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties)
                 .get("TmpD", Ci.nsIFile);
    this._dest.append("greasefire_index_download.jar");
    this._dest.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);

    // Start the download
    var ios = Cc["@mozilla.org/network/io-service;1"]
                .getService(Ci.nsIIOService);
    var uri = ios.newURI(UPDATE_URL, null, null);

    var headers = null;
    if (this._gfs.indexDate > 0 && !aForce) {
      headers = "If-Modified-Since: " +
                (new Date(this._gfs.indexDate)).toGMTString() + "\r\n";
    }

    this._wbp.saveURI(uri, null, null, null, headers, this._dest);
  }
  catch (e) {
    // Something went wrong setting up the download.
    Cu.reportError(e);
    this._updateFinished(Cr.NS_ERROR_FAILURE, e.message);
  }

}

gfUpdaterService.prototype.cancelUpdate =
function gfUpdaterService_cancelUpdate()
{
  if (this._isUpdating && this._wbp) {
    this._wbp.cancelSave();
  }
}

gfUpdaterService.prototype.__defineGetter__("isUpdating",
function gfUpdaterService_get_isUpdating()
{
  return this._isUpdating;
});

gfUpdaterService.prototype.__defineGetter__("nextUpdateDate",
function gfUpdaterService_get_nextUpdateDate()
{
  try {
    return parseInt(this._prefs.getCharPref("next_update_date"));
  }
  catch(e) {
  }
  return 0;
});

gfUpdaterService.prototype.__defineGetter__("updateIntervalMinutes",
function gfUpdaterService_get_updateIntervalMinutes()
{
  try {
    return this._prefs.getIntPref("update_interval_minutes");
  }
  catch(e) {
  }
  return 0;
});

gfUpdaterService.prototype.__defineSetter__("updateIntervalMinutes",
function gfUpdaterService_set_updateIntervalMinutes(aMinutes)
{
  this._prefs.setIntPref("update_interval_minutes", aMinutes);
  this._updateNextUpdateDate(aMinutes);
});

gfUpdaterService.prototype.addListener =
function gfUpdaterService_addListener(aListener)
{
  if (this._listeners.indexOf(aListener) >= 0) {
    return;
  }
  this._listeners.push(aListener);
}

gfUpdaterService.prototype.removeListener =
function gfUpdaterService_removeListener(aListener)
{
  this._listeners.filter(function(e) {
    return aListener != e;
  });
}

// nsIWebProgressListener
gfUpdaterService.prototype.onStateChange =
function gfUpdaterService_onStateChange(aWebProgress,
                                        aRequest,
                                        aStateFlags,
                                        aStatus)
{
  d("onStateChange");
  if (this._isUpdating && aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {

    if (this._wbp.result == Cr.NS_BINDING_ABORTED) {
      this._updateFinished(Cr.NS_BINDING_ABORTED, "Cancelled");
      return;
    }

    var responseStatus = null;
    try {
      responseStatus = aRequest.QueryInterface(Ci.nsIHttpChannel).responseStatus;
    }
    catch (e) {
    }

    if (responseStatus == 200) {
      this._processDownload();
      return;
    }

    if (responseStatus == 304) {
      this._updateFinished(Cr.NS_ERROR_FILE_ALREADY_EXISTS, "Not Modified");
      return;
    }

    this._updateFinished(Cr.NS_ERROR_FAILURE,
                         "status = 0x" + aStatus.toString(16) + " " +
                         "http = " + responseStatus);
  }
}

gfUpdaterService.prototype.onProgressChange =
function gfUpdaterService_onProgressChange(aWebProgress,
                                           aRequest,
                                           aCurSelfProgress,
                                           aMaxSelfProgress,
                                           aCurTotalProgress,
                                           aMaxTotalProgress)
{
  if (this._isUpdating) {
    this._notify(function(l) {
      l.onDownloadProgress(aCurTotalProgress, aMaxTotalProgress);
    });
  }
}

gfUpdaterService.prototype.onLocationChange =
function gfUpdaterService_onLocationChange(aWebProgress, aRequest, aLocation)
{
}

gfUpdaterService.prototype.onStatusChange =
function gfUpdaterService_onStatusChange(aWebProgress,
                                         aRequest,
                                         aStatus,
                                         aMessage)
{
}

gfUpdaterService.prototype.onSecurityChange =
function gfUpdaterService_onSecurityChange(aWebProgress, aRequest, aState)
{
}

// nsITimer
gfUpdaterService.prototype.notify =
function gfUpdaterService_notify(aTimer)
{
  if (this.updateIntervalMinutes > 0 && Date.now() > this.nextUpdateDate) {
    this._updateNextUpdateDate(this.updateIntervalMinutes);
    this.startUpdate(false);
  }
}

// nsIObserver
gfUpdaterService.prototype.observe =
function gfUpdaterService_observe(aSubject, aTopic, aData)
{
  if (aTopic == NS_PROFILE_STARTUP_OBSERVER_ID) {
    this._startup();
  }
  else if (aTopic == NS_PROFILE_SHUTDOWN_OBSERVER_ID) {
    this._shutdown();
    var obs = Cc["@mozilla.org/observer-service;1"]
                .getService(Ci.nsIObserverService);
    obs.removeObserver(this, NS_PROFILE_STARTUP_OBSERVER_ID);
    obs.removeObserver(this, NS_PROFILE_SHUTDOWN_OBSERVER_ID);
  }
}

#include ../include/XPCOMUtils.jsm

gfUpdaterService.prototype.QueryInterface =
  XPCOMUtils.generateQI([Ci.gfIUpdaterService,
                         Ci.nsIObserver,
                         Ci.nsIWebProgressListener,
                         Ci.nsITimerCallback]);

var NSGetModule = XPCOMUtils.generateNSGetModule(
  [
    gfUpdaterService
  ],
  function(aCompMgr, aFileSpec, aLocation) {
    XPCOMUtils.categoryManager.addCategoryEntry(
      "app-startup",
      gfUpdaterService.prototype.classDescription,
      "service," + gfUpdaterService.prototype.contractID,
      true,
      true);
  }
);

function do(o) {

  var s = "";
  if (typeof(o) == "string") {
    s = o;
  }
  else {
    if (o.length) {
    }
    else {
      var a = [];
      for (var k in o) {
        a.push(k + " => " + o[k]);
      }
      s = a.join(", ");
    }
  }

  dump("[updater]  " + s + "\n");

}
