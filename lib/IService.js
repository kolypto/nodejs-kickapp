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
 * @returns {Q?}
 */
IService.prototype.init = function(callback){};

/** Start the service
 * @returns {Q?}
 */
IService.prototype.start = function(callback){};

/** Stop the service
 * @returns {Q?}
 */
IService.prototype.stop = function(callback){};
