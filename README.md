KickApp
=======

KickApp is an application architecture framework with pluggable services.

Organize your application into hierarchical services wrapped
with the top-level Application object, `start()` it and enjoy the *ordnung*!



Components
==========

The `Application` component
---------------------------

An Application is the root for all services, capable of containing other services.
You define an application by creating an instance of it, providing a constructor function as an argument.

By design, an `Application` does not have custom start/stop behavior: instead, it wraps services:

```js
// Config reader of your choice
var nconf = require('nconf');
nconf.argv().file('config.json');

// Define the App
var app = new kickapp.Application(function(){
    this.nconf = nconf; // will be exposed to services
});
```

Note that the the constructor has no options: being the root object, it uses variables of the outer scope.

Assuming you have some services defined, you attach them to the applcation and start all of them by starting the application:

```js
var services = require('./services');

// Add child services
app.addChild('db', services.DbService, { host: 'localhost' });
app.addChild('db.methods', services.DbMethodsService, {}); // use dot notation for hierarchical services

// Start them all
app.start(function(err){
    if (err)
        console.error('Failed to start: ', err);
    else
        console.log('Started successfully');
});
```



`Service` Interface
-------------------

A service is anything that implements the `Service` interface:

* Its constructor receives two arguments:

    * `app` is the root Application
    * `options` is a custom configuration object

* Must have a `start(callback)` method which launches the service asynchronously
* Must have a `stop(callback)` method which halts the service asynchronously
* The `callback` is a `function(err:String?, result)` used to report success or failure.
* Being part of the `kickapp` framework, it receives the `service` property with its `ServiceContainer` (see below)

A service interface is defined in `kickapp.Service`. You do not necessarily inherit from it:
implementing two methods is just enough.

Internally, when you `start()` an Application, all child services are `start()`ed with the help of
[`async.series`](https://github.com/caolan/async).

Here's a naive example of a service:

```js
var DbService = function(app, options){
    this.db = new DB(options.host);
};

DbService.prototype.start = function(callback){
    var promise = this.db.connect(callback);
};

DbService.prototype.stop = function(callback){
    this.db.disconnect();
    callback();
};
```

Note that you never instantiate a service manually: kickapp framework does this for you.



The `ServiceContainer` component
--------------------------------

A `ServiceContainer` is an object that wraps a `Service` along with its related data, including:

* `name` of the service
* A list of child services: `children`
* The `parent` service
* Whether the service is `running`

It also defines the following methods:

* `start(callback)`, which launches the service itself and its child services.
    The service starts first, then the children are started recursively.
* `stop(callback)`, which halts the service and its child services.
    The children are stopped first, then the service stops.
* `addChild(name, Service, options)` wrapper that creates a child `Service(app, options)`, wraps it with a
`ServiceContainer` and maintains the parent-child relationship.
* `getService(name)` allows you to get a `Service` by name. Dot-notation is supported to get child services
* `getName()` returns the qualified service name
* `getDescendants()` returns the list of all service descendants

Internally, an `Application` is a pure `ServiceContainer`, augmented with the constructor function.

Each Service you define is wrapped into a ServiceContainer when you use the `addChild()` method. The Service becomes
a property of the ServiceContainer, and the Service gets a reference to its wrapper: both are named `service`.

A `ServiceContainer` is an `EventEmitter` with the following events available:

* `'start' (svc: Service)` - when the service is about to start.
* `'started' (svc: Service)` - when the service is started, as well as all its children
* `'stop' (svc: Service)` - when the service is about to stop
* `'stopped' (svc: Service)` - when the service is stopped, as well as all its children


### Winston Integration
KickApp can integrate with [winston](https://github.com/flatiron/winston) by creating a separate logger for each
of your services.

`ServiceContainer.winston(options)`, when called on the Application object, walks through all of your services and
creates a `winston.Logger` on it. All loggers are created in a `winston.Container`, which allows you to fetch them
by name which coincides with the qualified name of the service.

`options` is an object with the following properties available:

* `container` is the `winston.Container` to use for all created loggers. Defaults to `winston.loggers`
* `logger_config` is a function which, given the service, returns a winston config for the logger:
    see [Container.add](https://github.com/flatiron/winston#working-with-multiple-loggers-in-winston).

    The function has the following footprint: `function(service_name: String, service: Service):Object?`.
    It should return a config object, or `undefined` to have the defaults.

    With the help of this you can have different log targets and levels for all of your services.
* `levels` Allows to override the set of available log levels.
    See [Logging Levels](https://github.com/flatiron/winston#logging-levels).
* `service_log` is the name of the propery on your Service object which gets the Logger instance.
    You can then call `.log()` method on it and all other stuff defined by winston.

    Default: `'log'`
* `decorate` is a function which alters the message before logging.
    Give it a `true` to have a cute default: each message prefixed by the "[service name]".

    Default: `true`
* `propagate`, when `true`, propagates all log events to parent services' loggers, up and up,
    right to the final root logger. This makes all loggers installed on parent services log the same event as well.
    
    The idea originates from python's [logging](http://docs.python.org/3.3/library/logging.html#logging.Logger.propagate)
    facility.
* `propagate_root` is the name of the root logger which catches _all_ events of the child services.

    The root logger is not created automatically: you need to make it in advance.

    Default: `'root'`

Example usage:

```js
var app = new kickapp.Application(function(){
    // Keep your configs separate
    var cfg = this.config = {
        loggers: {
            root: {
                // only root logger prints to console
                console: { level: 'silly', colorize: true, timestamp: true },
                file: { level: 'warn', filename: 'logs/app.log', json: false }
            },
            service1: {
                file: { level: 'debug', filename: 'logs/service1.log', json: false }
            },
            'service1.child': {
                file: { silent: true }
            }
        }
    };

    // Init some services
    this.addChild('service1', ... );
    this.addChild('service1.child', ... );

    // Create the root logger for propagation
    this.log = winston.loggers.add('root', cfg.loggers.root);

    // Set up services' logging
    this.winston({
        logger_config: function(service_name, service){ // logger configurator
            return cfg.loggers[service_name]; // get the config. 
            // `undefined` will make winston() use the defaults
        },
        propagate: true // yeat, propagate
    });

    // Now each of your services can start using `this.log` Logger object
});
```
