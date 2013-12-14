'use strict';

var fs = require('fs'),
    Q = require('q'),
    _ = require('lodash')
    ;

/** A network server service for http, https, net or tls.
 * @param {Application} app
 *      The parent Application
 * @param {Object} server
 *      Server configuration
 * @param {String} server.lib
 *      The library to use as a server: http, https, net, tls
 * @param {Array} server.listen
 *      Arguments for the `listen()` method.
 *      For http, https, net:   port, [hostname], [backlog]
 *      For tls:                port, [host]
 * @param {Object} server.options
 *      Options for createServer(). Consult with the manual: net, https, tls
 *      Note: for TLS and HTTPS, the following keys specify file paths and are synchronously loaded:
 *      'pfx', 'key', 'cert', 'ca', 'crl'
 * @param {Function} accept
 *      Connection accept function to use.
 *      For net & tls:      function(sock){}
 *      For http & https:   function(req, res){}
 */
var NetService = exports.NetService = function(app, server, accept){
    this.app = app;
    this.server = NetService.makeServer(server, accept);
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
 * @param {{ lib: String, listen: Array?, options: Object? }} server
 * @param {Function} accept
 * @returns {net.Server|tls.Server|http.Server|https.Server}
 */
NetService.makeServer = function(server, accept){
    _.defaults(server, {
        listen: [],
        options: {}
    });

    // Create the server
    var srv;
    switch (server.lib){
        case 'net':
            srv = require('net') .createServer(accept);
            break;
        case 'http':
            srv = require('http') .createServer(accept);
            break;
        case 'https':
            srv = require('https').createServer(NetService.loadTlsOptions(server.options), accept);
            break;
        case 'tls':
            srv = require('tls') .createServer(NetService.loadTlsOptions(server.options), accept);
            break;
        // TODO: implement UDP sockets
        default:
            throw new Error('NetService: unknown library: ' + server.lib);
    }

    // Wrap the listen() method  into a partial which knows its arguments
    srv.listen = _.wrap(srv.listen, function(listen){
        listen.apply(srv, server.listen);
    });

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
    srv.listen(); // arguments are already stashed in a partial

    // Finish
    return d.promise
        .finally(function(){
            srv.removeListener('listening', onSuccess);
            srv.removeListener('error', onError);
        });
};
NetService.prototype.stop = function(){
    return Q.nmcall(this.server, 'close'); // keeps existing connections open!
};
