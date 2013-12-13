'use strict';

/** Service interface
 * Implement it in order to use a service with KickApp
 * @param {Application} app
 *      The parent application
 * @param {..args}
 *      Arbitrary arguments from {Application#addService}
 * @interface
 */
var IService = exports.IService = function(app){
};

/** Initialize a service.
 * This method is optional.
 * @param {function(Error?)?} callback
 *      Finish callback.
 *      When the parent application is in promised mode, you can return a promise instead.
 * @returns {Q?}
 */
IService.prototype.init = function(callback){};

/** Start the service
 * @param {function(Error?)?} callback
 *      Finish callback.
 *      When the parent application is in promised mode, you can return a promise instead.
 * @returns {Q?}
 */
IService.prototype.start = function(callback){};

/** Stop the service
 * @param {function(Error?)} callback
 *      Finish callback.
 *      When the parent application is in promised mode, you can return a promise instead.
 * @returns {Q?}
 */
IService.prototype.stop = function(callback){};
