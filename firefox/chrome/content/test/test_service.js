/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");

function runTest() {

  var urls = [
/*
    "http://reddit.com/",
    "http://slashdot.org/",
    "http://nytimes.com/",
    "http://www.cnn.com/blah",
    "http://google.com",
    "http://www.google.com",
    "http://myspace.com",
    "http://facebook.com"
*/
    "http://www.mozilla.org"
  ];

  var gfs = Cc["@skrul.com/greasefire/service;1"]
              .getService(Ci.gfIGreasefireService);

  for (var i = 0; i < urls.length; i++) {

    var uri = Services.io.newURI(urls[i], null, null);

    var t = Date.now();
    var hasScripts = gfs.hasScripts(uri);
    var d = Date.now() - t;

    log("--> " + urls[i] + " hasScripts " + d + "ms");

    t = Date.now();
    var results = gfs.search(uri);
    d = Date.now() - t;

    log("--> " + urls[i] + " matches " + results.length + " " + d + "ms");

    for (var j = 0; j < results.length; j++) {
      var r = results.queryElementAt(j, Ci.gfISearchResult);
      log("-------> " + r.scriptId + " " + r.match + " " + r.rank);
    }

  }

  return true;
}
