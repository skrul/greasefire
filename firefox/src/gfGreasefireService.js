/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

Components.utils.import("resource://gre/modules/ISO8601DateUtils.jsm");

const DEBUG = false;

const NS_PROFILE_STARTUP_OBSERVER_ID  = "profile-after-change";
const NS_PROFILE_SHUTDOWN_OBSERVER_ID = "profile-before-change";

function GF_GetIndexesDir() {
  var em = Cc["@mozilla.org/extensions/manager;1"]
             .getService(Ci.nsIExtensionManager);
  var installLocation = em.getInstallLocation("greasefire@skrul.com");
  var file = installLocation.location;
  file.append("greasefire@skrul.com");
  file.append("indexes");

  return file;
}

function d(s) {
  if (DEBUG) {
    dump("gfGreasefireService: " + s + "\n");
  }
}

function gfGreasefireService()
{
  d("ctor");

  this._started = false;
  this._includes = null;
  this._excludes = null;
  this._conn = null;

  this._scriptCount = null;
  this._indexDate = Date.now();

  var obs = Cc["@mozilla.org/observer-service;1"]
              .getService(Ci.nsIObserverService);
  obs.addObserver(this, NS_PROFILE_STARTUP_OBSERVER_ID, false);
  obs.addObserver(this, NS_PROFILE_SHUTDOWN_OBSERVER_ID, false);
}

gfGreasefireService.prototype = {
  classDescription: "Greasefire Service",
  classID:          Components.ID("{d647ff9b-ac4c-4d0e-8fbd-484765be5549}"),
  contractID:       "@skrul.com/greasefire/service;1"
}

gfGreasefireService.prototype.startup =
function gfGreasefirbeService_startup()
{
  d("startup");

  if (this._started) {
    return;
  }

  this._scriptCount = null;
  this._indexDate = null;

  var dir = GF_GetIndexesDir();

  var file = dir.clone();
  file.append("include.dat");
  this._includes = new gfIndexReader(file);

  var file = dir.clone();
  file.append("exclude.dat");
  this._excludes = new gfIndexReader(file);

  var storageService = Cc["@mozilla.org/storage/service;1"]
                         .getService(Ci.mozIStorageService);
  file = dir.clone();
  file.append("scripts.db");
  this._conn = storageService.openDatabase(file);

  this._started = true;
}

gfGreasefireService.prototype.shutdown =
function gfGreasefireService_shutdown()
{
  d("shutdown");

  if (!this._started) {
    return;
  }

  if (this._includes) {
    this._includes.close();
  }

  if (this._excludes) {
    this._excludes.close();
  }

  // Only mozilla 1.9 has a close method
  if (this._conn && this._conn.close) {
    this._conn.close();
  }

  this._started = false;
}

// gfIGreasefireService

gfGreasefireService.prototype.hasScripts =
function gfGreasefireService_hasScripts(aURL)
{
  var urlSpec = this._fixUrl(aURL);

  var excludes = {};
  this._excludes.search(urlSpec, excludes, false);

  var matches = {};
  this._includes.search(urlSpec, matches, true, excludes);

  for (var id in matches) {
    return true;
  }

  return false;
}

gfGreasefireService.prototype.search =
function gfGreasefireService_search(aURL)
{
  var urlSpec = this._fixUrl(aURL);

  var excludes = {};
  var t = Date.now();
  this._excludes.search(urlSpec, excludes, false);
  var excludesMark = Date.now();

  var matches = {};
  this._includes.search(urlSpec, matches, false, excludes);
  var searchMark = Date.now();

  var infos = this._getScriptInfos(matches);
  var ranks = this._rankMatches(matches, infos);

  var result = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
  for (var id in matches) {
    var r = new gfSearchResult(id, infos[id], matches[id], ranks[id]);
    result.appendElement(r, false);
  }

  d("****** Search " + aURL.spec +
    " matches " + result.length +
    " exclude " + (excludesMark - t) +
    " include " + (searchMark - t));

  return result;
}

gfGreasefireService.prototype.__defineGetter__("scriptCount",
function gfGreasefireService_get_scriptCount()
{
  if (!this._started) {
    throw Cr.NS_ERROR_UNEXPECTED;
  }

  if (!this._scriptCount) {
    var sql = "select count(1) from scripts";
    var stmt = this._conn.createStatement(sql);
    stmt.executeStep();
    this._scriptCount = stmt.getInt32(0);
    stmt.finalize();
  }

  return this._scriptCount;
});

gfGreasefireService.prototype.__defineGetter__("indexDate",
function gfGreasefireService_get_indexDate()
{
  if (!this._indexDate) {
    this._indexDate = 0;
    var iniFile = GF_GetIndexesDir();
    iniFile.append("info.ini");
    if (iniFile.exists()) {
      try {
        var ini = Cc["@mozilla.org/xpcom/ini-parser-factory;1"]
                    .getService(Ci.nsIINIParserFactory).createINIParser(iniFile);
        var dateString = ini.getString("indexes", "date");
        this._indexDate = ISO8601DateUtils.parse(dateString).getTime();
      }
      catch (e) {
        Cu.reportError(e);
      }
    }
  }
  return this._indexDate;
});

gfGreasefireService.prototype._fixUrl =
function gfGreasefireService__fixUrl(aURL)
{
  var urlSpec = aURL.spec;

  // XXX performance breaks down on really long URLs, so trim to 50 chars
  urlSpec = urlSpec.substring(0, 50);
  return urlSpec;
}

gfGreasefireService.prototype._getScriptInfos =
function gfGreasefireService__getSctiptInfos(matches)
{
  var ids = [];
  for (var id in matches) {
    ids.push(id);
  }

  var infos = {};
  var sql = "select id, name, installs, updated from scripts where id in (";
  sql += ids.join(",");
  sql += ");";

  var stmt = this._conn.createStatement(sql);
  while (stmt.executeStep()) {
    infos[stmt.getInt32(0)] = {
      name:     stmt.getString(1),
      installs: stmt.getInt32(2),
      updated:  stmt.getInt64(3)
    }
  }
  stmt.finalize();
  return infos;
}

gfGreasefireService.prototype._rankMatches =
function gfGreasefireService__rankMatches(matches, infos)
{
  var ranks = [];
  var updatedMin = null;
  var updatedMax = null;
  var installsMin = null;
  var installsMax = null;
  var matchMin = null;
  var matchMax = null;

  for (var id in matches) {
    var info = infos[id];
    var match = matches[id];
    if (updatedMin == null || info.updated < updatedMin) {
      updatedMin = info.updated;
    }
    if (updatedMax == null || info.updated > updatedMax) {
      updatedMax = info.updated;
    }

    if (installsMin == null || info.installs < installsMin) {
      installsMin = info.installs;
    }
    if (installsMax == null || info.installs > installsMax) {
      installsMax = info.installs;
    }

    if (matchMin == null || match < matchMin) {
      matchMin = match;
    }
    if (matchMax == null || match > matchMax) {
      matchMax = match;
    }
  }

  var updatedRange = updatedMax - updatedMin;
  var installsRange = installsMax - installsMin;
  var matchRange = matchMax - matchMin;

  for (var id in matches) {
    var info = infos[id];
    var matchCount = matches[id];

    var updated = updatedRange > 0 ?
                  (info.updated - updatedMin) / updatedRange : 1;
    var installs = installsRange > 0 ?
                   (info.installs - installsMin) / installsRange : 1;
    var match = matchRange > 0 ?
                (matchCount - matchMin) / matchRange : 1;

    ranks[id] = (updated * .5) + (installs * .25) + (match * .25);
  }

  return ranks;
}

// nsIObserver

gfGreasefireService.prototype.observe =
function gfGreasefireService_observe(aSubject, aTopic, aData)
{
  if (aTopic == NS_PROFILE_STARTUP_OBSERVER_ID) {
    this.startup();
  }
  else if (aTopic == NS_PROFILE_SHUTDOWN_OBSERVER_ID) {
    this.shutdown();
    var obs = Cc["@mozilla.org/observer-service;1"]
                .getService(Ci.nsIObserverService);
    obs.removeObserver(this, NS_PROFILE_STARTUP_OBSERVER_ID);
    obs.removeObserver(this, NS_PROFILE_SHUTDOWN_OBSERVER_ID);
  }
}

function gfSearchResult(aScriptId, aInfo, aMatch, aRank)
{
  this._scriptId = aScriptId;
  this._info = aInfo;
  this._match = aMatch;
  this._rank = aRank;
}

gfSearchResult.prototype = {
  get scriptId() {
    return this._scriptId;
  },
  get match() {
    return this._match;
  },
  get name() {
    return this._info.name;
  },
  get installs() {
    return this._info.installs;
  },
  get updated() {
    return this._info.updated;
  },
  get rank() {
    return this._rank;
  }

}

function gfIndexReader(aFile)
{
  this._fis = Cc["@mozilla.org/network/file-input-stream;1"]
                .createInstance(Ci.nsIFileInputStream);
  this._fis.init(aFile, -1, 0, 0);
  var buffer = Cc["@mozilla.org/network/buffered-input-stream;1"]
                 .createInstance(Ci.nsIBufferedInputStream);
  buffer.init(this._fis, 4096);
  this._seekable = buffer.QueryInterface(Ci.nsISeekableStream);

  this._bis = Cc["@mozilla.org/binaryinputstream;1"]
                .createInstance(Ci.nsIBinaryInputStream);
  this._bis.setInputStream(buffer);

  this._cache = [];
}

gfIndexReader.prototype = {

  close: function() {
    this._fis.close();
  },

  search: function(aUrl, aMatches, aFirstOnly, aExcludes) {
    this._search(aUrl, 0, 0, 0, aMatches, aFirstOnly, aExcludes);
  },

  _search: function(aUrl, aIndexPos, aStringPos, aMatchedCount, aMatches, aFirstOnly, aExcludes) {

    var o = this._cache[aIndexPos];
    if (!o) {
      o = {};
      this._cache[aIndexPos] = o;

      this._seekable.seek(Ci.nsISeekableStream.NS_SEEK_SET, aIndexPos);

      var idsLength = this._bis.read64();
      if (idsLength > 0) {
        var ids = [];
        for (var i = 0; i < idsLength; i++) {
          ids.push(this._bis.read64());
        }
        o["ids"] = ids;
      }

      var childrenLength = this._bis.read16();
      for (var i = 0; i < childrenLength; i++) {
        var c = String.fromCharCode(this._bis.read16());
        var pos = this._bis.read64();
        o[c] = pos;
      }
    }

    var ids = o["ids"];
    if (ids) {
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var matchedCount = aMatches[id];
        if (!matchedCount || (matchedCount && aMatchedCount > matchedCount)) {
          if (!aExcludes || (aExcludes && !(id in aExcludes))) {
            aMatches[id] = aMatchedCount;

            if (aFirstOnly) {
              return false;
            }
          }
        }
      }
    }

    var wildPos = o["*"];
    if (wildPos) {
      for (var i = 0; i < aUrl.length; i++) {
        var cont = this._search(aUrl,
                                wildPos,
                                i,
                                aMatchedCount,
                                aMatches,
                                aFirstOnly,
                                aExcludes);

        if(!cont) {
          return false;
        }

      }
    }

    if (aStringPos > aUrl.length - 1) {
      return true;
    }

    var nextPos = o[aUrl.charAt(aStringPos)];
    if (nextPos) {
      var cont = this._search(aUrl,
                              nextPos,
                              aStringPos + 1,
                              aMatchedCount + 1,
                              aMatches,
                              aFirstOnly,
                              aExcludes);

      if(!cont) {
        return false;
      }

    }

    var tldPos = o[" "];
    if (tldPos) {
      // Consume all characters up to /
      var slashPos = aUrl.indexOf("/", aStringPos + 1);
      if (slashPos >= 0) {
        var cont = this._search(aUrl,
                                tldPos,
                                slashPos,
                                aMatchedCount + 1,
                                aMatches,
                                aFirstOnly,
                                aExcludes);

        if(!cont) {
          return false;
        }

      }

    }

    return true;
  }
}

#include ../include/XPCOMUtils.jsm

gfGreasefireService.prototype.QueryInterface =
  XPCOMUtils.generateQI([Ci.gfIGreasefireService,
                         Ci.nsIObserver]);

gfSearchResult.prototype.QueryInterface =
  XPCOMUtils.generateQI([Ci.gfISearchResult]);

var NSGetModule = XPCOMUtils.generateNSGetModule(
  [
    gfGreasefireService
  ],
  function(aCompMgr, aFileSpec, aLocation) {
    XPCOMUtils.categoryManager.addCategoryEntry(
      "app-startup",
      gfGreasefireService.prototype.classDescription,
      "service," + gfGreasefireService.prototype.contractID,
      true,
      true);
  }
);
