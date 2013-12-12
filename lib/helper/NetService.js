'use strict';

var _ = require('lodash'),
    fs = require('fs')
    ;

/** A listening network server service with smart handlers to instantiate http, https, net, tls
 *
 * @param {Application} app
 * @param {{ lib: String, listen: Array, options: Object?, accept: Function }}? options
 *      The configuration used to instantiate the service
 *      Example 'http':  { lib: 'http',  listen: [80],  accept: function(req, res){...} }
 *      Example 'https': { lib: 'https', listen: [443], options: {}, accept: function(){} }
 *      Example 'net':   { lib: 'net',   listen: [99],  options: {}, accept: function(){} }
 *      Example 'tls':   { lib: 'tls',   listen: [99],  options: {}, accept: function(){} }
 *
 * @constructor
 * @extends {kickapp.Service}
 *
 * @property {http.Server|https.Server|net.Server|tls.Server|Server?} server
 */
var NetService = exports.NetService = function(app, options){
    this.server = this._makeServer(options);
};

/** Create a nework server
 * @param {{ lib: String, listen: Array, options: Object?, accept: Function }} srv
 * @return {Server?}
 * @protected
 */
NetService.prototype._makeServer = function(srv){
    if (!srv)
        return undefined;

    /** Walk through tls.createServer() options and load certificates if they are provided as filenames
     * @param options
     */
    var prepareTlsConfig = function(options){
        /** Attempt to load a file if it exists. If not, return the contents as is
         * @param {String} path
         * @returns {String}
         */
        var attemptLoadFile = function(path){
            return fs.existsSync(path)? fs.readFileSync(path) : path;
        };
        var mapLoadFiles = function(v, k){
            return [ k, _.isArray(v) ? _.map(v, attemptLoadFile) : attemptLoadFile(v)]; // load or map()-load
        };
        _(options).chain()
            .pick('pfx', 'key', 'cert', 'ca', 'crl')
            .map(mapLoadFiles)
            .object()
            .defaults(options);
        return options;
    };

    // Instantiate the Server
    var server = {
        get http() { return require('http') .createServer(                                srv.accept); },
        get https(){ return require('https').createServer(prepareTlsConfig(srv.options),  srv.accept); },
        get net()  { return require('net')  .createServer(                (srv.options),  srv.accept); },
        get tls()  { return require('tls')  .createServer(prepareTlsConfig(srv.options),  srv.accept); }
    }[srv.lib];

    // Wrap the listen() method  into a partial which knows its arguments
    server.listen = _.wrap(server.listen, function(listen){
        listen.apply(server, srv.listen);
    });

    return server;
};

NetService.prototype.start = function(finish){
    this.server && this.server.listen();
    finish();
};

NetService.prototype.stop = function(finish){
    this.server && this.server.close(); // keeps existing connections!
    finish();
};



/** Container for multiple network services.
 * Ideal to keep http&https handlers for Express
 *
 * @param {Application} app
 * @param {{ servers: Object.<String, Object?>, accept: Function }} options
 *      `servers` is the servers definition, keyed by server name.
 *      `accept` is the default accept() if a server does not provide one
 *
 * @constructor
 * @extends {kickapp.Service}
 *
 * @property {Object.<String, Server?>} servers
 */
var NetServices = exports.NetServices = function(app, options){
    this.servers = {};
    _(options.servers).each(function(srv, name){
        srv && _(srv).defaults({ accept: options.accept }); // default accept()
        this.addServer(name, srv);
    }.bind(this));
};

NetServices.prototype._makeServer = NetService.prototype._makeServer;

/** Add a server to the service
 * @param {String} name
 * @param {Object} srv
 * @return {NetServices}
 */
NetServices.prototype.addServer = function(name, srv){
    this.servers[name] = this._makeServer(srv);
    return this;
};

NetServices.prototype.start = function(finish){
    _(this.servers).chain().values().compact().invoke('listen');
    finish();
};

NetServices.prototype.stop = function(finish){
    _(this.servers).chain().values().compact().invoke('close'); // keeps existing connections!
    finish();
};
