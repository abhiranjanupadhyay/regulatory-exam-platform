(function () {
  'use strict';
  var app = angular.module('regexam');

  // ---- session + http ----
  app.factory('Session', function () {
    var S = { token: localStorage.getItem('token') };
    S.set = function (t) {
      S.token = t;
      if (t) localStorage.setItem('token', t); else localStorage.removeItem('token');
    };
    return S;
  });

  // Adds the bearer token; 401s become events so Auth can show "session displaced" or send the user to log in.
  app.factory('authInterceptor', function ($q, $rootScope, Session) {
    return {
      request: function (cfg) {
        if (Session.token) cfg.headers.Authorization = 'Bearer ' + Session.token;
        return cfg;
      },
      responseError: function (r) {
        if (r.status === 401 && Session.token) {
          var code = r.data && r.data.code;
          $rootScope.$broadcast(code === 'SESSION_DISPLACED' ? 'auth:displaced' : 'auth:unauthorized');
        }
        return $q.reject(r);
      }
    };
  });

  app.factory('Api', function ($http, $q) {
    function call(method, url, body) {
      return $http({ method: method, url: url, data: body }).then(function (r) {
        return r.status === 204 || r.data === '' ? null : r.data;
      }, function (r) {
        var d = r.data && typeof r.data === 'object' ? r.data : null;
        var err = new Error((d && d.message) || 'Request failed (' + r.status + ')');
        err.status = r.status;
        err.code = d && d.code;
        return $q.reject(err);
      });
    }
    return {
      get: function (u) { return call('GET', u); },
      post: function (u, b) { return call('POST', u, b); },
      put: function (u, b) { return call('PUT', u, b); },
      del: function (u) { return call('DELETE', u); }
    };
  });

  app.factory('Config', function (Api) {
    var p;
    return { load: function () { return p || (p = Api.get('/api/auth/config')); } };
  });

  // ---- auth ----
  app.factory('Auth', function ($q, $rootScope, $interval, Api, Session) {
    var A = { user: null, displaced: false }, beat = null;

    function startBeat() {
      stopBeat();
      beat = $interval(function () { Api.get('/api/users/me').catch(angular.noop); }, 20000);
    }
    function stopBeat() { if (beat) { $interval.cancel(beat); beat = null; } }
    function finish(res) {
      Session.set(res.token);
      A.user = res.user;
      A.displaced = false;
      startBeat();
      return res.user;
    }

    A.ready = Session.token
      ? Api.get('/api/users/me').then(function (u) { A.user = u; startBeat(); }, function () { Session.set(null); })
      : $q.when();

    A.login = function (idToken) { return Api.post('/api/auth/login', { idToken: idToken }).then(finish); };
    A.register = function (payload) { return Api.post('/api/auth/register', payload).then(finish); };
    A.logout = function () {
      Session.set(null);
      A.user = null;
      A.displaced = false;
      stopBeat();
      $rootScope.$broadcast('auth:logout');
    };
    A.home = function () { return A.user && A.user.role === 'ADMIN' ? '/admin' : '/app'; };

    // Route guards, used in route resolves.
    A.require = function (role) {
      return A.ready.then(function () {
        if (!A.user) return $q.reject({ redirect: '/' });
        if ((role === 'ADMIN') !== (A.user.role === 'ADMIN')) return $q.reject({ redirect: A.home() });
        return true;
      });
    };
    A.guest = function () {
      return A.ready.then(function () { return A.user ? $q.reject({ redirect: A.home() }) : true; });
    };

    $rootScope.$on('auth:displaced', function () { A.displaced = true; });
    $rootScope.$on('auth:unauthorized', function () { A.logout(); });
    return A;
  });

  // ---- student context: exams, subscriptions, the selected exam stage ----
  app.factory('Student', function ($q, $rootScope, Api) {
    var S = { exams: null, subs: null, examId: localStorage.getItem('examId'), examIds: [], best: null, locked: false, loaded: null };

    S.recompute = function () {
      var active = (S.subs.subscriptions || []).filter(function (s) { return s.status === 'ACTIVE'; });
      S.examIds = active.map(function (s) { return s.examId; }).filter(function (id, i, a) { return a.indexOf(id) === i; });
      if (S.examIds.indexOf(S.examId) < 0) S.examId = S.examIds[0];
      if (S.examId) localStorage.setItem('examId', S.examId);
      S.best = active.filter(function (s) { return s.examId === S.examId; })
        .sort(function (a, b) { return b.daysRemaining - a.daysRemaining; })[0] || null;
      S.locked = !S.subs.hasActivePlan;
    };
    S.load = function () {
      if (!S.loaded) {
        S.loaded = $q.all([Api.get('/api/exams'), Api.get('/api/subscriptions/me')]).then(function (r) {
          S.exams = r[0];
          S.subs = r[1];
          S.recompute();
          return S;
        }, function (e) { S.loaded = null; return $q.reject(e); });
      }
      return S.loaded;
    };
    S.refresh = function () {
      return Api.get('/api/subscriptions/me').then(function (s) { S.subs = s; S.recompute(); });
    };
    S.setExam = function (id) { S.examId = id; S.recompute(); };
    S.examName = function (id) {
      var e = (S.exams || []).filter(function (x) { return x.id === id; })[0];
      return e ? e.name : 'Exam';
    };
    // Re-run fn whenever the student switches exam stage.
    S.onExamChange = function (scope, fn) {
      scope.$watch(function () { return S.examId; }, function (n, o) { if (n !== o) fn(); });
    };
    $rootScope.$on('auth:logout', function () { S.loaded = null; S.exams = null; S.subs = null; S.best = null; S.examIds = []; });
    return S;
  });

  app.factory('Toast', function ($timeout) {
    var T = { items: [] };
    T.show = function (message, kind) {
      var it = { message: message, kind: kind || '' };
      T.items.push(it);
      $timeout(function () { T.items.splice(T.items.indexOf(it), 1); }, 4200);
    };
    return T;
  });

  // Loads data for a view: { loading, error, data, reload }. Keeps old data visible while reloading.
  app.factory('Loader', function ($q) {
    return function (fn) {
      var l = { loading: true, error: null, data: null };
      l.reload = function () {
        l.loading = true;
        return $q.when(fn()).then(function (d) { l.data = d; l.error = null; return d; },
          function (e) { l.data = null; l.error = e; }).finally(function () { l.loading = false; });
      };
      l.reload();
      return l;
    };
  });

  app.factory('Curriculum', function ($q, Api) {
    return {
      // Exams with their papers and topics, for the cascading Exam > Paper > Topic selectors.
      load: function () {
        return Api.get('/api/exams').then(function (exams) {
          return $q.all(exams.map(function (e) { return Api.get('/api/exams/' + e.id + '/syllabus'); })).then(function (sy) {
            return exams.map(function (e, i) { return angular.extend({}, e, { papers: sy[i].papers }); });
          });
        });
      }
    };
  });

  app.factory('Util', function ($q) {
    var U = {};
    U.identityOf = function (idToken) {
      if (idToken.indexOf('dev:') === 0) {
        var p = idToken.slice(4).split('|');
        return { email: p[0], name: p[1] || p[0] };
      }
      try {
        var c = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return { email: c.email, name: c.name };
      } catch (e) { return { email: '', name: '' }; }
    };
    U.readFile = function (file) {
      var d = $q.defer(), r = new FileReader();
      r.onload = function () { d.resolve(String(r.result)); };
      r.onerror = function () { d.reject(new Error('Could not read the file')); };
      r.readAsText(file);
      return d.promise;
    };
    U.downloadJson = function (filename, data) {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    };
    return U;
  });

  // ---- filters ----
  app.filter('rxDate', function () {
    return function (iso) {
      return iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    };
  });
  app.filter('rxDateTime', function () {
    return function (iso) {
      return iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
    };
  });
  var TONES = { ACTIVE: 'green', PENDING: 'amber', REJECTED: 'red', FROZEN: 'blue', EXPIRED: '', OPEN: 'amber',
    RESOLVED: 'green', COMPLETE: 'green', EMPTY: 'red', MISSING_BOOK: 'amber', MISSING_MCQS: 'amber', USED: '' };
  app.filter('tone', function () { return function (s) { return TONES[s] || ''; }; });
  app.filter('words', function () { return function (s) { return s ? String(s).replace(/_/g, ' ').toLowerCase() : ''; }; });
  app.filter('clock', function () {
    return function (s) {
      function p(n) { return ('0' + n).slice(-2); }
      return p(Math.floor(s / 3600)) + ':' + p(Math.floor((s % 3600) / 60)) + ':' + p(s % 60);
    };
  });

  // ---- shell: which chrome to show, navigation, titles ----
  app.controller('ShellCtrl', function ($scope, $rootScope, $location, $document, $timeout, Auth, Student, Toast, Api) {
    var sh = this;
    sh.auth = Auth;
    sh.student = Student;
    sh.toast = Toast;
    sh.mode = 'public';
    sh.title = '';
    sh.navOpen = false;
    sh.menu = false;
    sh.attention = 0;

    sh.studentNav = [
      { to: '/app', label: 'Dashboard', icon: 'bi-speedometer2', end: true },
      { to: '/app/syllabus', label: 'Syllabus', icon: 'bi-list-check' },
      { to: '/app/study', label: 'Study Table', icon: 'bi-book' },
      { to: '/app/mocks', label: 'Mock Arena', icon: 'bi-stopwatch' },
      { to: '/app/profile', label: 'Profile', icon: 'bi-person' }
    ];
    sh.adminNav = [
      { section: 'Overview', items: [{ to: '/admin', label: 'Overview', icon: 'bi-speedometer2', end: true }] },
      { section: 'People', items: [
        { to: '/admin/candidates', label: 'Candidates & Support', icon: 'bi-people', badge: true },
        { to: '/admin/invites', label: 'Invite Codes', icon: 'bi-key' }] },
      { section: 'Content', items: [
        { to: '/admin/content', label: 'Content Matrix', icon: 'bi-layers' },
        { to: '/admin/mcqs', label: 'MCQ Editor', icon: 'bi-pencil-square' },
        { to: '/admin/vault', label: 'Snapshot Vault', icon: 'bi-archive' }] },
      { section: 'Configuration', items: [
        { to: '/admin/exams-plans', label: 'Exams & Plans', icon: 'bi-wallet2' },
        { to: '/admin/tiers', label: 'Tier Control', icon: 'bi-shield-check' }] }
    ];

    sh.isActive = function (n) {
      var p = $location.path();
      return n.end ? p === n.to : p.indexOf(n.to) === 0;
    };
    sh.go = function (p) { $location.path(p); };
    sh.logout = function () { sh.menu = false; Auth.logout(); };

    $rootScope.$on('$routeChangeSuccess', function (e, cur) {
      if (!cur || !cur.$$route) return;
      sh.mode = cur.$$route.mode;
      sh.title = cur.$$route.title;
      sh.navOpen = false;
      sh.menu = false;
      // Without an active plan the student can only see the plans page.
      if (sh.mode === 'student' && Student.locked && $location.path() !== '/app/plans') $location.path('/app/plans').replace();
      // Pending payments + open tickets, shown as a badge in the admin sidebar.
      if (sh.mode === 'admin') {
        Api.get('/api/admin/subscriptions?status=PENDING').then(function (s) {
          return Api.get('/api/admin/tickets?status=OPEN').then(function (t) { sh.attention = s.length + t.length; });
        }).catch(angular.noop);
      }
    });
    $rootScope.$on('auth:logout', function () { sh.mode = 'public'; $location.path('/'); });

    function outside(e) {
      if (sh.menu && !e.target.closest('.user-menu-wrap')) $scope.$evalAsync(function () { sh.menu = false; });
    }
    $document.on('mousedown', outside);
    $scope.$on('$destroy', function () { $document.off('mousedown', outside); });
  });
})();
