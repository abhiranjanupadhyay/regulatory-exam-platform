(function () {
  'use strict';
  var app = angular.module('regexam');

  app.controller('LandingCtrl', function () {
    this.features = [
      { icon: 'bi-journal-check', text: 'Rulebook and practice deck side by side' },
      { icon: 'bi-stopwatch', text: 'Timed mocks with question palette and full scorecards' },
      { icon: 'bi-graph-up-arrow', text: 'Readiness meter and weak-area remediation' },
      { icon: 'bi-shield-check', text: 'Secure, single-device access' }
    ];
  });

  app.controller('LoginCtrl', function ($location, Auth) {
    var vm = this;
    vm.error = null;
    vm.onToken = function (idToken) {
      vm.error = null;
      Auth.login(idToken).then(function () { $location.path(Auth.home()).replace(); }, function (e) { vm.error = e; });
    };
  });

  app.controller('RegisterCtrl', function ($location, Api, Auth, Util) {
    var vm = this;
    vm.step = 1;
    vm.invite = '';
    vm.idToken = '';
    vm.error = null;
    vm.busy = false;
    vm.who = { email: '', name: '' };
    vm.designations = ['Clerk', 'Auditor', 'Senior Auditor', 'Assistant Accounts Officer', 'Other'];
    vm.f = { age: '', mobile: '', designation: 'Clerk', designationOther: '', station: '', office: '', detailsGenuine: false, authorizedEmployee: false };

    vm.checkInvite = function () {
      vm.error = null;
      vm.busy = true;
      Api.post('/api/auth/invite/validate', { code: vm.invite }).then(function (r) {
        if (r.valid) vm.step = 2; else vm.error = new Error('Invalid or already used invite code.');
      }, function (e) { vm.error = e; }).finally(function () { vm.busy = false; });
    };
    vm.onToken = function (t) {
      vm.idToken = t;
      vm.who = Util.identityOf(t);
      vm.step = 3;
    };
    vm.submit = function () {
      vm.error = null;
      vm.busy = true;
      var body = angular.extend({ idToken: vm.idToken, inviteCode: vm.invite }, vm.f, { age: Number(vm.f.age) });
      Auth.register(body).then(function () { $location.path('/app').replace(); },
        function (e) { vm.error = e; }).finally(function () { vm.busy = false; });
    };
  });
})();
