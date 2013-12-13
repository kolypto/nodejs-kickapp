'use strict';

var util = require('util'),
    events = require('events'),
    Q = require('q'),
    _ = require('lodash'),
    ServiceWrapper = require('./ServiceWrapper').ServiceWrapper
    ;

/** Application: a collection of services
 *
 * @param {Function} App
 *      Application constructor
 * @param {..args} args
 *      Application constructor arguments
 *
 * @event {Application#init} The application has initialized
 * @event {Application#start} The application has started
 * @event {Application#stop} The application has stopped
 *
 * @constructor
 * @implements {IService}
 */
var Application = exports.Application = function(App){
    /** Using promised mode?
     * @type {Boolean}
     * @protected
     */
    this._promised = false;

    /** Application services
     * @type {Object.<String, ServiceWrapper>}
     * @protected
     */
    this._services = {};

    // Init the application
    App.call(this, _.toArray(arguments).slice(1));
};

//region Configuration

/** Set the Application promised mode.
 * In promised mode, the Application itself and its services are using promises instead of callbacks.
 * @param {Boolean} promisedMode
 *      Promised mode
 * @returns {Application}
 */
Application.prototype.promisedMode = function(promisedMode){
    this._promised = promisedMode;
    return this;
};

/** Add a service
 * @param {String} name
 *      Service name
 * @param {Function} serviceConstructor
 *      Service constructor which implements the {IService} interface
 * @param {..args}
 *      Service constructor arguments
 * @returns {ServiceWrapper}
 */
Application.prototype.addService = function(name, serviceConstructor){
    var service = new ServiceWrapper(this, name);
    service.create(serviceConstructor, _.toArray(arguments).slice(2));
    this._services[name] = service;
    return service;
};

//endregion

//region Structure

/** Get a service by name
 * @param {String} serviceName
 *      Name of the service to get
 * @returns {ServiceWrapper}
 * @throws {Error} on unknown service
 */
Application.prototype.getServiveWrapper = function(serviceName){
    if (!(serviceName in this._services))
        throw new Error('Undefined kickapp service: '+ serviceName);
    return this._services[serviceName];
};

/** Get a service by name
 * @param {String} serviceName
 *      Name of the service to get
 * @returns {IService}
 * @throws {Error} on unknown service
 */
Application.prototype.get = function(serviceName){
    return this.getServiveWrapper(serviceName).service;
};

/** Is the Application running?
 * An Application is running if all its services are running
 * @returns {Boolean}
 */
Application.prototype.isRunning = function(){
    return _.all(
        _.pluck(this._services, 'running')
    );
};

//endregion

//region Workflow

/** Resolve service dependencies and generate the run sequence
 * @returns {Array.<ServiceWrapper>}
 * @protected
 */
Application.prototype._servicesSequence = function(){
    var sequence = [];

    // TODO: Resolve service dependencies and produce a sequence

    // Add other services
    sequence = sequence.concat(
        _.difference(sequence, _.keys(this._services))
    );

    // Convert to services
    var self = this;
    return sequence.map(function(serviceName){
        return self.getServiveWrapper(serviceName);
    });
};

/** Initialize services.
 * Runs init() on each, honoring the dependencies graph.
 * @param {function(Error?)} callback
 *      Callback to invoke when done.
 *      Not used in promised mode.
 * @returns {Q} promise
 */
Application.prototype.init = function(callback){
    var q = this._servicesSequence().map(function(service){
        return service.init.bind(service);
    }).reduce(Q.when, Q(1))
        .then(_.partial(this.emit.bind(this), 'init'));
    return this._promised? q : q.nodeify(callback);
};

/** Start services.
 * Runs start() on each, honoring the dependencies graph.
 * @param {function(Error?)} callback
 *      Callback to invoke when done.
 *      Not used in promised mode.
 * @returns {Q} promise
 */
Application.prototype.start = function(callback){
    var q = this._servicesSequence().map(function(service){
        return service.start.bind(service);
    }).reduce(Q.when, Q(1))
        .then(_.partial(this.emit.bind(this), 'start'));
    return this._promised? q : q.nodeify(callback);
};

/** Initialize services.
 * Runs stop() on each, honoring the dependencies graph.
 * @param {function(Error?)} callback
 *      Callback to invoke when done.
 *      Not used in promised mode.
 * @returns {Q} promise
 */
Application.prototype.stop = function(callback){
    var q = this._servicesSequence().reverse().map(function(service){
        return service.stop.bind(service);
    }).reduce(Q.when, Q(1))
        .then(_.partial(this.emit.bind(this), 'stop'));
    return this._promised? q : q.nodeify(callback);
};

//endregion
