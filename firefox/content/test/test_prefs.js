/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

function runTest() {

  const ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
               .getService(Ci.nsIWindowWatcher);

  ww.openWindow(null,
                "chrome://greasefire/content/prefs.xul",
                "_blank",
                "chrome,all,dialog,modal,centerscreen",
                null);

  return true;
}

