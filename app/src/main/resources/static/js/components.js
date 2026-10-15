(function () {
  'use strict';
  var app = angular.module('regexam');

  // ---- layout building blocks ----
  app.component('pageHead', {
    bindings: { heading: '@', subtitle: '@' },
    transclude: true,
    template: '<div class="page-head"><div><h1>{{$ctrl.heading}}</h1><p ng-if="$ctrl.subtitle">{{$ctrl.subtitle}}</p></div>' +
      '<div class="d-flex flex-wrap align-items-center gap-2" ng-transclude></div></div>'
  });

  app.component('rxCard', {
    bindings: { heading: '@', flush: '<' },
    transclude: { actions: '?cardActions' },
    template: '<div class="rx-card" ng-class="{flush: $ctrl.flush}">' +
      '<div class="card-head" ng-if="$ctrl.heading"><h3>{{$ctrl.heading}}</h3><div class="d-flex align-items-center gap-2" ng-transclude="actions"></div></div>' +
      '<div ng-class="{\'card-body-pad\': !$ctrl.flush, \'pt-0\': !$ctrl.flush && $ctrl.heading}" ng-transclude></div></div>'
  });

  app.component('rxStat', {
    bindings: { icon: '@', tone: '@', value: '<', label: '@' },
    template: '<div class="rx-card card-body-pad stat"><div class="ico" ng-class="\'tone-\' + $ctrl.tone"><i class="bi" ng-class="$ctrl.icon"></i></div>' +
      '<div><div class="val">{{$ctrl.value}}</div><div class="lbl">{{$ctrl.label}}</div></div></div>'
  });

  app.component('rxEmpty', {
    bindings: { icon: '@', heading: '@', hint: '@' },
    template: '<div class="rx-empty"><i class="bi" ng-class="$ctrl.icon || \'bi-inbox\'"></i><div class="t">{{$ctrl.heading}}</div><div class="small" ng-if="$ctrl.hint">{{$ctrl.hint}}</div></div>'
  });

  app.component('rxProgress', {
    bindings: { value: '<', tone: '@' },
    template: '<div class="rx-progress" ng-class="$ctrl.tone"><span ng-style="{width: ($ctrl.value > 100 ? 100 : $ctrl.value < 0 ? 0 : $ctrl.value) + \'%\'}"></span></div>'
  });

  app.component('rxRing', {
    bindings: { value: '<' },
    controller: function () { this.r = 62; this.c = 2 * Math.PI * 62; },
    template: '<div class="ring"><svg width="150" height="150" viewBox="0 0 150 150">' +
      '<circle cx="75" cy="75" r="62" fill="none" stroke="#e8ebf5" stroke-width="14"/>' +
      '<circle cx="75" cy="75" r="62" fill="none" stroke="#4f46e5" stroke-width="14" stroke-linecap="round" ' +
      'ng-attr-stroke-dasharray="{{$ctrl.c}}" ng-attr-stroke-dashoffset="{{$ctrl.c * (1 - $ctrl.value / 100)}}" transform="rotate(-90 75 75)"/></svg>' +
      '<div class="num">{{$ctrl.value}}%</div></div>'
  });

  // Spinner while loading, error if the load failed, otherwise the content.
  app.component('rxLoading', {
    bindings: { state: '<' },
    transclude: true,
    template: '<div class="spinner" ng-if="$ctrl.state.loading && !$ctrl.state.data"></div>' +
      '<div class="alert alert-danger" ng-if="$ctrl.state.error">{{$ctrl.state.error.message}}</div>' +
      '<div ng-if="$ctrl.state.data && !$ctrl.state.error" ng-transclude></div>'
  });

  app.component('rxPills', {
    bindings: { options: '<', value: '<', onChange: '&' },
    template: '<div class="pills"><button type="button" class="pill" ng-repeat="o in $ctrl.options" ng-class="{active: $ctrl.value === o.value}" ' +
      'ng-click="$ctrl.onChange({v: o.value})">{{o.label}}<span class="n" ng-if="o.count != null">{{o.count}}</span></button></div>'
  });

  app.component('rxToggle', {
    bindings: { on: '<', onChange: '&' },
    template: '<button type="button" class="toggle" ng-class="{on: $ctrl.on}" ng-click="$ctrl.onChange({v: !$ctrl.on})"></button>'
  });

  app.component('rxModal', {
    bindings: { heading: '@', wide: '<', onClose: '&' },
    transclude: { footer: '?modalFooter' },
    controller: function ($document, $scope) {
      var c = this;
      function key(e) { if (e.key === 'Escape') $scope.$apply(function () { c.onClose(); }); }
      c.$onInit = function () { $document.on('keydown', key); };
      c.$onDestroy = function () { $document.off('keydown', key); };
      c.back = function (e) { if (e.target === e.currentTarget) c.onClose(); };
    },
    template: '<div class="rx-modal-back" ng-mousedown="$ctrl.back($event)"><div class="rx-modal" ng-class="{wide: $ctrl.wide}">' +
      '<div class="rx-modal-head"><h3>{{$ctrl.heading}}</h3><button type="button" class="btn btn-sm btn-light" ng-click="$ctrl.onClose()"><i class="bi bi-x-lg"></i></button></div>' +
      '<div class="rx-modal-body" ng-transclude></div><div class="rx-modal-foot" ng-transclude="footer"></div></div></div>'
  });

  app.component('rxDrawer', {
    bindings: { heading: '@', onClose: '&' },
    transclude: true,
    controller: function () { this.back = function (e) { if (e.target === e.currentTarget) this.onClose(); }; },
    template: '<div class="drawer-back" ng-mousedown="$ctrl.back($event)"><div class="drawer">' +
      '<div class="rx-modal-head"><h3>{{$ctrl.heading}}</h3><button type="button" class="btn btn-sm btn-light" ng-click="$ctrl.onClose()"><i class="bi bi-x-lg"></i></button></div>' +
      '<div class="rx-modal-body" ng-transclude></div></div></div>'
  });

  // ---- sign-in (Google, or the dev form when the server runs with GOOGLE_DEV_MODE) ----
  app.component('rxGoogleSignIn', {
    bindings: { label: '@', onToken: '&' },
    controller: function ($element, $timeout, Config) {
      var c = this;
      c.email = '';
      c.name = '';
      c.cfg = null;
      c.$onInit = function () {
        Config.load().then(function (cfg) {
          c.cfg = cfg;
          if (cfg.googleClientId) loadGoogle(cfg.googleClientId);
        });
      };
      c.dev = function () { c.onToken({ t: 'dev:' + c.email + '|' + (c.name || c.email) }); };

      function render(clientId) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: function (r) { $timeout(function () { c.onToken({ t: r.credential }); }); }
        });
        window.google.accounts.id.renderButton($element[0].querySelector('.g-btn'),
          { theme: 'outline', size: 'large', width: 320, text: 'continue_with' });
      }
      function loadGoogle(clientId) {
        if (window.google && window.google.accounts) return $timeout(function () { render(clientId); });
        var s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = function () { render(clientId); };
        document.body.appendChild(s);
      }
    },
    template: '<div class="stack">' +
      '<div class="g-btn d-flex justify-content-center"></div>' +
      '<div class="dev-box" ng-if="$ctrl.cfg.devMode"><div class="small fw-semibold mb-2">Development sign-in (no Google)</div>' +
      '<input class="form-control mb-2" placeholder="Email" ng-model="$ctrl.email">' +
      '<input class="form-control mb-2" placeholder="Full name" ng-model="$ctrl.name">' +
      '<button type="button" class="btn btn-primary w-100" ng-disabled="$ctrl.email.indexOf(\'@\') < 1" ng-click="$ctrl.dev()">{{$ctrl.label || \'Continue\'}}</button></div>' +
      '<div class="alert alert-warning" ng-if="$ctrl.cfg && !$ctrl.cfg.googleClientId && !$ctrl.cfg.devMode">Google sign-in is not configured. Set GOOGLE_CLIENT_ID on the server.</div></div>'
  });

  // ---- admin: Exam > Paper > Topic selectors ----
  app.component('rxCurriculumPicker', {
    bindings: { curriculum: '<', withTopic: '<?', onChange: '&' },
    controller: function () {
      var c = this;
      c.examId = ''; c.paperId = ''; c.topicId = '';
      function find(list, id) { return (list || []).filter(function (x) { return x.id === id; })[0]; }
      c.exam = function () { return find(c.curriculum, c.examId); };
      c.paper = function () { var e = c.exam(); return e && find(e.papers, c.paperId); };
      c.topic = function () { var p = c.paper(); return p && find(p.topics, c.topicId); };
      c.emit = function () { c.onChange({ sel: { exam: c.exam(), paper: c.paper(), topic: c.topic() } }); };
      c.pickExam = function () { c.paperId = ''; c.topicId = ''; c.emit(); };
      c.pickPaper = function () { c.topicId = ''; c.emit(); };
      c.$onInit = function () { if (c.withTopic === undefined) c.withTopic = true; c.emit(); };
      c.$onChanges = function (ch) { if (ch.curriculum && !ch.curriculum.isFirstChange()) c.emit(); };
    },
    template: '<div class="row g-3 mb-1"><div ng-class="$ctrl.withTopic ? \'col-md-4\' : \'col-md-6\'"><label class="form-label">Exam</label>' +
      '<select class="form-select" ng-model="$ctrl.examId" ng-change="$ctrl.pickExam()"><option value="">Select exam</option><option ng-repeat="e in $ctrl.curriculum" value="{{e.id}}">{{e.name}}</option></select></div>' +
      '<div ng-class="$ctrl.withTopic ? \'col-md-4\' : \'col-md-6\'"><label class="form-label">Paper</label>' +
      '<select class="form-select" ng-model="$ctrl.paperId" ng-change="$ctrl.pickPaper()" ng-disabled="!$ctrl.exam()"><option value="">Select paper</option><option ng-repeat="p in $ctrl.exam().papers" value="{{p.id}}">{{p.name}}</option></select></div>' +
      '<div class="col-md-4" ng-if="$ctrl.withTopic"><label class="form-label">Topic</label>' +
      '<select class="form-select" ng-model="$ctrl.topicId" ng-change="$ctrl.emit()" ng-disabled="!$ctrl.paper()"><option value="">Select topic</option><option ng-repeat="t in $ctrl.paper().topics" value="{{t.id}}">{{t.title}} (Tier {{t.tier}})</option></select></div></div>'
  });

  // ---- student: practice questions with instant feedback + discrepancy report ----
  app.component('rxPracticeDeck', {
    bindings: { questions: '<' },
    controller: function (Api, Toast) {
      var c = this;
      c.done = {};
      c.report = null;
      c.remarks = '';
      c.keys = ['A', 'B', 'C', 'D'];
      c.choose = function (q, choice) {
        if (c.done[q.id]) return;
        Api.post('/api/practice/answer', { mcqId: q.id, choice: choice }).then(function (fb) {
          c.done[q.id] = angular.extend({}, fb, { choice: choice });
        }, function (e) { Toast.show(e.message, 'error'); });
      };
      c.cls = function (q, k) {
        var r = c.done[q.id];
        return r ? (k === r.correctOption ? 'correct' : k === r.choice ? 'wrong' : '') : '';
      };
      c.send = function () {
        Api.post('/api/tickets', { mcqId: c.report.id, remarks: c.remarks }).then(function () {
          Toast.show('Reported to the administrator', 'success');
          c.report = null;
          c.remarks = '';
        }, function (e) { Toast.show(e.message, 'error'); });
      };
    },
    template:
      '<rx-empty ng-if="!$ctrl.questions.length" heading="No practice questions yet" hint="Questions for this chapter have not been uploaded."></rx-empty>' +
      '<div class="mcq" ng-repeat="q in $ctrl.questions">' +
      '<div class="d-flex justify-content-between align-items-start gap-2"><div class="fw-semibold">{{$index + 1}}. {{q.question}}</div>' +
      '<button class="btn btn-sm btn-light" title="Report discrepancy" ng-click="$ctrl.report = q"><i class="bi bi-flag me-1"></i>Report</button></div>' +
      '<button class="opt" ng-repeat="k in $ctrl.keys" ng-class="$ctrl.cls(q, k)" ng-disabled="!!$ctrl.done[q.id]" ng-click="$ctrl.choose(q, k)"><span class="key">{{k}}</span><span>{{q[\'option\' + k]}}</span></button>' +
      '<div class="explain" ng-if="$ctrl.done[q.id]"><b>{{$ctrl.done[q.id].correct ? \'Correct.\' : \'Incorrect. Answer: \' + $ctrl.done[q.id].correctOption + \'.\'}}</b> {{$ctrl.done[q.id].explanation}}' +
      '<div class="small muted mt-1" ng-if="$ctrl.done[q.id].citation">Reference: {{$ctrl.done[q.id].citation}}</div></div></div>' +
      '<rx-modal ng-if="$ctrl.report" heading="Report a discrepancy" on-close="$ctrl.report = null">' +
      '<p class="muted">{{$ctrl.report.question}}</p><label class="form-label">What looks wrong?</label>' +
      '<textarea class="form-control" ng-model="$ctrl.remarks" placeholder="Confusing stem, disputed answer, wrong citation..."></textarea>' +
      '<modal-footer><button class="btn btn-light" ng-click="$ctrl.report = null">Cancel</button>' +
      '<button class="btn btn-primary" ng-disabled="!$ctrl.remarks.trim()" ng-click="$ctrl.send()">Send to admin</button></modal-footer></rx-modal>'
  });

  // ---- admin: one editable MCQ ----
  app.component('rxMcqRow', {
    bindings: { original: '<' },
    controller: function (Api, Toast) {
      var c = this;
      c.keys = ['A', 'B', 'C', 'D'];
      c.$onInit = function () { c.saved = angular.copy(c.original); c.m = angular.copy(c.original); };
      c.dirty = function () { return !angular.equals(c.m, c.saved); };
      c.save = function () {
        Api.put('/api/admin/mcqs/' + c.m.id, c.m).then(function (r) {
          c.saved = angular.copy(r); c.m = angular.copy(r); Toast.show('Saved', 'success');
        }, function (e) { Toast.show(e.message, 'error'); });
      };
      c.undo = function () { c.m = angular.copy(c.saved); };
    },
    template: '<div class="mcq" ng-style="$ctrl.dirty() && {\'border-color\': \'var(--amber)\'}">' +
      '<div class="mb-3"><label class="form-label">Question</label><textarea class="form-control" style="min-height:70px" ng-model="$ctrl.m.question"></textarea></div>' +
      '<div class="row g-3 mb-1"><div class="col-md-6 mb-1" ng-repeat="k in $ctrl.keys"><label class="form-label">Option {{k}}</label><input class="form-control" ng-model="$ctrl.m[\'option\' + k]"></div></div>' +
      '<div class="row g-3 mb-3"><div class="col-md-4"><label class="form-label">Correct answer</label><select class="form-select" ng-model="$ctrl.m.correct" ng-options="k for k in $ctrl.keys"></select></div>' +
      '<div class="col-md-4"><label class="form-label">Explanation</label><input class="form-control" ng-model="$ctrl.m.explanation"></div>' +
      '<div class="col-md-4"><label class="form-label">Paragraph citation</label><input class="form-control" ng-model="$ctrl.m.citation"></div></div>' +
      '<div class="d-flex align-items-center gap-2"><button class="btn btn-primary btn-sm" ng-disabled="!$ctrl.dirty()" ng-click="$ctrl.save()"><i class="bi bi-save me-1"></i>Save</button>' +
      '<button class="btn btn-light btn-sm" ng-disabled="!$ctrl.dirty()" ng-click="$ctrl.undo()"><i class="bi bi-arrow-counterclockwise me-1"></i>Undo</button>' +
      '<span class="small" style="color:var(--amber)" ng-if="$ctrl.dirty()">Unsaved changes</span></div></div>'
  });

  // ---- directives ----

  // Reads a chosen file and hands its text to on-file-text="fn(text)". Excel .xlsx files are converted
  // to CSV text (first sheet) so the server sees the same format as an uploaded or pasted CSV.
  app.directive('onFileText', function (Toast) {
    return {
      scope: { onFileText: '&' },
      link: function (scope, el) {
        el.on('change', function (e) {
          var input = e.target, f = input.files[0];
          if (!f) return;
          if (/\.xls$/i.test(f.name)) {
            scope.$evalAsync(function () { Toast.show('Old .xls files are not supported: save the sheet as .xlsx or CSV', 'error'); });
            input.value = '';
            return;
          }
          var excel = /\.xlsx$/i.test(f.name);
          var r = new FileReader();
          r.onload = function () {
            scope.$evalAsync(function () {
              var text;
              if (excel) {
                try {
                  var wb = window.XLSX.read(r.result, { type: 'array' });
                  text = window.XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
                } catch (err) {
                  Toast.show('Could not read that Excel file', 'error');
                  return;
                }
              } else {
                text = String(r.result);
              }
              if (!text.trim()) {
                Toast.show('That file has no rows', 'error');
                return;
              }
              scope.onFileText({ text: text });
            });
            input.value = '';
          };
          if (excel) r.readAsArrayBuffer(f); else r.readAsText(f);
        });
      }
    };
  });

  // Renders sanitized Markdown, highlighting the search term.
  app.directive('rxMarkdown', function () {
    function highlight(root, term) {
      var re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [], n;
      while ((n = walker.nextNode())) if (re.test(n.nodeValue)) nodes.push(n), re.lastIndex = 0;
      nodes.forEach(function (node) {
        var frag = document.createDocumentFragment();
        node.nodeValue.split(re).forEach(function (part, i) {
          if (i % 2) { var m = document.createElement('mark'); m.textContent = part; frag.appendChild(m); }
          else if (part) frag.appendChild(document.createTextNode(part));
        });
        node.parentNode.replaceChild(frag, node);
      });
    }
    return {
      scope: { text: '<', term: '<' },
      link: function (scope, el) {
        function draw() {
          el.html(window.DOMPurify.sanitize(window.marked.parse(scope.text || '')));
          if (scope.term) highlight(el[0], scope.term);
        }
        scope.$watchGroup(['text', 'term'], draw);
      }
    };
  });

  // QR code (SVG) for the UPI payment link.
  app.directive('rxQr', function () {
    return {
      scope: { value: '<' },
      link: function (scope, el) {
        scope.$watch('value', function (v) {
          if (!v) return el.empty();
          var q = window.qrcode(0, 'M');
          q.addData(v);
          q.make();
          el.html(q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }));
        });
      }
    };
  });

  // Study/test area guard: forensic watermark (email, mobile, live time), no right-click, copy or common inspect
  // shortcuts, and the content blurs when the window loses focus or dev tools look open. It deters casual capture.
  app.directive('rxProtect', function ($interval, Auth) {
    return {
      link: function (scope, el) {
        var node = el[0];
        node.classList.add('protected');
        var wm = document.createElement('div');
        wm.className = 'watermark';
        node.appendChild(wm);

        function stamp() {
          var u = Auth.user || {};
          var text = ((u.email || '') + '  ' + (u.mobile || '') + '  ' + new Date().toLocaleString('en-IN')).replace(/&/g, '&amp;').replace(/</g, '&lt;');
          var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='420' height='220'><text x='10' y='140' transform='rotate(-22 210 110)' " +
            "font-family='Arial' font-size='13' fill='rgba(23,32,58,0.09)'>" + text + '</text></svg>';
          wm.style.backgroundImage = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
        }
        function shield(on) { node.classList.toggle('shielded', !!on); }
        function block(e) { e.preventDefault(); }
        function keys(e) {
          var k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
          if (e.key === 'F12' || (ctrl && ['c', 'x', 'u', 's', 'p', 'a'].indexOf(k) >= 0) || (ctrl && e.shiftKey && ['i', 'j', 'c'].indexOf(k) >= 0)) {
            if (['INPUT', 'TEXTAREA'].indexOf(e.target.tagName) < 0) e.preventDefault();
          }
        }
        var onBlur = function () { shield(true); }, onFocus = function () { shield(false); },
          onVis = function () { shield(document.hidden); };
        var evs = ['contextmenu', 'copy', 'cut', 'dragstart'];
        evs.forEach(function (ev) { document.addEventListener(ev, block); });
        document.addEventListener('keydown', keys);
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVis);
        var t1 = setInterval(function () {
          shield(window.outerWidth - window.innerWidth > 200 || window.outerHeight - window.innerHeight > 260);
        }, 1500);
        var t2 = setInterval(stamp, 15000);
        stamp();

        scope.$on('$destroy', function () {
          evs.forEach(function (ev) { document.removeEventListener(ev, block); });
          document.removeEventListener('keydown', keys);
          window.removeEventListener('blur', onBlur);
          window.removeEventListener('focus', onFocus);
          document.removeEventListener('visibilitychange', onVis);
          clearInterval(t1);
          clearInterval(t2);
        });
      }
    };
  });
})();
