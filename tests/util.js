'use strict';

var Q = require('q'),
    _ = require('lodash')
    ;

/** Generate a service constructor
 * @param {Boolean} promised
 *      Make a promised service, or a callback-based one?
 * @param {Boolean} init
 *      Make up an init method?
 * @param {Number} delay
 *      Delay in seconds before a method succeeds
 * @returns {IService}
 */
var genService = exports.genService = function(promised, init, delay){
    var delayService = function(app){
        this.args = _.toArray(arguments).slice(1);
        this.methods = [];
    };
    if (init){
        delayService.prototype.init = function(callback){
            var q = Q.delay(delay).then(function(){
                this.methods.push('init');
            }.bind(this));
            return promised? q : q.nodeify(callback);
        };
    }
    delayService.prototype.start = function(callback){
        var q = Q.delay(delay).then(function(){
            this.methods.push('start');
        }.bind(this));
        return promised? q : q.nodeify(callback);
    };
    delayService.prototype.stop = function(callback){
        var q = Q.delay(delay).then(function(){
            this.methods.push('stop');
        }.bind(this));
        return promised? q : q.nodeify(callback);
    };

    return delayService;
};

/** Events collector
 * @property {Array.<String>} events
 *      The collected events
 * @constructor
 */
var EventsCollector = exports.EventsCollector = function(){
    this.events = [];
};

/** Reset caught events
 */
EventsCollector.prototype.reset = function(){
    this.events = [];
};

/** Listen to some events on an EventEmitter.
 * All caught events are added to {EventsCollector.events} in the following format: 'name#eventName'
 * @param {String} name
 *      Name of the object
 * @param {EventEmitter} em
 *      The EventEmitter to work on
 * @param {Array.<String>} events
 *      Event names to listen to
 */
EventsCollector.prototype.listen = function(name, em, events){
    var self = this;
    _.each(events, function(eventName){
        em.on(eventName, function(){
            self.events.push(name + '#' + eventName);;
        });
    });
};
