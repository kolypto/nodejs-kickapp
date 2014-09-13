[![Version](https://badge.fury.io/js/kickapp.png)](https://npmjs.org/package/kickapp)
[![Dependency Status](https://gemnasium.com/kolypto/nodejs-kickapp.png)](https://gemnasium.com/kolypto/nodejs-kickapp)
[![Build Status](https://travis-ci.org/kolypto/nodejs-kickapp.png?branch=master)](https://travis-ci.org/kolypto/nodejs-kickapp)

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
* Promise-based: using the [q](https://npmjs.org/package/q) package
* Unit-tested



Table of Contents
=================

* <a href="#kickapp">KickApp</a>
* <a href="#table-of-contents">Table of Contents</a>
* <a href="#core-components">Core Components</a>
    * <a href="#service">Service</a>
        * <a href="#object-service">Object Service</a>
    * <a href="#application">Application</a>
        * <a href="#applicationapp-args">Application(App, ...args)</a>
        * <a href="#structure">Structure</a>
            * <a href="#applicationaddservicename-serviceconstructor-argsapplication">Application.addService(name, serviceConstructor, ...args):Application</a>
            * <a href="#applicationdependsonname-namesapplication">Application.dependsOn(name, ...names):Application</a>
            * <a href="#applicationgetservicenameiservice">Application.get(serviceName):IService</a>
            * <a href="#applicationgetservicewrapperservicenameservicewrapper">Application.getServiceWrapper(serviceName):ServiceWrapper</a>
            * <a href="#applicationgetservicenamesarray">Application.getServiceNames():Array.</a>
            * <a href="#applicationisrunningboolean">Application.isRunning():Boolean</a>
        * <a href="#workflow">Workflow</a>
            * <a href="#applicationinit">Application.init()</a>
            * <a href="#applicationstart">Application.start()</a>
            * <a href="#applicationstop">Application.stop()</a>
        * <a href="#events">Events</a>
    * <a href="#servicewrapper">ServiceWrapper</a>
* <a href="#full-example">Full Example</a>
* <a href="#promise-haters">Promise-Haters</a>
* <a href="#application-as-a-service">Application as a Service</a>
* <a href="#bundled-services">Bundled Services</a>
    * <a href="#netservice">NetService</a>
    * <a href="#timerservice">TimerService</a>






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

DbService.prototype.init = function(){
    this.client = new DatabaseClient(this.url); // init some imaginary client
};

DbService.prototype.start = function(){
    return this.client.connect(); // assuming it's promise-based
};

DbService.prototype.stop = function(){
    return this.client.disconnect();
};
```

Having such a service, you can:

* Add it to an Application
* Define service dependencies
* Launch them all in the correct order

### Object Service

If your service is simple, you don't have to implement the constructor and everything. Use an object instead, which is also
a valid service:

```js
var DbService = {
    app: undefined,
    client: new DatabaseClient('db://localhost/'),
    start: function(){
        return this.client.connect();
    },
    stop: function(){
        return this.client.disconnect();
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

### Application(App, ...args)

### Structure

#### Application.addService(name, serviceConstructor, ...args):Application
Add a service to the application.

* `name: String`: Name of the service. Use any reasonable string.
* `serviceConstructor: Function`: Constructor function for an object that implements the [`IService`](lib/IService.js) interface.
* `...args`: Variadic arguments for the service constructor

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

#### Application.dependsOn(name, ...names):Application
Add dependencies for the recently added Service.

When a Service depends on other services, they will be started before starting this one.

Dependencies can be given either as arguments, or as a single array argument.

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

#### Application.init()
Call `init()` on all services, honoring the dependencies. Returns a promise.

Note that `IService.init` is optional.

#### Application.start()
Call `start()` on all services, honoring the dependencies. Returns a promise.

If some services were not yet initialized with `init()`, Application does that.

#### Application.stop()
Call `stop()` on all services, honoring the dependencies in reverse order. Returns a promise.

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
App.start()
    .then(function(){
        console.log('Application initialized and started!');
    })
    .catch(function(err){
        console.error('Application.start failed:', err.stack);
    });

// Stop the services properly when the application exitsq
process.on('SIGINT', process.exit);
process.on('exit', function(){
    App.stop()
        .catch(function(err){
            console.error('Application.stop failed:', err.stack);
        });
});
```






Promise-Haters
==============

If you dislike promises, you can always get back to the old good NodeJS-style callbacks:

```js
var App = new kickapp.Application(function(){
});

App.start().nodeify(function(err){
    if (err)
        console.error('Application.start failed:', err.stack);
    else
        console.log('Application initialized and started!');
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






Bundled Services
================

KickApp comes with some handy bundled services.

NetService
----------

NetService is a helper to wrap `net.Server`, `http.Server`, `https.Server`, `tls.Server`, `dgram.createSocket`
network servers in a KickApp service. It also supports static configuration with generalized interface.

NetService accepts two arguments:

* `config: Object`: Server configuration object:

    * `config.lib: String`: The server type to create.
      Supported values: `'net'` (TCP socket), `'tls'` (TLS socket), `'http'` (HTTP server), `'https'` (HTTPS server),
      `'udp4'` (UDP IPv4 socket), `'udp6'` (UDP IPv6 socket).
    * `config.listen: Array`: Array of arguments for the `listen()` function.

        For `'net'`, `'http'`, `'https'`: port, [hostname], [backlog]

        For `'tls'`: port, [host]

        For `'udp4'`, `'udp6'`: port, [address]

    * `config.options: Object`: Options for the `createServer()` function. See [NodeJS Manual](http://nodejs.org/api/index.html).

        Note: for `'tls'` and `'https'` certificates & stuff, you can optionally specify filenames for the following keys:
        `'pfx', 'key', 'cert', 'ca', 'crl'`.

* `accept: Function`: Method used to accept the incoming connections.

        For `'net', 'tls'`: `function(sock: net.Socket)`

        For `'http'`, `'https'`: `function(req: http.ClientRequest, res: http.ServerResponse)`

        For `'udp4'`, `'udp6'`: `function(msg: String|Buffer, rinfo: Object)`

Wielding the service, you can start/stop it an get error handling:

```js
var app = new kickapp.Application(function(){
    this.addService('net', kickapp.services.NetService,
        { lib: 'net', listen: [6001, 'localhost'] },
        function(sock){
            sock.end('hi');
        }
    );
    this.addService('http', kickapp.services.NetService,
        { lib: 'http', listen: [6080, 'localhost'] },
        function(req, res){
            res.end('hi');
        }
    );
});
```

NetService has the following properties:

* `config`: Server configuration object
* `server`: The created server

TimerService
------------

TimerService handles timers as a Service, which are stopped together with the application.

The service provides the following methods which wrap global counterparts:

* `setTimeout()`, `clearTimeout()`
* `setInterval()`, `clearInterval()`

By using the `set*()` family of methods, you add the timer to the internal service registry, and when the server
is stopped -- it clears the timers automatically.

This is especially important with unit-tests: when unit-testing an application which uses timers -- these continue to
function even after the tested application was restarted for a new test case.

These public methods have same signatures with the methods they wrap, except for the requirement to use these through
the service:

```js
// Define the application
var app = new kickapp.Application(function(){
    // Timers
    this.addService('timer', kickapp.services.TimerService);
    // Custom service that depends on timers
    this.addService('my-service', MyService)
        .dependsOn('timer');
});

// Custom service
function MyService(app){
    this.app = app;
};

MyService.prototype.start = function(){
    // Get the 'timer' service
    this.app.get('timer')
        // beep every second :)
        .setInterval(function(){
            console.log('beep!');
        }, 1000);
};
```

When the application is started with `app.start()`, it starts its services.
The custom service "my-service" sets a timer through the "timers" service.

Now, when the application is stopped through `app.stop()`, the timers service will clear all timers that were set on it.
