KickApp
=======

KickApp is an application architecture framework for organizing the logic into runnable services.

Split your logical components into services contained in a top-level Applicaton object,
define service dependencies and launch them all with a single `app.start()`!

Key features:

* Structured application architecture approach
* Service workflow: `init()`, `start()`, `stop()`
* Service dependencies resolution
* Can deal with hierarchical services
* Optional support for promises. Enjoy them if you also feel they're great! :)
* Unit-tested



Table of Contents
=================

* <a href="#core-components">Core Components</a>
    * <a href="#service">Service</a>
        * <a href="#object-service">Object Service</a>
    * <a href="#application">Application</a>
        * <a href="#structure">Structure</a>
            * <a href="#applicationaddservicename-serviceconstructorapplication">Application.addService(name, serviceConstructor):Application</a>
            * <a href="#applicationdependsonname-application">Application.dependsOn(name, ...):Application</a>
            * <a href="#applicationgetservicenameiservice">Application.get(serviceName):IService</a>
            * <a href="#applicationgetservicewrapperservicenameservicewrapper">Application.getServiceWrapper(serviceName):ServiceWrapper</a>
            * <a href="#applicationgetservicenamesarray">Application.getServiceNames():Array.</a>
            * <a href="#applicationisrunningboolean">Application.isRunning():Boolean</a>
        * <a href="#workflow">Workflow</a>
            * <a href="#applicationinitcallback">Application.init(callback)</a>
            * <a href="#applicationstartcallback">Application.start(callback)</a>
            * <a href="#applicationstopcallback">Application.stop(callback)</a>
        * <a href="#events">Events</a>
    * <a href="#servicewrapper">ServiceWrapper</a>
* <a href="#full-example">Full Example</a>
* <a href="#promised-mode">Promised Mode</a>
* <a href="#application-as-a-service">Application as a Service</a>






Core Components
===============

Service
-------

A Service is an arbitrary constructor function or an object that implements the [`IService`](lib/IService.js) interface:

* Its constructor function gets an `Application` as the first argument.
    More arguments can be provided with the `Application.addService()` method.
* It can optionally have the `init()` method: here you can perform some preparation steps
* It must have the `start()` and `stop()` methods which bring your service up and down respectively.

Consider an example:

```js
/** Database service
 * @param {Application} app
 *     The parent Application
 * @param {String} url
 *     Connection string
 * @constructor
 * @implements {IService}
 */
var DbService = function(app, url){
    this.app = app;
    this.url = url;
    this.client = undefined;
};

DbService.prototype.init = function(callback){
    this.client = new DatabaseClient(this.url); // init some imaginary client
    callback();
};

DbService.prototype.start = function(callback){
    this.client.connect(callback);
};

DbService.prototype.stop = function(callback){
    this.client.disconnect(callback);
};
```

Having such a service, you can:

* Add it to an Application
* Define service dependencies
* Launch them all in the correct order

Note: you can use promises: see [Promised Mode](#promised-mode).

### Object Service

If your service is simple, you don't have to implement the constructor and everything. Use an object instead, which is also
a valid service:

```js
var DbService = {
    app: undefined,
    client: new DatabaseClient('db://localhost/'),
    start: function(callback){
        this.client.connect(callback);
    },
    stop: function(callback){
        this.client.disconnect(callback);
    },
};
```

It will automatically get the `app` property when added to the Application.



Application
-----------

An `Application` is the container for your services.

You define an application by creating an instance of it, providing a constructor function as an argument:

```js
var kickapp = require('kickapp');

var App = new kickapp.Application(function(configFile){
    this.config = require(configFile); // init the configuraton

}, 'app/config.js');
```

By design, an `Application` does not have custom start/stop behavior: instead, it wraps services.

### Structure

#### Application.promisedMode(promisedMode):Application
Set the promised mode to `true` or `false`.

See [Promised Mode](#promised-mode).

#### Application.addService(name, serviceConstructor):Application
Add a service to the application.

* `name: String`: Name of the service. Use any reasonable string.
* `serviceConstructor: Function`: Constructor function for an object that implements the [`IService`](lib/IService.js) interface.

Returns: an instance of [`ServiceWrapper`](#servicewrapper) (see below).

This function can also be called inside the Application constructor:

```js
var kickapp = require('kickapp');

var App = new kickapp.Application(function(configFile){
    // Load the configuration
    this.config = require(configFile);

    // Add services
    this.addService('db', require('./services/db.js'), this.config.db );

    this.addService('web', require('./services/web.js'), this.config.web )
        .dependsOn('db'); // Define a dependency on other services

}, 'app/config.js');
```

#### Application.dependsOn(name, ...):Application
Add dependencies for the recently added Service.

When a Service depends on other services, they will be started before starting this one.

#### Application.get(serviceName):IService
Get the Service object by name:

```js
app.get('db').client; // get the Service property
```

#### Application.getServiceWrapper(serviceName):ServiceWrapper
Get the `ServiceWrapper` object by name.

See: [ServiceWrapper](#servicewrapper)

#### Application.getServiceNames():Array.<String>
Get the list of service names added to this Application object.

#### Application.isRunning():Boolean
Check whether the Application is running.

An Application is running if all its services are running.

### Workflow

Service methods are run in the following fashion:

* Service constructors are called immediately whilst you add your services to the Application
* `init()`, `start()`, `stop()` methods are called when the corresponding Application method is called.
  Unlike the constructor, these honor the service dependencies.

#### Application.init(callback)
Call `init()` on all services, honoring the dependencies. Invoke the callback when done.

Note that `IService.init` is optional.

#### Application.start(callback)
Call `start()` on all services, honoring the dependencies. Invoke the callback when done.

If some services were not yet initialized with `init()`, Application does that.

#### Application.stop(callback)
Call `stop()` on all services, honoring the dependencies in reverse order. Invoke the callback when done.

### Events

`Application` is an `EventEmitter` which fires the following events:

* 'init': All services have been initialized
* 'start': All services have been started
* 'stop': All services have been stopped



ServiceWrapper
--------------

Each Service is internally wrapped in `ServiceWrapper` which controls the service state.

* `ServiceWrapper` is an `EventEmitter` which fires the 'init', 'start', 'stop' events of the service
* Contains metainformation about the Service: service, initialized, running, dependencies

Usually, you won't need it. See the source code: [`ServiceWrapper`](lib/kickapp/ServiceWrapper.js).






Full Example
============
```js
var kickapp = require('kickapp');

// Application
var App = new kickapp.Application(function(configFile){ // Application constructor
    // Load the configuration
    this.config = require(configFile);

    // Services
    this.addService(
        'db', // Service name
        require('./services/db.js'), // Service constructor with init()/start()/stop() methods
        this.config.db // Arguments for the Service constructor
    );

    this.addService('web', require('./services/web.js'), this.config.web )
        .dependsOn('db'); // Dependencies on other services

}, 'app/config.js'); // Arguments for the Application constructor

// Launch it
App.start(function(err){
    // callback invoked when all services have started
    if (err)
        console.error('Application.start failed:', err.stack);
    else
        console.log('Application initialized and started!');
});

// Stop the services properly when the application exitsq
process.on('SIGINT', process.exit);
process.on('exit', function(){
    App.stop(function(err){
        if (err)
            console.error('Application.stop failed:', err.stack);
    });
});
```






Promised Mode
=============

If you like promises as much as I do, you'll enjoy the "promised" mode of Application and its services.

In promised mode, both Application and your Services leverage promises in their `init()`, `start()` and `stop()` methods:

```js
var Q = require('q'),
    kickapp = require('kickapp')
    ;

// Service
var DbService = function(app, url){
    this.app = app;
    this.url = url;
    this.client = undefined;
};

DbService.prototype.init = function(){
    this.client = new DatabaseClient(this.url);
    // returns `undefined` as a promise
};

DbService.prototype.start = function(callback){
    return Q.nmcall(this.client, 'connect'); // return a promise
};

DbService.prototype.stop = function(callback){
    return Q.nmcall(this.client, 'disconnect'); // return a promise
};

// Application
var App = new kickapp.Application(function(){
    this.addService('db', DbService, 'db://localhost/');
});

App.start()
    .then(function(){
        console.log('Application initialized and started!');
    })
    .catch(function(err){
        // Application failed to start
        console.error('Application.start failed:', err.stack);
    });
```






Application as a Service
========================

The `Application` object can be used as a service as it implements the `IService` interface.
This allows creating reusable components from sustainable application parts and add them to other applications as a service:

```js
var app = new kickapp.Application(function(){
    // ... init some services
});

var top = new kickapp.Application(function(){
    this.addService('app', app); // added as a service
});
```
