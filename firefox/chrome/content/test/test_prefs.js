/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const {utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");

function runTest() {
  Services.ww.openWindow(null,
                         "chrome://greasefire/content/prefs.xul",
                         "_blank",
                         "chrome,all,dialog,modal,centerscreen",
                         null);

  return true;
}

