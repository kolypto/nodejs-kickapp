'use strict';

var _ = require('underscore')
    ;

/** Service object interface
 * You don't need to extend from it, just implement
 *
 * @param {Application} app
 *      Root Applicaton object
 * @param {Service} parent
 *      The parent service object
 * @param {Object} options
 *      Arbitrary options for the service
 *
 * @property {ServiceContainer} service
 *
 * @interface
 */
var Service = module.exports = function(app, options){
};

/** Service start routine
 * @param {function(err?,result?)} finish
 *      Finish callback
 */
Service.prototype.start = function(finish){
};

/** Service stop routine
 * @param {function(err?,result?)} finish
 *      Finish callback
 */
Service.prototype.stop = function(finish){
};
