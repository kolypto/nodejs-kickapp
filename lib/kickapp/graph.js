'use strict';

var _ = require('lodash')
    ;

/** Topological sort for graphs
 * Algorithm: http://en.wikipedia.org/wiki/Topological_sorting
 * @param {Object} G
 *      Graph: { a: [ b, c ] }, which means that 'a' has an edge to 'b' and 'c'
 * @returns {Array}
 * @throws {Error}
 */
var toposort = exports.toposort = function(G){
    G = _.cloneDeep(G);

    /** Check whether the vertex has no incoming edged?
     * @param n
     * @returns {Boolean}
     */
    var hasNoIncomingEdges = function(n){
        return _.all(G, function(deps, m){
            return deps.indexOf(n) === -1;
        });
    };

    var L = [], // Empty list that will contain the sorted elements
        S = _.filter(_.keys(G), hasNoIncomingEdges) // Set of all nodes with no incoming edges
        ;

    // While S is non-empty
    var i, m;
    while (S.length){
        var n = S.pop(); // remove a node n from S
        L.unshift(n); // insert n into L

        // for each node m with an edge e from n to m do
        for (i = 0; i<G[n].length; i++){
            // remove edge e from the graph
            m = G[n].splice(i--, 1)[0];

            // if m has no other incoming edges then
            if (hasNoIncomingEdges(m)){
                // insert m into S
                S.push(m);
            }
        }
    }

    // If graph is empty - then it has no cycles
    if (_.all(G, _.isEmpty))
        return L;

    // Graph has at least one cycle
    var cycles = _.map(G, function(ms, n){
        return n + ':' + ms.join(',');
    });
    throw new Error('Cyclic dependency: ' + cycles.join(';'));
};
