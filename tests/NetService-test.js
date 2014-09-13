'use strict';

var expect = require('chai').expect,
    kickapp = require('../'),
    net = require('net'),
    http = require('http'),
    dgram = require('dgram'),
    Q = require('q')
    ;


describe('NetService', function(){

    describe('with multiple services', function(){
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

            this.addService('udp4', kickapp.services.NetService,
                { lib: 'udp4', listen: [0, 'localhost'] },
                function(msg, rinfo){
                    app.get('udp4').server.send(
                        new Buffer('hi'), 0, 2,
                        rinfo.port, rinfo.address
                    );
                }
            );

            // TODO: tls service test
            // TODO: https service test
        });

        /** Addresses for every service
         * @type {{
         *          http: { address: String, port: Number },
         *          net: { address: String, port: Number },
         *          udp4: { address: String, port: Number }}}
         */
        var addresses = {};

        before(function(){
            return app.start()
                .then(function(){
                    addresses.net  = app.get('net') .server.address();
                    addresses.http = app.get('http').server.address();
                    addresses.udp4 = app.get('udp4').server.address();
                });
        });
        after(app.stop.bind(app));

        it('should talk with the "net" service', function(){
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
                d.promise.timeout(1000, 'Socket connect timeout')
            ]);
        });

        it('should talk with the "http" service', function(){
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
        });

        it('should talk with the "udp" service', function(){
            var d = Q.defer();

            var sock = dgram.createSocket('udp4', function(msg, rinfo){
                if (msg.toString('utf8') === 'hi')
                    d.resolve();
                else
                    d.reject(new Error('Wrong data received: ' + msg));
            });

            sock.send(
                new Buffer('hello'), 0, 5,
                addresses.udp4.port, addresses.udp4.address,
                function(err, bytes){
                    if (err)
                        d.reject(err);
                }
            );

            return d.promise
                .timeout(1000, 'UDP4 response timeout')
                .finally(function(){ sock.close(); });
        });

        xit('should talk with the "tls" service');
        xit('should talk with the "https" service');
    });

    describe('with conflicting services', function(){
        // Application
        var app = new kickapp.Application(function(){
            // Two conflicting services
            this.addService('net1', kickapp.services.NetService,
                { lib: 'net', listen: [1999, 'localhost'] },
                function(sock){}
            );
            this.addService('net2', kickapp.services.NetService,
                { lib: 'net', listen: [1999, 'localhost'] },
                function(sock){}
            );
        });

        it('should fail to start', function(){
            return app.start()
                .then(function(){
                    throw Error('Unexpectedly started');
                }, function(e){
                    expect(app.isRunning()).to.be.false;
                    expect(e.code).to.be.equal('EADDRINUSE');
                });
        });
    });

});
