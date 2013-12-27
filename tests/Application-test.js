'use strict';

var _ = require('lodash'),
    Q = require('q'),
    kickapp = require('../'),
    u = require('./util')
    ;


/** Test the promised Application and its services
 * @param {test|assert} test
 */
exports.testApplication = function(test){
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

    // Test structure
    test.strictEqual(app.a, 1);
    test.strictEqual(app.b, 2);
    test.deepEqual(_.keys(app._services), ['d1', 'd2', 'd3', 'd4', 'z']);
    test.deepEqual(app.getServiceWrapper('d1').dependencies, []);
    test.deepEqual(app.getServiceWrapper('d2').dependencies, ['d1']);
    test.deepEqual(app.getServiceWrapper('d3').dependencies, ['d1', 'd2']);
    test.deepEqual(app.getServiceWrapper('d4').dependencies, ['d3']);
    test.deepEqual(app.getServiceWrapper('z').dependencies, []);

    // Test services
    test.deepEqual(app.get('d1'), { args: ['a','b'], methods: [] });
    test.deepEqual(app.get('d2'), { args: ['c','d'], methods: [] });
    test.deepEqual(app.get('d3'), { args: ['e','f'], methods: [] });
    test.deepEqual(app.get('d4'), { args: ['g','h'], methods: [] });
    test.deepEqual(_.pick(app.get('z'), 'args', 'methods'),  { args: ['z'],     methods: [] });

    // Test toposorted sequence
    test.deepEqual(
        _.pluck(app._servicesSequence(), 'name'),
        ['d1', 'd2', 'd3', 'd4', 'z']
    );

    // Prepare the event listeners
    var events = new u.EventsCollector();
    events.listenToApp('app', app);

    // Run tests
    return [
        // init()
        function(){
            return app.init()
                .then(function(){
                    // test services states
                    test.strictEqual(app.isRunning(), false);
                    test.deepEqual(app.get('d1').methods, []); // no init method
                    test.deepEqual(app.get('d2').methods, ['init']);
                    test.deepEqual(app.get('d3').methods, ['init']);
                    test.deepEqual(app.get('d4').methods, ['init']);
                    test.deepEqual(app.get('z').methods, ['init']);
                    // test events
                    test.deepEqual(events.log, [
                        'd1#init', // has no 'init' method, but produces the event
                        'd2#init', 'd3#init', 'd4#init', 'z#init',
                        'app#init' // application starts
                    ]);
                    // reset
                    events.reset();
                });
        },
        // start()
        function(){
            return app.start()
                .then(function(){
                    test.strictEqual(app.isRunning(), true);
                    // test events
                    test.deepEqual(events.log, [
                        'd1#start', 'd2#start', 'd3#start', 'd4#start', 'z#start', 'app#start'
                    ]);
                    // reset
                    events.reset();
                });
        },
        // start() again
        function(){
            return app.start()
                .then(function(){
                    test.strictEqual(app.isRunning(), true);
                    // test events
                    test.deepEqual(events.log, ['app#start']); // all services were started
                    // reset
                    events.reset();
                });
        },
        // stop()
        function(){
            return app.stop()
                .then(function(){
                    test.strictEqual(app.isRunning(), false);
                    // test events
                    test.deepEqual(events.log, [
                        'z#stop', 'd4#stop', 'd3#stop', 'd2#stop', 'd1#stop', 'app#stop'
                    ]);
                    // reset
                    events.reset();
                });
        },
        // stop() again
        function(){
            return app.stop()
                .then(function(){
                    test.strictEqual(app.isRunning(), false);
                    // test events
                    test.deepEqual(events.log, ['app#stop']); // all services were stopped
                    // reset
                    events.reset();
                });
        }
    ].reduce(Q.when, Q(1))
        .catch(function(e){ test.ok(false, e.stack); })
        .finally(function(){ test.done(); })
        .done();
};

/** Test that init() is auto-called on start()
 * @param {test|assert} test
 */
exports.testApplicationAutoInit = function(test){
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

    app.start()
        .then(function(){
            return app.stop();
        })
        .then(function(){
            test.deepEqual(events, [
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
        .catch(function(e){ test.ok(false, e.stack); })
        .finally(function(){ test.done(); })
        .done();
};

/** Test Application-as-a-Service and Object Services
 * @param {test|assert} test
 */
exports.testApplicationAsAService = function(test){
    // Create an app
    var app = new kickapp.Application(function(){
    });

    app.addService('first', { start: function(){}, stop: function(){} });
    app.addService('second', { start: function(){}, stop: function(){} });

    // Create a wrapper app
    var top = new kickapp.Application(function(){
    });

    top.addService('sub-app', app);

    // Events
    var events = new u.EventsCollector();
    events.listenToApp('app', app);
    events.listenToApp('top', top);

    // Test
    [
        // init()
        function(){
            return top.init()
                .then(function(){
                    test.deepEqual(events.log, [
                        'first#init', 'second#init', 'app#init', 'sub-app#init', 'top#init'
                    ]);
                    events.reset();
                });
        },
        // start()
        function(){
            return top.start()
                .then(function(){
                    test.deepEqual(events.log, [
                        'first#start', 'second#start', 'app#start', 'sub-app#start', 'top#start'
                    ]);
                    events.reset();
                });
        },
        // stop()
        function(){
            return top.stop()
                .then(function(){
                    test.deepEqual(events.log, [
                        'second#stop', 'first#stop', 'app#stop', 'sub-app#stop', 'top#stop'
                    ]);
                    events.reset();
                });
        }
    ].reduce(Q.when, Q(1))
        .catch(function(e){ test.ok(false, e.stack); })
        .finally(function(){ test.done(); })
        .done();
};
