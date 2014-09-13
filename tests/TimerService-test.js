'use strict';

var expect = require('chai').expect,
    _ = require('lodash'),
    Q = require('q'),
    kickapp = require('../')
    ;

describe('TimerService', function() {
    // Application
    var app = new kickapp.Application(function () {
        this.addService('timer', kickapp.services.TimerService);
    });

    // common stuff
    var indicator = 0,
        timer_svc = app.get('timer'),
        indicator_inc = function () { indicator++ };

    // Application start & stop
    beforeEach(function () {
        indicator = 0; // reset indicator
        return app.start();
    });
    afterEach(app.stop.bind(app));

    define_test_for('setTimeout', 'clearTimeout');
    define_test_for('setInterval', 'clearInterval');

    function define_test_for(setTimeout, clearTimeout){
        describe(setTimeout+'()', function () {
            // Tests
            it('should work', function () {
                // set the timer
                timer_svc[setTimeout](indicator_inc, 1);

                // it did not fire up immediately
                expect(indicator).to.be.equal(0);

                // but it will fire in 1ms
                return Q.delay(10).then(function () {
                    if (setTimeout == 'setTimeout')
                        expect(indicator).to.be.equal(1); // setTimeout() fires only once
                    else
                        expect(indicator).to.be.at.least(1); // setInterval() fires more than once
                });
            });

            it('should clear fine manually', function () {
                // clear the timer
                timer_svc[clearTimeout](
                    timer_svc[setTimeout](indicator_inc, 1)
                );

                // it does not fire at all
                return Q.delay(10).then(function () {
                    expect(indicator).to.be.equal(0);
                });
            });

            it('should get cleared with the service', function () {
                // set the timer
                timer_svc[setTimeout](indicator_inc, 1);

                // stop the service
                timer_svc.stop();

                // it does not fire at all
                return Q.delay(10).then(function () {
                    expect(indicator).to.be.equal(0);
                });
            });
        });
    };
});
