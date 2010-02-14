function IndexReader(stream) {
  this.stream_ = stream;
  this.cache_ = [];
}

IndexReader.prototype = {
  search: function(aUrl, aMatches, aFirstOnly, aExcludes) {
    this.search_(aUrl, 0, 0, 0, aMatches, aFirstOnly, aExcludes, 0);
  },

  search_: function(aUrl, aIndexPos, aStringPos, aMatchedCount, aMatches,
                    aFirstOnly, aExcludes, aDepth) {
    if (aDepth > 100)
      return false;

    var o = this.cache_[aIndexPos];
    if (!o) {
      o = {};
      this.cache_[aIndexPos] = o;

      this.stream_.seek(aIndexPos);

      var idsLength = this.stream_.read64();
      console.log(idsLength);
      if (idsLength > 0) {
        var ids = [];
        for (var i = 0; i < idsLength; i++) {
          ids.push(this.stream_.read64());
        }
        o["ids"] = ids;
      }

      var childrenLength = this.stream_.read16();
      console.log(childrenLength);
      for (var i = 0; i < childrenLength; i++) {
        var c = String.fromCharCode(this.stream_.read16());
        var pos = this.stream_.read64();
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
        var cont = this.search_(aUrl,
                                wildPos,
                                i,
                                aMatchedCount,
                                aMatches,
                                aFirstOnly,
                                aExcludes,
                                aDepth + 1);

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
      var cont = this.search_(aUrl,
                              nextPos,
                              aStringPos + 1,
                              aMatchedCount + 1,
                              aMatches,
                              aFirstOnly,
                              aExcludes,
                              aDepth + 1);

      if(!cont) {
        return false;
      }

    }

    var tldPos = o[" "];
    if (tldPos) {
      // Consume all characters up to /
      var slashPos = aUrl.indexOf("/", aStringPos + 1);
      if (slashPos >= 0) {
        var cont = this.search_(aUrl,
                                tldPos,
                                slashPos,
                                aMatchedCount + 1,
                                aMatches,
                                aFirstOnly,
                                aExcludes,
                                aDepth + 1);

        if(!cont) {
          return false;
        }

      }

    }

    return true;
  }
}
