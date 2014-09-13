'use strict';

var graph = require('../lib/kickapp/graph'),
    expect = require('chai').expect
    ;

describe('Topological sort', function(){
    it('plain sort', function(){
        var G = {
            'a': [],
            'b': [],
            'c': [],
            'd': [],
        };
        expect(graph.toposort(G)).to.deep.equal(['a','b','c','d']);
    });
    
    it('1 dependency', function(){
        var G = {
            'a': ['d'],
            'b': [],
            'c': [],
            'd': [],
        };
        expect(graph.toposort(G)).to.deep.equal(['d','a','b','c']);
    });
    
    it('2 dependencies', function(){
        var G = {
            'a': ['d','b'],
            'b': [],
            'c': [],
            'd': [],
        };
        expect(graph.toposort(G)).to.deep.equal(['d','b','a','c']);
    });
    
    it('2 + 1  dependencies', function(){
        var G = {
            'a': ['d','b'],
            'b': [],
            'c': [],
            'd': ['b'],
        };
        expect(graph.toposort(G)).to.deep.equal(['b','d','a','c']);
    });
    
    it('2 + 2 dependencies', function(){
        var G = {
            'a': ['d','b'],
            'b': ['c'],
            'c': [],
            'd': ['b'],
        };
        expect(graph.toposort(G)).to.deep.equal(['c','b','d','a']);
    });
    
    it('2 + 3 looped dependencies', function(){
        var G = {
            'a': ['d','b'],
            'b': ['c'],
            'c': ['a'],
            'd': ['b'],
        };
        expect(function(){ graph.toposort(G); }).to.throw(Error, 'Cyclic dependency: a:d,b ; b:c ; c:a ; d:b');
    });
    
    it('complex dependencies', function(){
        var G = {
            '7': ['11', '8'],
            '5': ['11'],
            '3': ['8', '10'],
            '11': ['2','9','10'],
            '8': ['9'],
            '2': [],
            '9': [],
            '10': []
        };
        expect(graph.toposort(G)).to.deep.equal(['9', '8', '10', '3', '2', '11', '5', '7']);
    });
});
