'use strict';

var expect = require('chai').expect,
    _ = require('lodash'),
    Q = require('q'),
    kickapp = require('../'),
    u = require('./util')
    ;

describe('Application', function(){
    describe('With complex dependencies', function(){
        // Prepare the app
        var app = new kickapp.Application(function(a, b){
            this.a = a;
            this.b = b;

            this.addService('d1', u.promisedService(false, 10), 'a', 'b'); // promised, no init()
            this.addService('d2', u.promisedService(true, 10),  'c', 'd') // promised, with init()
                .dependsOn('d1');
            this.addService('d3', u.promisedService(true, 10),  'e', 'f') // promised, with init()
                .dependsOn('d1', 'd2');
            this.addService('d4', u.promisedService(true, 10),  'g', 'h') // promised, with init()
                .dependsOn('d3');
            this.addService('z', {
                args: ['z'],
                methods: [],
                init: function(){
                    this.methods.push('init');
                },
                start: function(){
                    this.methods.push('start');
                },
                stop: function(){
                    this.methods.push('stop');
                }
            }); // promised, with init(), object
        }, 1, 2);

        var svc_args = function(name){ return app.get(name).args; },
            svc_methods = function(name){ return app.get(name).methods };

        it('should have the correct structure', function(){
            expect(app.a).to.be.equal(1);
            expect(app.b).to.be.equal(2);
            expect(_.keys(app._services)).to.deep.equal(['d1', 'd2', 'd3', 'd4', 'z']);
            expect(app.getServiceWrapper('d1').dependencies).to.deep.equal([]);
            expect(app.getServiceWrapper('d2').dependencies).to.deep.equal(['d1']);
            expect(app.getServiceWrapper('d3').dependencies).to.deep.equal(['d1', 'd2']);
            expect(app.getServiceWrapper('d4').dependencies).to.deep.equal(['d3']);
            expect(app.getServiceWrapper('z').dependencies).to.deep.equal([]);
        });

        it('should have services initialized correctly', function(){
            expect(svc_args('d1')).to.deep.equal(['a','b']);
            expect(svc_args('d2')).to.deep.equal(['c','d']);
            expect(svc_args('d3')).to.deep.equal(['e','f']);
            expect(svc_args('d4')).to.deep.equal(['g','h']);
            expect(svc_args('z') ).to.deep.equal(['z']);
        });

        it('should be topologically sorted', function(){
            expect(_.pluck(app._servicesSequence(), 'name')).to.deep.equal(['d1', 'd2', 'd3', 'd4', 'z']);
        });

        describe('state transition sequence', function(){
            // Prepare the event listeners
            var events = new u.EventsCollector();
            events.listenToApp('app', app);

            afterEach(events.reset.bind(events));

            it('shoud init() in the correct sequence', function(){
                return app.init()
                    .then(function(){
                        // test services states
                        expect(app.isRunning()).to.be.false;
                        expect(svc_methods('d1')).to.deep.equal([]); // no init method
                        expect(svc_methods('d2')).to.deep.equal(['init']);
                        expect(svc_methods('d3')).to.deep.equal(['init']);
                        expect(svc_methods('d4')).to.deep.equal(['init']);
                        expect(svc_methods('z')).to.deep.equal(['init']);
                        // test events
                        expect(events.log).to.deep.equal([
                            'd1#init', // has no 'init' method, but produces the event
                            'd2#init', 'd3#init', 'd4#init', 'z#init',
                            'app#init' // application starts
                        ]);
                    });
            });

            it('should start() in the correct sequence', function(){
                return app.start()
                    .then(function(){
                        expect(app.isRunning()).to.be.true;
                        // test events
                        expect(events.log).to.deep.equal([
                            'd1#start', 'd2#start', 'd3#start', 'd4#start', 'z#start', 'app#start'
                        ]);
                    });
            });

            it('should start() again safely', function(){
                return app.start()
                    .then(function(){
                        expect(app.isRunning()).to.be.true;
                        // test events
                        expect(events.log).to.deep.equal(['app#start']); // all services were started
                    });
            });

            it('should stop() in the correct sequence', function(){
                return app.stop()
                    .then(function(){
                        expect(app.isRunning()).to.be.false;
                        // test events
                        expect(events.log).to.deep.equal([
                            'z#stop', 'd4#stop', 'd3#stop', 'd2#stop', 'd1#stop', 'app#stop'
                        ]);
                    });
            });

            it('should stop() again safely', function(){
                return app.stop()
                    .then(function(){
                        expect(app.isRunning()).to.be.false;
                        // test events
                        expect(events.log).to.deep.equal(['app#stop']); // all services were stopped
                    });
            });
        });

        it('should init() automatically on start()', function(){

        });
    });


    describe('with simple dependencies', function(){
        var events = [];

        // Prepare the app
        var app = new kickapp.Application(function(a, b){
            this.addService('a', {
                init:  function(){ events.push('a#init'); },
                start: function(){ events.push('a#start'); },
                stop:  function(){ events.push('a#stop'); }
            }).dependsOn('b');
            this.addService('b', {
                init:  function(){ events.push('b#init'); },
                start: function(){ events.push('b#start'); },
                stop:  function(){ events.push('b#stop'); }
            });
            this.addService('c', {
                init:  function(){ events.push('c#init'); },
                start: function(){ events.push('c#start'); },
                stop:  function(){ events.push('c#stop'); }
            }).dependsOn('b');
        });

        it('should call init() automatically on start()', function(){
            return [
                    app.start.bind(app),
                    app.stop.bind(app)
                ].reduce(Q.when, Q(1))
                .then(function(){
                    expect(events).to.deep.equal([
                        'b#init',
                        'a#init',
                        'c#init',
                        'b#start',
                        'a#start',
                        'c#start',
                        'c#stop',
                        'a#stop',
                        'b#stop'
                    ]);
                })
        });
    });


    describe('as a Service', function(){
        // Create an app
        var app = new kickapp.Application(function(){
        });

        app.addService('first', { start: function(){}, stop: function(){} });
        app.addService('second', { start: function(){}, stop: function(){} });

        // Create a wrapper app
        var top = new kickapp.Application(function(){
        });

        top.addService('sub-app', app); // add application as a service

        // Events
        var events = new u.EventsCollector();
        events.listenToApp('app', app);
        events.listenToApp('top', top);
        beforeEach(events.reset.bind(events));

        it('should init()', function(){
            return top.init()
                .then(function(){
                    expect(events.log).to.deep.equal([
                        'first#init', 'second#init', 'app#init', 'sub-app#init', 'top#init'
                    ]);
                });
        });

        it('should start()', function(){
            return top.start()
                .then(function(){
                    expect(events.log).to.deep.equal([
                        'first#start', 'second#start', 'app#start', 'sub-app#start', 'top#start'
                    ]);
                });
        });

        it('should stop()', function(){
            return top.stop()
                .then(function(){
                    expect(events.log).to.deep.equal([
                        'second#stop', 'first#stop', 'app#stop', 'sub-app#stop', 'top#stop'
                    ]);
                });
        });
    });
});
