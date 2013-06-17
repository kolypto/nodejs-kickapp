'use strict';

var _ = require('underscore'),
    async = require('async')
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
 *
 * @constructor
 */
var ServiceContainer = exports.ServiceContainer = function(name, service, app, parent){
    this.service = service;
    this.parent = parent;
    this.app = app;
    this.name = name;
    this.children = {};
    this.running = false;
};

/** Start the service
 * @param {function(err:String?, results:Array)} finish
 */
ServiceContainer.prototype.start = function(finish){
    if (this.running)
        return;
    // Start children
    var seq = _(this.children).chain().values().map(function(svc){ return svc.service.start.bind(svc.service); }).value();
    // Start service
    if (this.service.start && !(this.service instanceof ServiceContainer))
        seq.unshift(this.service.start.bind(this.service));
    // Change state
    seq.push(function(finish){
        this.running = true;
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
    // Start children
    var seq = _(this.children).chain().values().map(function(svc){ return svc.service.stop.bind(svc.service); }).value();
    // Start service
    if (this.service.stop && !(this.service instanceof ServiceContainer))
        seq.unshift(this.service.stop.bind(this.service));
    // Change state
    seq.push(function(finish){
        this.running = false;
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
    // Construct the service
    var service = new Service(dest_svc.app, options);
    dest_svc.children[name] = service;
    // Wrap in a container
    var container = new ServiceContainer(name, service, dest_svc.app, dest_svc.service);
    service.service = container;
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
