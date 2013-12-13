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

        this.addService('d1', u.genService(true, false, 100), 'a', 'b'); // promised, no init()
        this.addService('d2', u.genService(true, true, 100),  'c', 'd') // promised, with init()
            .dependsOn('d1');
        this.addService('d3', u.genService(true, true, 100),  'e', 'f') // promised, with init()
            .dependsOn('d1', 'd2');
        this.addService('d4', u.genService(true, true, 100),  'g', 'h') // promised, with init()
            .dependsOn('d3');
        this.addService('z', u.genService(true, true, 100),  'z'); // promised, with init()
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
    events.listen('app', app, ['init', 'start', 'stop']);
    events.listen('d1', app.getServiceWrapper('d1'), ['init', 'start', 'stop']);
    events.listen('d2', app.getServiceWrapper('d2'), ['init', 'start', 'stop']);
    events.listen('d3', app.getServiceWrapper('d3'), ['init', 'start', 'stop']);
    events.listen('d4', app.getServiceWrapper('d4'), ['init', 'start', 'stop']);
    events.listen('z',  app.getServiceWrapper('z'),  ['init', 'start', 'stop']);

    return test.done();

    // Run tests
    return [
        // init()
        function(){
            return app.init()
                .then(function(){
                    // test services states
                    // test events
                    // reset
                    events.reset();
                });
        },
        // start()
        // start() again
        // stop()
        // stop() again
    ].reduce(Q.when, Q(1))
        .catch(function(e){ test.ok(false, e.stack); })
        .finally(function(){ test.done(); })
        .done();
};
