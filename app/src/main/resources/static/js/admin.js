(function () {
  'use strict';
  var app = angular.module('regexam');

  // YYYY-MM-DD <-> local Date, for <input type="date"> which needs Date models in AngularJS.
  function toDate(iso) {
    if (!iso) return null;
    var p = String(iso).slice(0, 10).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function fromDate(d) {
    if (!d) return null;
    function z(n) { return ('0' + n).slice(-2); }
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
  }

  app.controller('OverviewCtrl', function ($q, Api, Loader, Toast) {
    var vm = this;
    vm.d = Loader(function () {
      return $q.all([Api.get('/api/admin/subscriptions'), Api.get('/api/admin/tickets'), Api.get('/api/admin/matrix'),
        Api.get('/api/admin/invites'), Api.get('/api/admin/users')]).then(function (r) {
        var subs = r[0], tickets = r[1], matrix = r[2], invites = r[3], users = r[4];
        var active = subs.filter(function (s) { return s.status === 'ACTIVE'; });
        var complete = matrix.filter(function (m) { return m.status === 'COMPLETE'; }).length;
        return {
          students: users.filter(function (u) { return u.role === 'STUDENT'; }).length,
          active: active.length,
          pending: subs.filter(function (s) { return s.status === 'PENDING'; }),
          expiring: active.filter(function (s) { return s.expiringSoon; }),
          openTickets: tickets.filter(function (t) { return t.status === 'OPEN'; }),
          topics: matrix.length,
          complete: complete,
          completePct: matrix.length ? Math.round(complete * 100 / matrix.length) : 0,
          gaps: matrix.filter(function (m) { return m.status !== 'COMPLETE'; }),
          unusedInvites: invites.filter(function (i) { return i.status === 'ACTIVE'; }).length
        };
      });
    });
    vm.approve = function (id) {
      Api.post('/api/admin/subscriptions/' + id + '/approve').then(function () {
        Toast.show('Payment approved', 'success');
        vm.d.reload();
      }, function (e) { Toast.show(e.message, 'error'); });
    };
  });

  app.controller('CandidatesCtrl', function ($scope, Api, Loader, Toast) {
    var vm = this;
    vm.tab = 'roster';
    vm.tabs = [{ value: 'roster', label: 'Candidate roster' }, { value: 'tickets', label: 'Support desk' }];

    // --- roster ---
    vm.status = '';
    vm.q = '';
    vm.open = null;
    vm.until = null;
    vm.statusOpts = [];
    vm.all = Loader(function () {
      return Api.get('/api/admin/subscriptions').then(function (list) {
        function n(f) { return list.filter(f).length; }
        vm.statusOpts = [
          { value: '', label: 'All', count: list.length },
          { value: 'ACTIVE', label: 'Active', count: n(function (s) { return s.status === 'ACTIVE'; }) },
          { value: 'PENDING', label: 'Pending approval', count: n(function (s) { return s.status === 'PENDING'; }) },
          { value: 'INACTIVE', label: 'Inactive', count: n(function (s) { return ['ACTIVE', 'PENDING'].indexOf(s.status) < 0; }) }];
        return list;
      });
    });
    vm.rows = Loader(function () { return Api.get('/api/admin/subscriptions?status=' + vm.status + '&q=' + encodeURIComponent(vm.q)); });
    $scope.$watchGroup(['vm.status', 'vm.q'], function (n, o) { if (n !== o) vm.rows.reload(); });

    vm.act = function (id, action, body) {
      Api.post('/api/admin/subscriptions/' + id + '/' + action, body).then(function (r) {
        vm.open = r;
        Toast.show('Updated', 'success');
        vm.rows.reload();
        vm.all.reload();
      }, function (e) { Toast.show(e.message, 'error'); });
    };
    vm.setUntil = function () { vm.act(vm.open.id, 'extend', { until: fromDate(vm.until) }); };
    vm.inactive = function (s) { return ['ACTIVE', 'FROZEN', 'EXPIRED'].indexOf(s) >= 0; };

    // --- support desk ---
    vm.tStatus = 'OPEN';
    vm.tOpts = [{ value: 'OPEN', label: 'Open' }, { value: 'RESOLVED', label: 'Resolved' }, { value: 'REJECTED', label: 'Rejected' }];
    vm.sel = null;
    vm.reply = '';
    vm.tickets = Loader(function () { return Api.get('/api/admin/tickets?status=' + vm.tStatus); });
    vm.setTStatus = function (v) { vm.tStatus = v; vm.tickets.reload(); };
    vm.pick = function (t) { vm.sel = t; vm.reply = t.adminReply || ''; };
    vm.respond = function (decision) {
      Api.put('/api/admin/tickets/' + vm.sel.id, { reply: vm.reply, status: decision }).then(function () {
        Toast.show('Reply sent', 'success');
        vm.sel = null;
        vm.reply = '';
        vm.tickets.reload();
      }, function (e) { Toast.show(e.message, 'error'); });
    };
  });

  app.controller('InvitesCtrl', function (Api, Loader, Toast) {
    var vm = this;
    vm.list = Loader(function () { return Api.get('/api/admin/invites'); });
    vm.count = function (status) { return vm.list.data.filter(function (c) { return c.status === status; }).length; };
    vm.generate = function () {
      Api.post('/api/admin/invites').then(function (c) {
        Toast.show('Code ' + c.code + ' created', 'success');
        vm.list.reload();
      }, function (e) { Toast.show(e.message, 'error'); });
    };
    vm.share = function (c) {
      navigator.clipboard.writeText(c.shareMessage).then(function () { Toast.show('Invitation message copied', 'success'); },
        function () { Toast.show('Could not copy. Message: ' + c.shareMessage, 'error'); });
    };
  });

  app.controller('ContentCtrl', function ($q, $timeout, Api, Curriculum, Loader, Toast, Util) {
    var vm = this;
    vm.tab = 'matrix';
    vm.tabs = [{ value: 'matrix', label: 'Master grid' }, { value: 'ingest', label: 'Ingest content' }];
    vm.filter = 'ALL';
    vm.filterOpts = [];
    vm.matrix = Loader(function () {
      return Api.get('/api/admin/matrix').then(function (rows) {
        function n(f) { return rows.filter(f).length; }
        vm.filterOpts = [
          { value: 'ALL', label: 'All', count: rows.length },
          { value: 'COMPLETE', label: 'Complete', count: n(function (r) { return r.status === 'COMPLETE'; }) },
          { value: 'GAPS', label: 'Needs content', count: n(function (r) { return r.status !== 'COMPLETE'; }) }];
        return rows;
      });
    });
    vm.shown = function () {
      return vm.matrix.data.filter(function (r) {
        return vm.filter === 'ALL' || (vm.filter === 'COMPLETE' ? r.status === 'COMPLETE' : r.status !== 'COMPLETE');
      });
    };
    vm.papers = [];
    vm.cur = Loader(function () {
      return Curriculum.load().then(function (c) {
        vm.papers = [];
        c.forEach(function (e) { e.papers.forEach(function (p) { vm.papers.push({ id: p.id, label: e.name + ' · ' + p.name }); }); });
        return c;
      });
    });

    // --- add topic ---
    vm.adding = false;
    vm.form = { paperId: '', title: '', tier: 1, weightage: 10, chapterTitles: '' };
    vm.saveTopic = function () {
      var f = vm.form;
      Api.post('/api/admin/topics', {
        paperId: f.paperId, title: f.title, tier: Number(f.tier), weightage: Number(f.weightage),
        chapterTitles: f.chapterTitles.split('\n').map(function (s) { return s.trim(); }).filter(Boolean)
      }).then(function () {
        Toast.show('Topic created', 'success');
        vm.adding = false;
        vm.matrix.reload();
        vm.cur.reload();
      }, function (e) { Toast.show(e.message, 'error'); });
    };

    // --- ingestion ---
    vm.sel = {};
    vm.bookText = '';
    vm.mcqText = '';
    vm.report = null;
    vm.dictReport = null;
    vm.dict = { word: '', definition: '', translation: '', legalContext: '' };
    vm.sample = 'Question,Option A,Option B,Option C,Option D,Correct Answer,Explanation,Paragraph Citation';
    function fail(e) { Toast.show(e.message, 'error'); }

    vm.publishBook = function () {
      Api.put('/api/admin/topics/' + vm.sel.topic.id + '/book', { text: vm.bookText }).then(function () {
        Toast.show('Book published', 'success');
        vm.bookText = '';
        vm.matrix.reload();
      }, fail);
    };
    // Format check: the server reads the text exactly as the import would, without saving, and reports how.
    vm.mcqFile = '';
    vm.check = null;
    vm.checkError = null;
    vm.checking = false;
    var checkTimer;
    function runCheck() {
      var text = vm.mcqText;
      vm.checking = true;
      Api.post('/api/admin/mcqs/check', { text: text }).then(function (c) {
        if (text === vm.mcqText) { vm.check = c; vm.checkError = null; }
      }, function (e) {
        if (text === vm.mcqText) { vm.check = null; vm.checkError = e.message; }
      }).finally(function () { vm.checking = false; });
    }
    vm.checkMcqs = function (now) {
      $timeout.cancel(checkTimer);
      if (!vm.mcqText.trim()) { vm.check = null; vm.checkError = null; vm.mcqFile = ''; return; }
      checkTimer = $timeout(runCheck, now ? 0 : 500);
    };
    vm.setMcqs = function (text, name) { vm.mcqText = text; vm.mcqFile = name || ''; vm.checkMcqs(true); };
    vm.canUpload = function () {
      return !!(vm.sel.topic && vm.check && vm.check.valid > 0 && !vm.checking && !vm.checkError);
    };
    vm.answerText = function (p) { return p['option' + p.correct]; };

    vm.uploadMcqs = function (mode) {
      Api.post('/api/admin/topics/' + vm.sel.topic.id + '/mcqs?mode=' + mode, { text: vm.mcqText }).then(function (r) {
        vm.report = r;
        Toast.show(r.added + ' question(s) saved', r.added ? 'success' : 'error');
        if (r.added) { vm.mcqText = ''; vm.mcqFile = ''; vm.check = null; vm.matrix.reload(); }
      }, fail);
    };
    vm.dictFile = function (text) {
      var body;
      try { body = JSON.parse(text); } catch (e) { return Toast.show('That file is not valid JSON', 'error'); }
      Api.post('/api/admin/dictionary', body).then(function (r) {
        vm.dictReport = r;
        Toast.show(r.added + ' added, ' + r.skipped + ' duplicates skipped', 'success');
      }, fail);
    };
    vm.addWord = function () {
      Api.post('/api/admin/dictionary', [vm.dict]).then(function (r) {
        Toast.show(r.added ? 'Word added' : 'Word already exists, skipped', r.added ? 'success' : 'error');
        vm.dict = { word: '', definition: '', translation: '', legalContext: '' };
      }, fail);
    };
  });

  app.controller('McqEditorCtrl', function ($q, Api, Curriculum, Loader) {
    var vm = this;
    vm.sel = {};
    vm.cur = Loader(function () { return Curriculum.load(); });
    vm.list = Loader(function () {
      return vm.sel.topic ? Api.get('/api/admin/mcqs?topicId=' + vm.sel.topic.id) : $q.when([]);
    });
    vm.pick = function (sel) {
      var changed = (sel.topic && sel.topic.id) !== (vm.sel.topic && vm.sel.topic.id);
      vm.sel = sel;
      if (changed) vm.list.reload();
    };
  });

  app.controller('VaultCtrl', function (Api, Toast, Util) {
    var vm = this;
    vm.busy = false;
    vm.pending = null;
    vm.backup = function () {
      vm.busy = true;
      Api.get('/api/admin/backup').then(function (data) {
        Util.downloadJson('content-backup-' + new Date().toISOString().slice(0, 10) + '.json', data);
        Toast.show('Backup downloaded (' + data.mcqs.length + ' questions, ' + data.books.length + ' books)', 'success');
      }, function (e) { Toast.show(e.message, 'error'); }).finally(function () { vm.busy = false; });
    };
    vm.pick = function (text) {
      try { vm.pending = JSON.parse(text); } catch (e) { Toast.show('That file is not a valid backup', 'error'); }
    };
    vm.count = function (k) { return vm.pending && vm.pending[k] ? vm.pending[k].length : 0; };
    vm.restore = function () {
      Api.post('/api/admin/restore', vm.pending).then(function () {
        Toast.show('Content restored', 'success');
        vm.pending = null;
      }, function (e) { Toast.show(e.message, 'error'); });
    };
  });

  app.controller('ExamsPlansCtrl', function (Api, Curriculum, Loader, Toast) {
    var vm = this;
    vm.tab = 'curriculum';
    vm.tabs = [{ value: 'curriculum', label: 'Curriculum & papers' }, { value: 'payment', label: 'Payment gateway' }, { value: 'plans', label: 'Plans' }];
    function fail(e) { Toast.show(e.message, 'error'); }

    // --- curriculum ---
    vm.cur = Loader(function () { return Curriculum.load(); });
    vm.examName = '';
    vm.paperNames = {};
    vm.run = function (promise, msg) {
      promise.then(function () { Toast.show(msg, 'success'); vm.cur.reload(); }, fail);
    };
    vm.addExam = function () {
      vm.run(Api.post('/api/admin/exams', { name: vm.examName }).then(function () { vm.examName = ''; }), 'Exam added');
    };
    vm.deleteExam = function (e) { vm.run(Api.del('/api/admin/exams/' + e.id), 'Exam deleted'); };
    vm.deletePaper = function (p) { vm.run(Api.del('/api/admin/papers/' + p.id), 'Paper deleted'); };
    vm.addPaper = function (e) {
      vm.run(Api.post('/api/admin/papers', { examId: e.id, name: vm.paperNames[e.id], sortOrder: e.papers.length + 1 })
        .then(function () { vm.paperNames[e.id] = ''; }), 'Paper added');
    };

    // --- payment settings ---
    vm.cfg = Loader(function () {
      return Api.get('/api/admin/payment-config').then(function (c) { vm.cfgForm = angular.copy(c); return c; });
    });
    vm.cfgDirty = function () { return !angular.equals(vm.cfgForm, vm.cfg.data); };
    vm.saveCfg = function () {
      Api.put('/api/admin/payment-config', vm.cfgForm).then(function () {
        Toast.show('Payment settings saved', 'success');
        vm.cfg.reload();
      }, fail);
    };

    // --- plans ---
    vm.edit = null;
    vm.plans = Loader(function () { return Api.get('/api/plans'); });
    vm.examOf = function (id) {
      var e = vm.cur.data && vm.cur.data.filter(function (x) { return x.id === id; })[0];
      return e ? e.name : 'Exam';
    };
    vm.newPlan = function () { vm.edit = { name: '', examId: '', priceInr: 0, durationDays: 90, features: '' }; };
    vm.editPlan = function (p) { vm.edit = angular.extend({}, p, { features: p.features.join('\n') }); };
    vm.savePlan = function () {
      var e = vm.edit;
      var body = angular.extend({}, e, {
        priceInr: Number(e.priceInr), durationDays: Number(e.durationDays), active: true,
        features: String(e.features).split('\n').map(function (s) { return s.trim(); }).filter(Boolean)
      });
      (e.id ? Api.put('/api/admin/plans/' + e.id, body) : Api.post('/api/admin/plans', body)).then(function () {
        Toast.show('Plan saved', 'success');
        vm.edit = null;
        vm.plans.reload();
      }, fail);
    };
    vm.deletePlan = function (p) {
      Api.del('/api/admin/plans/' + p.id).then(function () { Toast.show('Plan removed'); vm.plans.reload(); }, fail);
    };
  });

  app.controller('TierCtrl', function (Api, Loader, Toast) {
    var vm = this;
    vm.who = { identifier: '', tier: 2 };
    vm.policy = Loader(function () {
      return Api.get('/api/admin/tier-policy').then(function (p) {
        vm.form = angular.extend({}, p, { tier2UnlockDate: toDate(p.tier2UnlockDate), tier3UnlockDate: toDate(p.tier3UnlockDate) });
        vm.base = angular.copy(vm.form);
        return p;
      });
    });
    vm.dirty = function () { return !angular.equals(vm.form, vm.base); };
    vm.save = function (next) {
      var f = next || vm.form;
      var body = angular.extend({}, f, {
        coverageRequiredPct: Number(f.coverageRequiredPct), qualifyingScorePct: Number(f.qualifyingScorePct), cooldownHours: Number(f.cooldownHours),
        tier2UnlockDate: f.tier2UnlockDate ? fromDate(f.tier2UnlockDate) + 'T00:00:00Z' : null,
        tier3UnlockDate: f.tier3UnlockDate ? fromDate(f.tier3UnlockDate) + 'T00:00:00Z' : null
      });
      Api.put('/api/admin/tier-policy', body).then(function () {
        Toast.show('Tier policy saved', 'success');
        vm.policy.reload();
      }, function (e) { Toast.show(e.message, 'error'); });
    };
    vm.setOverride = function (v) { vm.save(angular.extend({}, vm.form, { universalOverride: v })); };
    vm.unlock = function () {
      Api.post('/api/admin/tier-unlocks', { identifier: vm.who.identifier, tier: Number(vm.who.tier) }).then(function (r) {
        Toast.show('Tier ' + vm.who.tier + ' unlocked for ' + r.email, 'success');
        vm.who.identifier = '';
      }, function (e) { Toast.show(e.message, 'error'); });
    };
  });
})();
