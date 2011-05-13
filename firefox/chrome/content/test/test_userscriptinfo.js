const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");

function runTest() {

  var usis = Cc["@skrul.com/greasefire/userscript-info-service;1"]
               .getService(Ci.gfIUserScriptInfoService);

  var obs = {
    observe: function(subject, topic, data) {
      var info = subject.QueryInterface(Ci.gfIUserScriptInfo);
      log("id " + info.scriptId);
      log("name " + info.name);
      log("description " + info.description);
    }
  }

  usis.request(13269, obs);
  usis.request(24556, obs);

  Services.ww.openWindow(null,
                         "chrome://greasefire/content/results.xul",
                         "_blank",
                         "chrome,all,dialog=no",
                         null);
}
