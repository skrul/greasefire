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
      40 * 1024 * 1024);

    var stmts = [
      [
        "create table if not exists meta (" +
          "key text primary key on conflict replace, value text)"
      ],
      [
        "create table if not exists scripts (" +
          "id int primary key, name text, installs integer, updated integer)"
      ]
    ];

    var that = this;
    this.executeStatements_(stmts, function(success) {
      if (success) {
        that.readData_(callback);
      } else {
        callback(false);
      }
    });
  }),

  getScriptDetails: wrap(function(ids, callback) {
    var fail = this.makeFailHandler_(callback);
    var timer = new Timer();
    this.db_.readTransaction(function(t) {
      var sql = "select id, name, installs, updated from scripts " +
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
              name: item.name,
              installs: item.installs,
              updated: item.updated
            }
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
    }
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
        var includes_stream = new Stream();
        var excludes_stream = new Stream();

        var version = parseISO8601(values["version"]);
        if (!version) {
          callback(false, "bad version");
          return;
        }
        includes_stream.load(document, values["includes"], function() {
          excludes_stream.load(document, values["excludes"], function() {
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
          });
        });
      } else {
        // No local data.
        callback(true);
      }
    });
  }),

  installNewData: wrap(function(version,
                                includes_stream,
                                excludes_stream,
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
        ["includes", includes_stream.getDataUrl()]
      ],
      [
        "insert into meta (key, value) values (?, ?)",
        ["excludes", excludes_stream.getDataUrl()]
      ]
    ];

    function esc(s) {
      return s.replace(/'/g /*'*/, "''");
    }

    var list = scripts_list.split(/\n/);
    var re = /^(\d+) (\d+) (\d+) (.*)$/;
    // See SQLITE_MAX_COMPOUND_SELECT
    var MAX = 500;
    for (var i = 0; i < list.length; i += MAX) {
      var bulk = [];
      for (var j = i; j < i + MAX && j < list.length; j++) {
        var a = list[j].match(re);
        if (a) {
          bulk.push("select " + a[1] +
                    ", '" + esc(a[4]) +
                    "', " + a[2] +
                    ", " + a[3]);
        }
      }
      stmts.push(["insert into scripts (id, name, installs, updated) " +
                  bulk.join(" union ")]);
    }

    var that = this;
    this.executeStatements_(stmts, function(success, error) {
      if (success) {
        that.includes_ = new IndexReader(includes_stream);
        that.excludes_ = new IndexReader(excludes_stream);
        that.current_version_ = version;
        that.script_count_ = list.length;
        callback(true);
      } else {
        callback(success, error);
      }
    });
  }),

  executeStatements_: wrap(function(stmts, callback) {
    var fail = this.makeFailHandler_(callback);
    var run_text_statement = function(t) {
      chrome.extension.sendRequest({action: "updater-progress",
                                    loaded: stmts.length});
      if (stmts.length > 0) {
        var pair = stmts.shift();
        t.executeSql(pair[0], pair[1], run_text_statement, fail);
      } else {
        callback(true);
      }
    }

    this.db_.transaction(run_text_statement);
  })
}
