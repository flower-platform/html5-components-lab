// File: application.js
var wcgUiRouterApplication = angular.module('appTestComponentsHtml5', ['ui.router', 'ui.bootstrap']);

wcgUiRouterApplication.config(function($stateProvider, $urlRouterProvider) {
    
	$stateProvider
		.state('posts', {
			 url: '/posts',
			 templateUrl: 'speech-recognition-project-oxford/speech-recognition-project-oxford.view.html'
		})
		//HERE: configure the state menu entry like above
		.state('component', {
			 //  Posts state. This state will contain nested views
			 url: '/component',
			 templateUrl: '<insert template url here>'
		})

	})