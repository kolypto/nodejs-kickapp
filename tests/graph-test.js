'use strict';

var graph = require('../lib/kickapp/graph')
    ;

/** Test topological sort
 * @param {test|assert} test
 */
exports.testToposort = function(test){
    var G;

    // Plain
    G = {
        'a': [],
        'b': [],
        'c': [],
        'd': [],
    };
    test.deepEqual(graph.toposort(G), ['a','b','c','d']);

    // 1 dep
    G = {
        'a': ['d'],
        'b': [],
        'c': [],
        'd': [],
    };
    test.deepEqual(graph.toposort(G), ['d','a','b','c']);

    // 2 dep
    G = {
        'a': ['d','b'],
        'b': [],
        'c': [],
        'd': [],
    };
    test.deepEqual(graph.toposort(G), ['d','b','a','c']);

    // 2 dep, 1 dep
    G = {
        'a': ['d','b'],
        'b': [],
        'c': [],
        'd': ['b'],
    };
    test.deepEqual(graph.toposort(G), ['b','d','a','c']);

    // 2 dep, 2 dep
    G = {
        'a': ['d','b'],
        'b': ['c'],
        'c': [],
        'd': ['b'],
    };
    test.deepEqual(graph.toposort(G), ['c','b','d','a']);

    // 2 dep, 3 dep, loop
    G = {
        'a': ['d','b'],
        'b': ['c'],
        'c': ['a'],
        'd': ['b'],
    };
    test.throws(function(){
        graph.toposort(G);
    }, Error);

    // Complex
    G = {
        '7': ['11', '8'],
        '5': ['11'],
        '3': ['8', '10'],
        '11': ['2','9','10'],
        '8': ['9'],
        '2': [],
        '9': [],
        '10': []
    };
    test.deepEqual(graph.toposort(G), ['9', '8', '10', '3', '2', '11', '5', '7']);

    test.done();
};
