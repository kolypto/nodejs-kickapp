'use strict';

var vows = require('vows'),
    assert = require('assert'),
    util = require('util'),
    kickapp = require('..');

var Environment = function(){
    // Custom application
    this.app = new kickapp.Application(function(){
        this.config = {a:1, b:2};
    });

    var events = this.events = [];

    // Custom service
    var Service = function(app, options){
        this.name = options.name;
    };
    Service.prototype.start = function(finish){
        events.push('+' + this.name);
        finish();
    };
    Service.prototype.stop = function(finish){
        events.push('-' + this.name);
        finish();
    };

    // Hierarchy
    var s1 = this.app.addChild('s1', Service, {name: 's1'});
    var s2 = this.app.addChild('s2', Service, {name: 's2'});
    var s11 = s1.addChild('s11', Service, {name: 's11'});
    var s111 = s11.addChild('s111', Service, {name: 's111'});
    this.app.addChild('s1.s11.s112', Service, {name: 's112'}); // hierarchical
};

vows.describe('Application') // test suite
    .addBatch({
        // contexts
        'when initialized': {
            // input
            topic: function(){
                return new Environment();
            },
            // run tests against the input
            'no errors should occur': function(topic){
            },
            'no events were emitted': function(topic){
                assert.equal(topic.events.length, 0);
            },
            'structure is correct': function(topic){
                assert.equal(Object.keys(topic.app.children).length, 2);
                assert.deepEqual(
                    ['s1','s2','s1.s11','s1.s11.s111', 's1.s11.s112'].map(function(name){
                        return Object.keys(topic.app.getService(name).service.children).length;
                    }),
                    [1,0,2,0,0]
                );
            },

            // child scope
            'and started': {
                topic: function(env){
                    env.app.start();
                    return env;
                },

                'emitted events should match the set': function(topic){
                    assert.deepEqual(topic.events, ['+s1', '+s11', '+s111', '+s112', '+s2']);
                },
                'all services are running': function(topic){
                    assert.deepEqual(
                        ['','s1','s2','s1.s11','s1.s11.s111', 's1.s11.s112'].map(function(name){
                            return name? topic.app.getService(name).service.running : topic.app.running;
                        }),
                        [true, true, true, true, true, true]
                    );
                },

                'then stopped': {
                    topic: function(env){
                        env.app.stop();
                        return env;
                    },

                    'emitted events should match the set': function(topic){
                        assert.deepEqual(topic.events, ['+s1', '+s11', '+s111', '+s112', '+s2', '-s1', '-s11', '-s111', '-s112', '-s2']);
                    },
                    'all services are not running': function(topic){
                        assert.deepEqual(
                            ['', 's1','s2','s1.s11','s1.s11.s111', 's1.s11.s112'].map(function(name){
                                return name? topic.app.getService(name).service.running : topic.app.running;
                            }),
                            [false, false, false, false, false, false]
                        );
                    }
                }
            }
        },
        'when a service fails to start': {
            topic: function(){
                var app = new kickapp.Application(function(){});
                var svc = app.addChild('test', function(app, options){
                    this.start = function(finish){
                        finish('Failed');
                    };
                    this.stop = function(finish){
                        finish('Failed');
                    };
                }, {});
                return app;
            },
            'an error should be emitted on start': function(topic){
                topic.start(function(e){
                    assert.equal(e, 'Failed');
                });
            }
        }
    })
    //.run();
    .export(module);
