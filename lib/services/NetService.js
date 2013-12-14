'use strict';

var fs = require('fs'),
    Q = require('q'),
    _ = require('lodash')
    ;

/** A network server service for http, https, net or tls.
 * @param {Application} app
 *      The parent Application
 * @param {Object} config
 *      Server configuration
 * @param {String} config.lib
 *      The library to use as a server: http, https, net, tls
 * @param {Array} config.listen
 *      Arguments for the `listen()` method.
 * @param {Object} config.options
 *      Options for createServer(). Consult with the manual: net, https, tls
 *      Note: for TLS and HTTPS, the following keys specify file paths and are synchronously loaded:
 *      'pfx', 'key', 'cert', 'ca', 'crl'
 * @param {Function} accept
 *      Connection accept function to use.
 */
var NetService = exports.NetService = function(app, config, accept){
    if (!config.lib)
        throw new Error('NetService: Invalid `config` argument: ' + config);
    if (!_.isFunction(accept))
        throw new Error('NetService: Invalid `accept` argument: ' + config);

    this.app = app;
    this.server = NetService.makeServer(config, accept);
    this.config = config;
};

/** Load filenames specified for TLS options and replace them with strings
 * @param {{ pfx: String, key: String, cert: String, ca: String, crl: String }} options
 *      TLS options
 * @private
 */
NetService.loadTlsOptions = function(options){
    return _.extend(
        options,
        _.mapValues(
            _.pick(options, ['pfx', 'key', 'cert', 'ca', 'crl']),
            function(val, key){
               return fs.existsSync(val)? fs.readFileSync(val) : val;
            }
        )
    );
};

/** Create a server using its configuration
 * @param {{ lib: String, listen: Array?, options: Object? }} config
 * @param {Function} accept
 * @returns {net.Server|tls.Server|http.Server|https.Server}
 */
NetService.makeServer = function(config, accept){
    _.defaults(config, {
        listen: [],
        options: {}
    });

    // Create the server
    var srv;
    switch (config.lib){
        case 'net':
            srv = require('net') .createServer(accept);
            break;
        case 'http':
            srv = require('http') .createServer(accept);
            break;
        case 'https':
            srv = require('https').createServer(NetService.loadTlsOptions(config.options), accept);
            break;
        case 'tls':
            srv = require('tls') .createServer(NetService.loadTlsOptions(config.options), accept);
            break;
        case 'udp4':
        case 'udp6':
            srv = require('dgram').createSocket(config.lib, accept);
            break;
        default:
            throw new Error('NetService: unknown library: ' + config.lib);
    }

    // Listen
    switch (config.lib){
        case 'net':
        case 'http':
        case 'https':
        case 'tls':
            // Wrap the listen() method  into a partial which knows its arguments
            srv.listen = _.wrap(srv.listen, function(listen){
                listen.apply(srv, config.listen);
            });
            break;
        case 'udp4':
        case 'udp6':
            srv.bind = _.wrap(srv.bind, function(bind){
                bind.apply(srv, config.listen);
            });
            break;
    }

    // Finish
    return srv;
};

NetService.prototype.start = function(){
    var d = Q.defer();

    var onError = function(err){
        d.reject(err);
    };
    var onSuccess = function(){
        d.resolve();
    };

    // Listen
    var srv = this.server;
    srv.on('listening', onSuccess);
    srv.on('error', onError);

    switch(this.config.lib){
        case 'net':
        case 'http':
        case 'https':
        case 'tls':
            srv.listen(); // partial
            break;
        case 'udp4':
        case 'udp6':
            srv.bind(); // partial
            break;
    }

    // Finish
    return d.promise
        .finally(function(){
            srv.removeListener('listening', onSuccess);
            srv.removeListener('error', onError);
        });
};
NetService.prototype.stop = function(){
    switch(this.config.lib){
        case 'net':
        case 'http':
        case 'https':
        case 'tls':
            return Q.nmcall(this.server, 'close'); // keeps existing connections open!
        case 'udp4':
        case 'udp6':
            this.server.close(); // no callback argument
            return;
    }
};
