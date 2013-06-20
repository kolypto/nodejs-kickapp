'use strict';

var ServiceContainer = require('./ServiceContainer').ServiceContainer,
    util = require('util')
    ;

/** Application: the top-level service
 * @param {Function} App
 *      Application constructor
 * @constructor
 */
var Application = module.exports = function(App){
    ServiceContainer.call(this,  '', this, this, undefined);
    App.call(this);
};
util.inherits(Application, ServiceContainer);
