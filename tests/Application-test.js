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

    // Prepare the event listeners
    var events = new u.EventsCollector();
    events.listen('app', app, ['init', 'start', 'stop']);
    events.listen('d1', app.getServiveWrapper('d1'), ['init', 'start', 'stop']);
    events.listen('d2', app.getServiveWrapper('d2'), ['init', 'start', 'stop']);
    events.listen('d3', app.getServiveWrapper('d3'), ['init', 'start', 'stop']);
    events.listen('d4', app.getServiveWrapper('d4'), ['init', 'start', 'stop']);
    events.listen('z',  app.getServiveWrapper('z'),  ['init', 'start', 'stop']);

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
