(function () {
  'use strict';
  var app = angular.module('regexam');

  // Starts a mock test and opens it. The paper (questions only, no answers) is kept in this browser tab.
  app.factory('Tests', function ($location, Api, Toast) {
    return {
      start: function (body) {
        return Api.post('/api/tests', body).then(function (paper) {
          sessionStorage.setItem('paper:' + paper.attemptId, JSON.stringify(paper));
          $location.path('/app/test/' + paper.attemptId);
        }, function (e) { Toast.show(e.message, 'error'); });
      },
      hasPaper: function (id) { return !!sessionStorage.getItem('paper:' + id); }
    };
  });

  app.controller('DashboardCtrl', function ($scope, Api, Student, Auth, Loader) {
    var vm = this;
    vm.student = Student;
    vm.firstName = Auth.user.name.split(' ')[0];
    vm.d = Loader(function () { return Api.get('/api/dashboard?examId=' + Student.examId); });
    Student.onExamChange($scope, vm.d.reload);
  });

  app.controller('SyllabusCtrl', function ($scope, $q, Api, Student, Loader, Tests) {
    var vm = this;
    vm.student = Student;
    vm.tierNames = { 1: 'Tier 1 · Foundation', 2: 'Tier 2 · Expansion', 3: 'Tier 3 · Mastery' };
    vm.d = Loader(function () {
      return $q.all([Api.get('/api/exams/' + Student.examId + '/syllabus'), Api.get('/api/tiers/me?examId=' + Student.examId)])
        .then(function (r) { return { syllabus: r[0], tiers: r[1] }; });
    });
    Student.onExamChange($scope, vm.d.reload);
    vm.topics = function (paper, tier) { return paper.topics.filter(function (t) { return t.tier === tier; }); };
    vm.tier = function (tier) { return vm.d.data.tiers.filter(function (t) { return t.tier === tier; })[0]; };
    vm.locked = function () { return vm.d.data.tiers.filter(function (t) { return !t.unlocked; }); };
    vm.qualify = function (tier) { Tests.start({ mode: 'QUALIFYING', examId: Student.examId, tier: tier }); };
  });

  app.controller('StudyPickerCtrl', function ($scope, Api, Student, Loader) {
    var vm = this;
    vm.student = Student;
    vm.d = Loader(function () { return Api.get('/api/exams/' + Student.examId + '/syllabus'); });
    Student.onExamChange($scope, vm.d.reload);
  });

  app.controller('StudyTopicCtrl', function ($scope, $q, $routeParams, $document, Api, Loader) {
    var vm = this, id = $routeParams.topicId;
    vm.term = '';
    vm.pop = null;
    vm.d = Loader(function () {
      return $q.all([Api.get('/api/topics/' + id + '/book'), Api.get('/api/topics/' + id + '/mcqs')])
        .then(function (r) { return { book: r[0], mcqs: r[1] }; });
    });

    // Double-click or select a word in the rulebook to see its definition and translation.
    vm.lookup = function () {
      var sel = window.getSelection(), text = sel && sel.toString().trim();
      var pane = $document[0].querySelector('.book');
      if (!text || text.split(/\s+/).length > 3 || !pane || !pane.contains(sel.anchorNode)) return;
      var rect = sel.getRangeAt(0).getBoundingClientRect();
      var at = { x: Math.min(rect.left, window.innerWidth - 320), y: rect.bottom + 8, word: text };
      Api.get('/api/dictionary/' + encodeURIComponent(text)).then(
        function (entry) { vm.pop = angular.extend(at, { entry: entry }); },
        function () { vm.pop = angular.extend(at, { entry: null }); });
    };
    function close(e) {
      if (!e.target.closest || !e.target.closest('.dict-pop')) $scope.$evalAsync(function () { vm.pop = null; });
    }
    $document.on('mousedown', close);
    $scope.$on('$destroy', function () { $document.off('mousedown', close); });
  });

  app.controller('WeakPracticeCtrl', function ($scope, Api, Student, Loader) {
    var vm = this;
    vm.d = Loader(function () { return Api.get('/api/practice/weak?examId=' + Student.examId + '&limit=20'); });
    Student.onExamChange($scope, vm.d.reload);
  });

  app.controller('MocksCtrl', function ($scope, $q, $location, Api, Student, Loader, Tests) {
    var vm = this;
    vm.student = Student;
    vm.topicId = '';
    vm.d = Loader(function () {
      return $q.all([Api.get('/api/exams/' + Student.examId + '/syllabus'), Api.get('/api/tiers/me?examId=' + Student.examId), Api.get('/api/tests')])
        .then(function (r) {
          // Chapters the student can sit a topic test on (computed once per load so the lists stay stable).
          var topics = [];
          r[0].papers.forEach(function (p) {
            p.topics.forEach(function (t) {
              var tier = r[1].filter(function (x) { return x.tier === t.tier; })[0];
              if (tier && tier.unlocked) topics.push({ id: t.id, label: p.name + ': ' + t.title });
            });
          });
          return { topics: topics, next: r[1].filter(function (t) { return !t.unlocked; })[0], history: r[2] };
        });
    });
    Student.onExamChange($scope, function () { vm.topicId = ''; vm.d.reload(); });

    vm.start = function (body) { Tests.start(angular.extend({ examId: Student.examId }, body)); };
    vm.canResume = Tests.hasPaper;
    vm.open = function (path) { $location.path(path); };
  });

  app.controller('TestCtrl', function ($scope, $routeParams, $location, $interval, $timeout, Api, Toast) {
    var vm = this, id = $routeParams.id, syncTimer;
    vm.paper = JSON.parse(sessionStorage.getItem('paper:' + id) || 'null');
    if (!vm.paper) return;

    vm.keys = ['A', 'B', 'C', 'D'];
    vm.idx = 0;
    vm.answers = JSON.parse(sessionStorage.getItem('answers:' + id) || '{}');
    vm.marked = {};
    vm.visited = { 0: true };
    vm.confirm = false;
    vm.busy = false;
    vm.total = vm.paper.questions.length;

    function remaining() { return Math.max(0, Math.floor((new Date(vm.paper.endsAt) - Date.now()) / 1000)); }
    vm.left = remaining();

    vm.submit = function () {
      if (vm.busy) return;
      vm.busy = true;
      $timeout.cancel(syncTimer);
      Api.post('/api/tests/' + id + '/submit', { answers: vm.answers }).then(function () {
        sessionStorage.removeItem('paper:' + id);
        sessionStorage.removeItem('answers:' + id);
        $location.path('/app/results/' + id).replace();
      }, function (e) { Toast.show(e.message, 'error'); vm.busy = false; });
    };

    var tick = $interval(function () {
      vm.left = remaining();
      if (vm.left === 0) { $interval.cancel(tick); vm.submit(); }
    }, 1000);
    if (vm.left === 0) vm.submit();

    // Answers survive a refresh locally and are synced to the server a few seconds after the last change.
    $scope.$watch(function () { return vm.answers; }, function (a) {
      sessionStorage.setItem('answers:' + id, JSON.stringify(a));
      $timeout.cancel(syncTimer);
      syncTimer = $timeout(function () { Api.put('/api/tests/' + id + '/responses', { answers: a }).catch(angular.noop); }, 4000);
    }, true);
    $scope.$on('$destroy', function () { $interval.cancel(tick); $timeout.cancel(syncTimer); });

    vm.question = function () { return vm.paper.questions[vm.idx]; };
    vm.go = function (i) { vm.idx = i; vm.visited[i] = true; };
    vm.choose = function (k) { vm.answers[vm.idx] = k; };
    vm.clear = function () { delete vm.answers[vm.idx]; };
    vm.toggleMark = function () { if (vm.marked[vm.idx]) delete vm.marked[vm.idx]; else vm.marked[vm.idx] = true; };
    vm.answered = function () { return Object.keys(vm.answers).length; };
    vm.markedCount = function () { return Object.keys(vm.marked).length; };
    vm.palCls = function (i) {
      return (vm.marked[i] ? 'marked' : vm.answers[i] ? 'answered' : vm.visited[i] ? 'visited' : '') + (i === vm.idx ? ' current' : '');
    };
  });

  app.controller('ResultCtrl', function ($routeParams, Api, Loader) {
    var vm = this;
    vm.keys = ['A', 'B', 'C', 'D'];
    vm.d = Loader(function () { return Api.get('/api/tests/' + $routeParams.id + '/result'); });
  });

  app.controller('PaymentCtrl', function (Api, Student, Toast, Loader) {
    var vm = this;
    vm.student = Student;
    vm.planId = null;
    vm.utr = '';
    vm.busy = false;
    vm.sent = null;
    vm.plans = Loader(function () { return Api.get('/api/plans'); });

    vm.pending = function () { return Student.subs.subscriptions.filter(function (s) { return s.status === 'PENDING'; }); };
    vm.hasRejected = function () { return Student.subs.subscriptions.some(function (s) { return s.status === 'REJECTED'; }); };
    vm.select = function (p) {
      vm.planId = p.id;
      vm.sent = null;
      vm.pay = Loader(function () { return Api.get('/api/payment-config?planId=' + p.id); });
    };
    vm.cleanUtr = function () { vm.utr = vm.utr.replace(/\D/g, ''); };
    vm.submit = function () {
      vm.busy = true;
      Api.post('/api/subscriptions', { planId: vm.planId, utr: vm.utr }).then(function (r) {
        vm.sent = r;
        vm.utr = '';
        Student.refresh();
        Toast.show('Payment submitted for approval', 'success');
      }, function (e) { Toast.show(e.message, 'error'); }).finally(function () { vm.busy = false; });
    };
  });

  app.controller('ProfileCtrl', function (Auth, Student) {
    var vm = this, u = Auth.user;
    vm.student = Student;
    vm.rows = [['Full name', u.name], ['Email', u.email], ['Age', u.age], ['Mobile / WhatsApp', u.mobile],
      ['Designation', u.designation], ['Station', u.station], ['Office / controller', u.office]];
  });
})();
