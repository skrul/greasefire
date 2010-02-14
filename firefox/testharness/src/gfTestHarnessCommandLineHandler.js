/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

function d(s) {
  dump("gfTestHarnessCommandLineHandler: " + s + "\n");
}

function gfTestHarnessRunEnvironment() {
}

gfTestHarnessRunEnvironment.prototype.log =
function gfTestHarnessRunEnvironment_log(s)
{
  dump("[log] " + s + "\n");
}

gfTestHarnessRunEnvironment.prototype.newURI =
function gfTestHarnessRunEnvironment_newURI(aSpec)
{
  var ios = Components.classes["@mozilla.org/network/io-service;1"]
                      .getService(Components.interfaces.nsIIOService);
  return ios.newURI(aSpec, null, null);
}

gfTestHarnessRunEnvironment.prototype.assertEqual =
function gfTestHarnessRunEnvironment_assertEqual(a, b)
{
  if (a != b) {
    this.error("Values are not equal, '" + a + "' != '" + b + "'");
  }
}

gfTestHarnessRunEnvironment.prototype.assertTrue =
function gfTestHarnessRunEnvironment_assertTrue(a)
{
  if (!a) {
    this.error("Value is not true");
  }
}

gfTestHarnessRunEnvironment.prototype.error =
function gfTestHarnessRunEnvironment_error(aMessage)
{
  this.log("ERROR: " + aMessage);
  var stack = Components.stack;
  while (stack) {
    this.log("  " + stack);
    stack = stack.caller;
  }
  throw Cr.NS_ERROR_ILLEGAL_VALUE;
}

function gfTestHarnessCommandLineHandler()
{
}

gfTestHarnessCommandLineHandler.prototype = {
  classDescription: "Test Harness Command Line Handler",
  classID:           Components.ID("{0c1b14b2-4a2c-4ba4-bf38-0f6844439986}"),
  contractID:        "@skrul.com/greasefire/testharness/commandlinehandler;1"
}

gfTestHarnessCommandLineHandler.prototype.handle =
function gfTestHarnessCommandLineHandler_handle(aCommandLine)
{
  var testPath;
  try {
    testPath = aCommandLine.handleFlagWithParam("test", true);
  }
  catch(e) {
  }

  if (testPath) {
    aCommandLine.preventDefault = true;
    var shouldQuit = this._runTest(testPath);
    if (shouldQuit) {
      aCommandLine.preventDefault = true;
    }
    else {
//      var appStartup = Cc["@mozilla.org/toolkit/app-startup;1"]
//                         .getService(Ci.nsIAppStartup);
//      appStartup.run();
    }
  }
}

gfTestHarnessCommandLineHandler.prototype._runTest =
function gfTestHarnessCommandLineHandler__runTest(aPath)
{
  var consoleService = Cc["@mozilla.org/consoleservice;1"]
                         .getService(Ci.nsIConsoleService);
  var consoleListener = Cc["@skrul.com/greasefire/testharness/consolelistener;1"]
                          .createInstance(Ci.nsIConsoleListener);
  consoleService.registerListener(consoleListener);

  var loader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
                 .getService(Ci.mozIJSSubScriptLoader);

  var o = new gfTestHarnessRunEnvironment();
  var shouldQuit = true;

  var url = "chrome://greasefire/content/test/" + aPath;
  consoleService.logStringMessage("Running test at '" + url + "'");

  try {
    loader.loadSubScript(url, o);
    shouldQuit = !o.runTest();
    consoleService.logStringMessage("PASSED");
  }
  catch(e) {
    consoleService.logStringMessage("FAILED");
    Components.utils.reportError(e);
    var stack = e.location;
    while (stack) {
      dump("  " + stack + "\n");
      stack = stack.caller;
    }
  }

  return shouldQuit;
}

gfTestHarnessCommandLineHandler.prototype.__defineGetter__("helpinfo",
function gfTestHarnessCommandLineHandler_helpinfo()
{
  return "Halp!";
});

function gfTestHarnessConsoleListener()
{
}

gfTestHarnessConsoleListener.prototype = {
  classDescription: "Test Harness Console Listener",
  classID:           Components.ID("{52b17aee-2705-42e0-bf2d-92afb900c4c8}"),
  contractID:        "@skrul.com/greasefire/testharness/consolelistener;1",
  observe: function(aMessage) {
    dump("[console] " + aMessage.message + "\n");
  }
}

function HEX(n) {
  var s = n.toString(16);
  if (s.length == 1) {
    s = "0" + s;
  }
  return s;
}

#include ../../include/XPCOMUtils.jsm

gfTestHarnessCommandLineHandler.prototype.QueryInterface =
  XPCOMUtils.generateQI([Ci.nsICommandLineHandler]);

gfTestHarnessConsoleListener.prototype.QueryInterface =
  XPCOMUtils.generateQI([Ci.nsIConsoleListener]);

var NSGetModule = XPCOMUtils.generateNSGetModule(
  [
    gfTestHarnessCommandLineHandler,
    gfTestHarnessConsoleListener
  ],
  function(aCompMgr, aFileSpec, aLocation) {
    XPCOMUtils.categoryManager.addCategoryEntry(
      "command-line-handler",
      "a-testhaness",
      gfTestHarnessCommandLineHandler.prototype.contractID,
      true,
      true);
  }
);

