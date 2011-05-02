/*
 * Copyright (C) 2008 by Steve Krulewitz <skrulx@gmail.com>
 * Licensed under GPLv2 or later, see file LICENSE in the xpi for details.
 */
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

var bis;
var seekable;
var cache = [];

function runTest() {

  var method = 2;

  var urls = [
    "http://reddit.com/",
    "http://slashdot.org/",
    "http://nytimes.com/",
    "http://www.cnn.com/blah",
    "http://google.com",
    "http://www.google.com",
    "http://myspace.com",
    "http://facebook.com"
  ];
  var o = {};

  var t = Date.now();

  if (method == 1 || method == 2) {
    var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
    file.initWithPath("/home/steve/dev/greasefire/index.dat");

    var fis = Cc["@mozilla.org/network/file-input-stream;1"]
    .createInstance(Ci.nsIFileInputStream);
    fis.init(file, -1, 0, 0);
    var buffer = Cc["@mozilla.org/network/buffered-input-stream;1"]
    .createInstance(Ci.nsIBufferedInputStream);
    buffer.init(fis, 4096);

    bis = Cc["@mozilla.org/binaryinputstream;1"]
    .createInstance(Ci.nsIBinaryInputStream);
    bis.setInputStream(buffer);

    //  var junk = [];
    //  bis.readByteArray(file.fileSize, junk, {});

    seekable = buffer.QueryInterface(Ci.nsISeekableStream);
  }
  else {
    var loader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
    .getService(Ci.mozIJSSubScriptLoader);
    loader.loadSubScript("file:///home/steve/dev/greasefire/index.json", o);
  }

  var d = Date.now() - t;
  log("startup " + d + "ms");

  for (var i = 0; i < urls.length; i++) {
    var matches = [];
    var t = Date.now();
    switch (method) {
    case 1: find1(urls[i], 0, 0, matches); break
    case 2: find2(urls[i], 0, 0, matches); break;
    case 3: find3(o.data, urls[i], 0, matches); break;

    }
    var d = Date.now() - t;

    var m = {};
    var count = 0;
    for (var j = 0; j < matches.length; j++) {
      if (!(matches[j] in m)) {
        count++;
        m[matches[j]] = 1;
      }
    }

    log("--> " + urls[i] + " matches " + count + " " + d + "ms");
  }

  return true;
}

function find1(url, indexPos, stringPos, matches) {

  seekable.seek(Ci.nsISeekableStream.NS_SEEK_SET, indexPos);

  var idsLength = bis.read64();
  for (var i = 0; i < idsLength; i++) {
    matches.push(bis.read64());
  }

  if (stringPos > url.length - 1) {
    return;
  }

  var childrenLength = bis.read16();
  for (var i = 0; i < childrenLength; i++) {
    var c = String.fromCharCode(bis.read16());
    var pos = bis.read64();
    if (c == "*") {
      for (var j = stringPos; j < url.length; j++) {
        var tell = seekable.tell();
        find1(url, pos, j, matches);
        seekable.seek(Ci.nsISeekableStream.NS_SEEK_SET, tell);
      }
    }
    else if (url.charAt(stringPos) == c) {
      var tell = seekable.tell();
      find1(url, pos, stringPos + 1, matches);
      seekable.seek(Ci.nsISeekableStream.NS_SEEK_SET, tell);
    }
  }
}

function find2(url, indexPos, stringPos, matches) {

  var o = cache[indexPos];
  if (!o) {
    o = {};
    cache[indexPos] = o;

    seekable.seek(Ci.nsISeekableStream.NS_SEEK_SET, indexPos);

    var idsLength = bis.read64();
    if (idsLength > 0) {
      var ids = [];
      for (var i = 0; i < idsLength; i++) {
        ids.push(bis.read64());
      }
      o[" "] = ids;
    }

    var childrenLength = bis.read16();
    for (var i = 0; i < childrenLength; i++) {
      var c = String.fromCharCode(bis.read16());
      var pos = bis.read64();
      o[c] = pos;
    }
  }

  var ids = o[" "];
  if (ids) {
    for (var i = 0; i < ids.length; i++) {
      matches.push(ids[i]);
    }
  }

  if (stringPos > url.length - 1) {
    return;
  }

  var nextPos = o[url.charAt(stringPos)];
  if (nextPos) {
    find2(url, nextPos, stringPos + 1, matches);
  }

  var wildPos = o["*"];
  if (wildPos) {
    for (var i = 0; i < url.length; i++) {
      find2(url, wildPos, i, matches);
    }
  }

}

function find3(data, url, stringPos, matches) {

  var ids = data[" "];
  if (ids) {
    for (var i = 0; i < ids.length; i++) {
      matches.push(ids[i]);
    }
  }

  if (stringPos > url.length - 1) {
    return;
  }

  var next = data[url.charAt(stringPos)];
  if (next) {
    find3(next, url, stringPos + 1, matches);
  }

  var wild = data["*"];
  if (wild) {
    for (var i = 0; i < url.length; i++) {
      find3(wild, url, i, matches);
    }
  }

}
