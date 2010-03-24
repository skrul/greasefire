function Store() {
  this.db_ = null;
  this.includes_ = new IndexReader(new Stream());
  this.excludes_ = new IndexReader(new Stream());
  this.current_version_ = null;
  this.script_count_ = 0;
}

Store.prototype = {
  includes: function() {
    return this.includes_;
  },

  excludes: function() {
    return this.excludes_;
  },

  current_version: function() {
    return this.current_version_;
  },

  script_count: function() {
    return this.script_count_;
  },

  init: wrap(function(callback) {
    d("Store.init");
    this.db_ = openDatabase(
      "greasefire",
      "",
      "greasefire",
      10 * 1024 * 1024);

    var stmts = [
      [
        "create table if not exists meta (" +
          "key text primary key on conflict replace, value text)"
      ],
      [
        "create table if not exists scripts (" +
          "id int primary key, " +
          "installs integer, " +
          "updated integer, " +
          "fans integer, " +
          "posts integer, " +
          "reviews integer, " +
          "average_reviews integer, " +
          "name text, " +
          "description text)"
      ]
    ];

    var that = this;
    this.executeStatements_(
      stmts,
      function(total, current) {
        chrome.extension.sendRequest({
          action: "updater-status",
          message: "Loading schema... (" + current + " of " + total + ")"});
      },
      function(success, e) {
        if (!success) {
          callback(false, e);
          return;
        }
        that.readData_(callback);
      });
  }),

  reset: wrap(function(callback) {
    console.log("store reset");
    var stmts = [
      ["drop table if exists meta"],
      ["drop table if exists scripts"]
    ];
    this.executeStatements_(
      stmts,
      function(total, current) {
        chrome.extension.sendRequest({
          action: "updater-status",
          message: "Deleting data... (" + current + " of " + total + ")"});
      },
      callback);
  }),

  getScriptDetails: wrap(function(ids, callback) {
    var fail = this.makeFailHandler_(callback);
    var timer = new Timer();
    this.db_.readTransaction(function(t) {
      var sql = "select id, installs, updated, fans, posts, reviews, " +
                "average_reviews, name, description from scripts " +
                "where id in (" + ids.join(",") + ")";
      timer.mark(sql);
      t.executeSql(
        sql,
        [],
        function(t1, r) {
          var results = {};
          for (var i = 0; i < r.rows.length; i++) {
            var item = r.rows.item(i);
            results[item.id + ""] = {
              installs: item.installs,
              updated: item.updated,
              fans: item.fans,
              posts: item.posts,
              reviews: item.reviews,
              average_reviews: item.average_reviews,
              name: item.name,
              description: item.description
            };
          }
          timer.mark("query complete, rows = " + r.rows.length);
          callback(true, results);
        },
        fail);
    });
  }),

  makeFailHandler_: function(callback) {
    return function(t, e) {
      console.log(e);
      callback(false, e);
    };
  },

  getMetaValues_: wrap(function(keys, callback) {
    var fail = this.makeFailHandler_(callback);
    var w = new Wrapper(this, callback);
    this.db_.readTransaction(function(t) {
      var list = "'" + keys.join("','") + "'";
      var sql = "select key, value from meta where key in (" + list + ")";
      t.executeSql(sql, null, w.wrap(function(t1, r) {
        var values = {};
        for (var i = 0; i < r.rows.length; i++) {
          values[r.rows.item(i).key] = r.rows.item(i).value;
        }
        callback(true, values);
      }), fail);
    });
  }),

  getScriptCount_: wrap(function(callback) {
    var fail = this.makeFailHandler_(callback);
    var w = new Wrapper(this, callback);
    this.db_.readTransaction(function(t) {
      var sql = "select count(1) as c from scripts";
      t.executeSql(sql, null, w.wrap(function(t1, r) {
        callback(true, r.rows.item(0).c);
      }), fail);
    });
  }),

  readData_: wrap(function(callback) {
    var timer = new Timer();
    var that = this;
    var keys = ["version", "includes", "excludes"];
    this.getMetaValues_(keys, function(success, values) {
      if ("version" in values &&
          "includes" in values &&
          "excludes" in values) {
        var version = parseISO8601(values["version"]);
        if (!version) {
          callback(false, "bad version");
          return;
        }

        var includes_stream = new BinaryStream(atob(values["includes"]));
        var excludes_stream = new BinaryStream(atob(values["excludes"]));
        that.includes_ = new IndexReader(includes_stream);
        that.excludes_ = new IndexReader(excludes_stream);
        that.current_version_ = version;
        that.getScriptCount_(function(success, count) {
          if (!success) {
            callback(false, count);
            return;
          }
          that.script_count_ = count;
          timer.mark("after stream");
          callback(true);
        });
      } else {
        // No local data.
        callback(true);
      }
    });
  }),

  installNewData: wrap(function(version,
                                includes_data,
                                excludes_data,
                                scripts_list,
                                callback) {
    var stmts = [
      [
        "delete from scripts"
      ],
      [
        "insert into meta (key, value) values (?, ?)",
        ["version", formatISO8601(version)]
      ],
      [
        "insert into meta (key, value) values (?, ?)",
        ["includes", btoa(includes_data)]
      ],
      [
        "insert into meta (key, value) values (?, ?)",
        ["excludes", btoa(excludes_data)]
      ]
    ];

    // de-url encode and sql escape
    function recode(s) {
      s = unescape(s.replace(/\+/g, " "));
      return s.replace(/'/g /*'*/, "''");
    }

    var list = scripts_list.split(/\n/);
    // See SQLITE_MAX_COMPOUND_SELECT
    var MAX = 500;
    for (var i = 0; i < list.length; i += MAX) {
      var bulk = [];
      for (var j = i; j < i + MAX && j < list.length; j++) {
        // id & installs & updated & fans & posts & reviews &
        // averageReviews & name & description
        var a = list[j].split("&");
        if (a.length == 9) {
          bulk.push("select " +
                    a[0] + "," +  // id
                    a[1] + "," +  // installs
                    a[2] + "," +  // updated
                    a[3] + "," +  // fans
                    a[4] + "," +  // posts
                    a[5] + "," +  // reviews
                    a[6] + "," +  // averageReviews
                    "'" + recode(a[7]) + "', " +  // name
                    "'" + recode(a[8]) + "'");  // description
       }
      }
      stmts.push(["insert into scripts (" +
                  "id, installs, updated, fans, posts, " +
                  "reviews, average_reviews, name, description) " +
                  bulk.join(" union ")]);
    }

    var that = this;
    this.executeStatements_(
      stmts,
      function(total, current) {
        chrome.extension.sendRequest({
          action: "updater-status",
          message: "Applying updates... (" + current + " of " + total + ")"});
      },
      function(success, error) {
        if (!success) {
          callback(false, error);
          return;
        }

        that.includes_ = new IndexReader(new BinaryStream(includes_data));
        that.excludes_ = new IndexReader(new BinaryStream(excludes_data));
        that.current_version_ = version;
        that.script_count_ = list.length;
        callback(true);
      });
  }),

  executeStatements_: wrap(function(stmts, progress, callback) {
    var fail = this.makeFailHandler_(callback);
    var total = stmts.length;

    var run_next_statement = function(t) {
      if (stmts.length > 0) {
        if (progress) {
          progress(total, stmts.length);
        }
        var pair = stmts.shift();
        t.executeSql(pair[0], pair[1], run_next_statement, fail);
      } else {
        callback(true);
      }
    };

    this.db_.transaction(run_next_statement);
  })
}
