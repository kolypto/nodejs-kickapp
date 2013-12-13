'use strict';

var util = require('util'),
    events = require('events'),
    Q = require('q'),
    _ = require('lodash')
    ;

/** Service wrapper object
 * @param {Application} app
 *      The owner application
 * @param {String} name
 *      Name of the service
 * @param {Function} serviceConstructor
 *      Service constructor function
 * @param {Array} args
 *      Service constructor arguments
 *
 * @property {Application} app
 *      The owner application
 * @property {String} name
 *      Service name
 * @property {IService} service
 *      Service object
 * @property {Boolean} initialized
 *      Is the service initialized?
 * @property {Boolean} running
 *      Is the service running?
 * @property {Array.<String>} dependencies
 *      Service dependencies
 *
 * @event {ServiceWrapper#init} The service has initialized
 * @event {ServiceWrapper#start} The service has started
 * @event {ServiceWrapper#stop} The service has stopped
 *
 * @constructor
 */
var ServiceWrapper = exports.ServiceWrapper = function(app, name){
    this.app = app;
    this.name = name;

    this.service = undefined;
    this.initialized = false;
    this.running = false;

    this.dependencies = [];
};
util.inherits(ServiceWrapper, events.EventEmitter);

//region Configuration

/** Instantiate a service in the wrapper
 * @param {Object|Function} Service
 *      Service constructor function, or an instantiated object
 * @param {Array} args
 *      Arguments for the service constructor
 * @returns {ServiceWrapper}
 */
ServiceWrapper.prototype.create = function(Service, args){
    // Instantiated object?
    if (!_.isFunction(Service)){
        Service.app = this.app;
        return this.service = Service;
    }

    // Prepare arguments
    args = [this.app].concat(args);

    // Extend
    var WService = function(){
        Service.apply(this, args);
    };
    util.inherits(WService, Service);

    // Instantiate
    this.service = new WService();

    // Finish
    return this;
};

/** Define service dependencies
 * @param {String|Array.<String>} serviceName
 *      Service names this one depends on
 */
ServiceWrapper.prototype.dependsOn = function(serviceName){
    this.dependencies = this.dependencies.concat(
        _.isArray(arguments[0])? arguments[0] : _.toArray(arguments)
    );
};

//endregion

//region Workflow

/** Initialize the service
 * @fires ServiceWrapper#init
 * @returns {Q} promise
 */
ServiceWrapper.prototype.init = function(){
    // Once
    if (this.initialized)
        return Q.fulfill();
    // Init
    return (this.service.init ? Q.mcall(this.service, 'init') : Q())
        .then(function(){
            this.emit('init');
            this.initialized = true;
        }.bind(this));
};

/** Start the service
 * @fires ServiceWrapper#start
 * @returns {Q} promise
 */
ServiceWrapper.prototype.start = function(){
    // Once
    if (this.running)
        return Q.fulfill();
    // Init
    return Q.mcall(this.service, 'start')
        .then(function(){
            this.emit('start');
            this.running = true;
        }.bind(this));
};

/** Stop the service
 * @fires ServiceWrapper#stop
 * @returns {Q} promise
 */
ServiceWrapper.prototype.stop = function(){
    // Once
    if (!this.running)
        return Q.fulfill();
    // Init
    return Q.mcall(this.service, 'stop')
        .then(function(){
            this.emit('stop');
            this.running = false;
        }.bind(this));
};

//endregion
