function Store() {
  this.db_ = null;
  this.includes_ = null;
  this.excludes_ = null;
  this.current_version_ = null;
}

Store.prototype = {
  includes: function() {
    return this.includes_;
  },

  excludes: function() {
    return this.excludes_;
  },

  init: function(callback) {
    this.db_ = openDatabase(
      "greasefire",
      "1",
      "greasefire",
      40 * 1024 * 1024);

    var fail = this.makeFailHandler_(callback);

    var stmts = [
      [
        "create table if not exists meta (" +
          "key text primary key on conflict replace, value text)"
      ],
      [
        "create table if not exists indexes (" +
          "version text primary key on conflict replace, includes text, excludes text)"
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
  },

  getScriptDetails: function(ids, callback) {
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
  },

  makeFailHandler_: function(callback) {
    return function(t, e) {
      console.log(e);
      callback(false, e);
    }
  },

  readData_: function(callback) {
    var timer = new Timer();

    var fail = this.makeFailHandler_(callback);

    var w = new Wrapper(this, callback);

    var get_version = w.wrap(function(t) {
      t.executeSql(
        "select value from meta where key = ?",
        ["current_version"],
        w.wrap(function(t1, r) {
          timer.mark("after get version query");
          if (r.rows.length > 0) {
            this.current_version_ = r.rows.item(0).value;
            get_indexes(t1);
          } else {
            // todo: start update
            callback(true);
          }
        }),
        fail);
    });

    var get_indexes = w.wrap(function(t) {
      t.executeSql(
        "select includes, excludes from indexes where version = ?",
        [this.current_version_],
        w.wrap(function(t1, r) {
          timer.mark("after get indexes query");
          if (r.rows.length > 0) {
            var includes_url = r.rows.item(0).includes;
            var excludes_url = r.rows.item(0).excludes;
            timer.mark("after read, " + (includes_url.length +
                                         excludes_url.length) + " bytes");
            var that = this;
            var includes_stream = new Stream();
            var excludes_stream = new Stream();

            includes_stream.load(document, includes_url, function() {
              excludes_stream.load(document, excludes_url, function() {
                that.includes_ = new IndexReader(includes_stream);
                that.excludes_ = new IndexReader(excludes_stream);
                timer.mark("after stream");
                callback(true);
              });
            });
          } else {
            this.current_version_ = null;
            // todo: start update
            callback(true);
          }
        }),
        fail);
    });

    this.db_.readTransaction(get_version);
  },

  installNewData: function(version,
                           includes_stream,
                           excludes_stream,
                           scripts_list,
                           callback) {
    var stmts = [
      [
        "delete from indexes"
      ],
      [
        "delete from scripts"
      ],
      [
        "insert into indexes (version, includes, excludes) values (?, ?, ?)",
        [version,
         includes_stream.getDataUrl(),
         excludes_stream.getDataUrl()]
      ],
      [
        "insert into meta (key, value) values (?, ?)",
        ["current_version", version]
      ]
    ];

    function esc(s) {
      return s.replace(/'/g, "''"); // '
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
        callback(true);
      } else {
        callback(success, error);
      }
    });
  },

  executeStatements_: function(stmts, callback) {
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
  }
}
