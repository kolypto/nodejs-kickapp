'use strict';

/** Lazy-loaded helpers
 * @property {kickapp.helper.NetService} NetService
 */
module.exports = {
    get NetService(){
        return require('./NetService');
    }
};
