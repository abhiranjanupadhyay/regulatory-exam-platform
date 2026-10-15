(function () {
  'use strict';

  var app = angular.module('regexam', ['ngRoute']);

  app.config(function ($routeProvider, $locationProvider, $httpProvider) {
    $locationProvider.hashPrefix('');
    $httpProvider.interceptors.push('authInterceptor');

    var guest = { ctx: function (Auth) { return Auth.guest(); } };
    var student = { ctx: function (Auth, Student) { return Auth.require('STUDENT').then(function () { return Student.load(); }); } };
    var admin = { ctx: function (Auth) { return Auth.require('ADMIN'); } };

    function route(path, mode, title, view, ctrl, resolve) {
      $routeProvider.when(path, {
        mode: mode, title: title, templateUrl: 'views/' + view + '.html',
        controller: ctrl, controllerAs: 'vm', resolve: resolve
      });
    }

    route('/', 'public', '', 'landing', 'LandingCtrl', guest);
    route('/login', 'public', '', 'login', 'LoginCtrl', guest);
    route('/register', 'public', '', 'register', 'RegisterCtrl', guest);

    route('/app', 'student', 'Dashboard', 'student/dashboard', 'DashboardCtrl', student);
    route('/app/syllabus', 'student', 'Syllabus', 'student/syllabus', 'SyllabusCtrl', student);
    route('/app/study', 'student', 'Study Table', 'student/study-picker', 'StudyPickerCtrl', student);
    route('/app/study/:topicId', 'student', 'Study Table', 'student/study-topic', 'StudyTopicCtrl', student);
    route('/app/practice/weak', 'student', 'Weak Area Practice', 'student/weak', 'WeakPracticeCtrl', student);
    route('/app/mocks', 'student', 'Mock Arena', 'student/mocks', 'MocksCtrl', student);
    route('/app/test/:id', 'student', 'Mock Test', 'student/test', 'TestCtrl', student);
    route('/app/results/:id', 'student', 'Scorecard', 'student/result', 'ResultCtrl', student);
    route('/app/plans', 'student', 'Plans & Renewal', 'student/payment', 'PaymentCtrl', student);
    route('/app/profile', 'student', 'Profile', 'student/profile', 'ProfileCtrl', student);

    route('/admin', 'admin', 'Overview', 'admin/overview', 'OverviewCtrl', admin);
    route('/admin/candidates', 'admin', 'Candidates & Support', 'admin/candidates', 'CandidatesCtrl', admin);
    route('/admin/invites', 'admin', 'Invite Codes', 'admin/invites', 'InvitesCtrl', admin);
    route('/admin/content', 'admin', 'Content Matrix', 'admin/content', 'ContentCtrl', admin);
    route('/admin/mcqs', 'admin', 'MCQ Editor', 'admin/mcqs', 'McqEditorCtrl', admin);
    route('/admin/vault', 'admin', 'Snapshot Vault', 'admin/vault', 'VaultCtrl', admin);
    route('/admin/exams-plans', 'admin', 'Exams & Plans', 'admin/exams-plans', 'ExamsPlansCtrl', admin);
    route('/admin/tiers', 'admin', 'Tier Control', 'admin/tiers', 'TierCtrl', admin);

    $routeProvider.otherwise({ redirectTo: '/' });
  });

  // A failed route guard carries the place to send the user instead.
  app.run(function ($rootScope, $location, Auth, Toast) {
    $rootScope.$on('$routeChangeError', function (e, current, previous, rejection) {
      if (rejection && rejection.redirect) {
        $location.path(rejection.redirect).replace();
      } else {
        // A real failure while loading the page (not a guard): drop back to the sign-in page.
        Toast.show((rejection && rejection.message) || 'Could not load the page', 'error');
        Auth.logout();
      }
    });
  });
})();
