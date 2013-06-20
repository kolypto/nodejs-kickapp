'use strict';

var _ = require('underscore'),
    async = require('async'),
    util = require('util'),
    events = require('events')
    ;

/** Container for the Service
 *
 * @param {String} name
 *      Service name
 * @param {Service} service
 *      The owner service object
 * @param {Application} app
 *      The application
 * @param {Service} parent
 *      The parent service
 *
 * @property {Service} service
 *      The service object
 * @property {Service} parent
 *      The parent service
 * @property {String} name
 *      Service name
 * @property {Object.<String, Service>} children
 *      Child services
 * @property {Boolean} running
 *      Is the service running?
 * @property {winston.Logger?} logger
 *      Winston logger for this service (if initialized with .winston())
 *
 * @event 'start' (Service)
 * @event 'started' (Service)
 * @event 'stop' (Service)
 * @event 'stopped' (Service)
 *
 * @constructor
 * @extends {events.EventEmitter}
 */
var ServiceContainer = exports.ServiceContainer = function(name, service, app, parent){
    this.service = service;
    this.parent = parent;
    this.app = app;
    this.name = name;
    this.children = {};
    this.running = false;

    this.logger = undefined;
};
util.inherits(ServiceContainer, events.EventEmitter);

/** Start the service
 * @param {function(err:String?, results:Array)} finish
 */
ServiceContainer.prototype.start = function(finish){
    if (this.running)
        return;
    this.emit('start', this.service);
    // Start children
    var seq = _(this.children).chain().values().map(function(svc){ return svc.service.start.bind(svc.service); }).value();
    // Start service
    if (this.service.start && !(this.service instanceof ServiceContainer))
        seq.unshift(this.service.start.bind(this.service));
    // Change state
    seq.push(function(finish){
        this.running = true;
        this.emit('started', this.service);
        finish();
    }.bind(this));
    async.series(seq, finish);
};

/** Stop the service
 * @param {function(err:String?, results:Array)} finish
 */
ServiceContainer.prototype.stop = function(finish){
    if (!this.running)
        return;
    this.emit('stop', this.service);
    // Stop children
    var seq = _(this.children).chain().values().map(function(svc){ return svc.service.stop.bind(svc.service); }).value();
    // Stop service
    if (this.service.stop && !(this.service instanceof ServiceContainer))
        seq.push(this.service.stop.bind(this.service));
    // Change state
    seq.push(function(finish){
        this.running = false;
        this.emit('stopped', this.service);
        finish();
    }.bind(this));
    async.series(seq, finish);
};

/** Add a child service
 * @param {String} name
 * @param {Function} Service contructor
 * @param {Object} options
 * @return {ServiceContainer}
 */
ServiceContainer.prototype.addChild = function(name, Service, options){
    // Hierarchical name case
    var dest_svc = this;
    if (name.indexOf('.') != -1){
        var path = name.split('.');
        var dest_svc = this.getService(path.slice(0,-1)).service;
        name = path.pop();
    }

    // Create the Service Container
    var container = new ServiceContainer(name, undefined, dest_svc.app, dest_svc.service);

    // Inherit from the service so that the ServiceContainer is available in the constructor
    var WService = function(){
        this.service = container;
        Service.apply(this, arguments);
    };
    util.inherits(WService, Service);

    // Create the service
    container.service = new WService(dest_svc.app, options);

    // Hierarchy
    dest_svc.children[name] = container.service;

    // Finish
    return container;
};



/** Get a service instance by name
 * @param {String|Array.<String>} name
 *      Service name. Use dot-notation to access child services.
 * @return {Service}
 * @throws Error
 */
ServiceContainer.prototype.getService = function(name){
    var path = _.isArray(name)? name : name.split('.');
    for (var i= 0, svc = this.service; i<path.length; i++){
        svc = svc.service.children[  path[i]  ];
        if (svc === undefined)
            throw new Error('Unknown service name: `'+ name +'` (at `'+ path[i] +'`)');
    }
    return svc;
};

/** Get a qualified service name
 * @return {String}
 */
ServiceContainer.prototype.getName = function(){
    var path = [];
    var root = this;
    while (root.parent !== undefined){
        path.unshift(root.name);
        root = root.parent.service;
    }
    return path.join('.');
};

/** Get the list of all descendant services
 * @return {Array.<Service>}
 */
ServiceContainer.prototype.getDescendants = function(){
    return Array.prototype.concat.apply([], _(this.children).values().map(function(svc){
        return [svc].concat(svc.service.getDescendants());
    }));
};



/** Winston integration: create a logger for each descendant service
 * @param {Object} options
 *      - {winston.Container} container
 *              The container to use.
 *      - {function(service_name: String, service: Service):Object?} logger_config
 *              Logger configurator
 *      - {Object?} levels
 *              Custom log levels mapping
 *      - {String?} service_log
 *              The name of the {Service} property to store the logger to.
 *      - {Boolean|function(service: Service, message: String):String} decorate
 *              Decorator to alter the message before logging.
 *      - {Boolean} propagate
 *              Propagate events to parent services?
 *      - {String} propagate_root
 *              Root logger name: all events propagate here.
 * @return {winston.Container}
 */
ServiceContainer.prototype.winston = function(options){
    var winston = require('winston');

    // Defaults
    options = _(options).defaults({
        container: winston.loggers, // winston.Container to add loggers to
        logger_config: undefined, //function(service_name, service){}, // configurator for a single logger
        levels: undefined, //winston.config.npm.levels, // log levels to use
        service_log: 'log', // Service property to store the logger to
        decorate: true, // `true` to decorate messages with the service name. Also: function(service,message){}
        propagate: false, // Initialize events propagation
        propagate_root: 'root' // Root logger to propagate to
    });

    if (options.decorate === true)
        options.decorate = function(service, message){
            if (message.length && message[0] != '[')
                message = '[' + service.service.getName() + '] ' + message;
            return message;
        };

    // Set up loggers for every service
    this.getDescendants().forEach(function(service){
        var service_name = service.service.getName();

        // Get the configuration
        var logger_config = options.logger_config(service_name, service) || {};

        if (options.propagate && logger_config.console === undefined)
            logger_config.console = {silent: true}; // don't let them all log stuff unless explicitly configured to

        // Create & Add
        var logger = options.container.add(service_name, logger_config);

        // Configure
        if (options.levels)
            logger.setLevels(options.levels);

        // Decorate
        if (options.decorate)
            logger.log = _(logger.log).wrap(function(){
                var log = Array.prototype.shift.apply(arguments);
                arguments[1] = options.decorate(service, arguments[1]);
                return log.apply(logger, arguments);
            });

        // Set up the service property
        service.service.logger = logger;
        if (options.service_log)
            service[options.service_log] = logger;
    });

    // Hierarchical loggers: events propagate to the upper level up to 'root'
    var init_propagation = function(container, root_logger){
        _(container.loggers).chain()
            .keys().without(root_logger)
            .each(function(logger_name){
                // Collect parent logger candidates by splitting the hierarchical name
                var parent_loggers = [root_logger]; // ultimate parent
                logger_name
                    .split('.')
                    .reduce(function(path, name){
                        if (path.length)
                            parent_loggers.unshift(path.join('.'));
                        path.push(name);
                        return path;
                    }, []);

                // Discover the closest existing parent logger which gets the propagated events
                var parent_name = parent_loggers.filter(function(name){ // remove loggers that do not exist
                    return container.has(name);
                })[0];
//                console.log(logger_name, ' -> ', parent_name);

                // Now register the propagator
                container.get(logger_name).on('logged', function(level, msg, meta){
                    container.get(parent_name).log(level, msg, meta);
                });
            });
    };

    if (options.propagate)
        init_propagation(options.container, options.propagate_root);

    return options.container;
};
