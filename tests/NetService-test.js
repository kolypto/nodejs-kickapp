'use strict';

var kickapp = require('../'),
    net = require('net'),
    http = require('http'),
    Q = require('q')
    ;

/** Test NetService
 * @param test
 */
exports.testNetService = function(test){
    // Application
    var app = new kickapp.Application(function(){
        this.addService('net', kickapp.services.NetService,
            { lib: 'net', listen: [0, 'localhost'] },
            function(sock){
                sock.end('hi');
            }
        );
        this.addService('http', kickapp.services.NetService,
            { lib: 'http', listen: [0, 'localhost'] },
            function(req, res){
                res.end('hi');
            }
        );

        // TODO: tls service test
        // TODO: https service test
    });

    /**
     * @type {{ http: { address: String, port: Number }, net: { address: String, port: Number } }}
     */
    var addresses = {};

    app.start()
        // Store addresses
        .then(function(){
            addresses.net  = app.get('net') .server.address();
            addresses.http = app.get('http').server.address();
        })
        // Try to talk with the accept function: net
        .then(function(){
            var sock = new net.Socket();

            var d = Q.defer();
            sock.on('data', function(data){
                if (data.toString('utf8') === 'hi')
                    d.resolve();
                else
                    d.reject(new Error('Wrong data received: ' + data));
            });

            return Q.all([
                Q.nmcall(sock, 'connect', addresses.net.port)
                    .then(function(){
                        sock.end();
                    }),
                d.promise
            ]);
        })
        // Try to talk with the accept function: http
        .then(function(){
            var d = Q.defer();

            var req = http.get({ host: addresses.http.address, port: addresses.http.port }, function(res){
                res.once('data', function(data){
                    if (data.toString('utf8') === 'hi')
                        d.resolve();
                    else
                        d.reject(new Error('Wrong data received: ' + data));
                });
            });

            return d.promise
                .timeout(1000, 'HTTP connect timeout');
        })
        // TODO: Try to talk with the accept function: TLS
        // TODO: Try to talk with the accept function: HTTPS
        .catch(function(err){ test.ok(false, err.stack); })
        .finally(function(){ return app.stop(); })
        .finally(function(){ test.done(); })
        .done();
};

/** Test NetService error handling
 * @param {test|assert} test
 */
exports.testNetServiceErrors = function(test){
    // Application
    var app = new kickapp.Application(function(){
        this.addService('net1', kickapp.services.NetService,
            { lib: 'net', listen: [1999, 'localhost'] },
            function(sock){}
        );
        this.addService('net2', kickapp.services.NetService,
            { lib: 'net', listen: [1999, 'localhost'] },
            function(sock){}
        );
    });

    app.start()
        .then(function(){
            test.ok(false, 'app.start() should have failed');
        })
        .catch(function(e){
            test.equal(e.code, 'EADDRINUSE');
            test.equal(app.isRunning(), false);
        })
        .finally(function(){ return app.stop(); })
        .finally(function(){ test.done(); })
        .done();
};
