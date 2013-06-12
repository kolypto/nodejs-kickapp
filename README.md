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
    this.db = new DB(options.host); //
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

* `start(callback)`, which launches the service itself and its child services
* `stop(callback)`, which halts the service and its child services
* `addChild(name, Service, options)` wrapper that creates a child `Service(app, options)`, wraps it with a
`ServiceContainer` and maintains the parent-child relationship.
* `getService(name)` allows you to get a `Service` by name. Dot-notation is supported to get child services

Internally, an `Application` is a pure `ServiceContainer`, augmented with the constructor function.
