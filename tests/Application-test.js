'use strict';

var _ = require('lodash'),
    Q = require('q'),
    kickapp = require('../'),
    u = require('./util')
    ;


/** Test the Application and its services
 * @param {test|assert} test
 */
exports.testApplication = function(test){
    // Prepare the app
    var app = new kickapp.Application(function(){
        this.a = 1;
        this.b = 2;

        this.addService('d1', u.promisedService(false, 10), 'a', 'b'); // promised, no init()
        this.addService('d2', u.promisedService(true, 10),  'c', 'd') // promised, with init()
            .dependsOn('d1');
        this.addService('d3', u.promisedService(true, 10),  'e', 'f') // promised, with init()
            .dependsOn('d1', 'd2');
        this.addService('d4', u.promisedService(true, 10),  'g', 'h') // promised, with init()
            .dependsOn('d3');
        this.addService('z', u.promisedService(true, 10),  'z'); // promised, with init()
    }).promisedMode(true);

    // Test structure
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
    test.deepEqual(app.get('z'),  { args: ['z'],     methods: [] });

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
                    test.deepEqual(app.get('d1').methods, []); // no init method
                    test.deepEqual(app.get('d2').methods, ['init']);
                    test.deepEqual(app.get('d3').methods, ['init']);
                    test.deepEqual(app.get('d4').methods, ['init']);
                    test.deepEqual(app.get('z').methods, ['init']);
                    // test events
                    test.deepEqual(events.events, [
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
                    // test events
                    test.deepEqual(events.events, [
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
                    // test events
                    test.deepEqual(events.events, ['app#start']); // all services were started
                    // reset
                    events.reset();
                });
        },
        // stop()
        function(){
            return app.stop()
                .then(function(){
                    // test events
                    test.deepEqual(events.events, [
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
                    // test events
                    test.deepEqual(events.events, ['app#stop']); // all services were stopped
                    // reset
                    events.reset();
                });
        }
    ].reduce(Q.when, Q(1))
        .catch(function(e){ test.ok(false, e.stack); })
        .finally(function(){ test.done(); })
        .done();
};
