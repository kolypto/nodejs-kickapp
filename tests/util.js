'use strict';

var Q = require('q'),
    _ = require('lodash')
    ;

/** Generate a promised service constructor
 * @param {Boolean} init
 *      Make up an init method?
 * @param {Number} delay
 *      Delay in seconds before a method succeeds
 * @param {Array.<String>?} errors
 *      Method names to place errors in
 * @returns {IService}
 */
var promisedService = exports.promisedService = function(init, delay, errors){
    var Service = function(app){
        this.args = _.toArray(arguments).slice(1);
        this.methods = [];
    };

    var mkMethod = function(name){
        return function(){
            if (errors && errors.indexOf(name))
                throw new Error('Method error: ' + name);
            return Q.delay(delay)
                .then(function(){
                    this.methods.push(name);
                }.bind(this));
        };
    };

    if (init)
        Service.prototype.init = mkMethod('init');
    Service.prototype.start = mkMethod('start');
    Service.prototype.stop = mkMethod('stop');

    return Service;
};

/** Create a callback-based service instead
 * @returns {Service}
 */
var callbackService = exports.callbackService = function(init, delay, errors){
    var service = promisedService.apply(this, arguments);

    ['init', 'start', 'stop'].forEach(function(name){
        if (_.isUndefined(service.prototype[name]))
            return;
        service.prototype[name] = _.wrap(service.prototype[name], function(m, callback){
            return m.call(this).nodeify(callback);
        });
    });
    return service;
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

/** Listen to application & service events
 * @param {String} appName
 * @param {Application} app
 */
EventsCollector.prototype.listenToApp = function(appName, app){
    this.listen(appName, app, ['init', 'start', 'stop']);

    _.each(app.getServiceNames(), function(serviceName){
        this.listen(serviceName, app.getServiceWrapper(serviceName), ['init', 'start', 'stop']);
    }.bind(this));
};
