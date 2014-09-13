'use strict';

var Q = require('q'),
    _ = require('lodash')
    ;

/** Provides timer functions which are automatically cleared when the service is stopped.
 *
 * This is especially useful for unit-tests: when the service is stopped -- you're sure no belated timers will ever fire.
 *
 * Supported methods:
 * * setTimeout(), clearTimeout()
 * * setInterval(), clearInterval()
 *
 * Always use the provided clear*() methods to clear timers created via the service so it frees the memory.
 *
 * @param {Application} app
 *      The parent Application
 */
var TimerService = exports.TimerService = function(app){
    this._timeouts = {};
    this._intervals = {};

    // unique id generator :)
    this._uniqid_counter = 0;
    this._uniqid = function(){
        return this._uniqid_counter++;
    }
};

/** Generic routine to register a timer object with a unique id
 *
 * @param {Object} reg
 *      The registry to use
 * @param {Object} timer
 *      The timer object to register
 * @returns {Object} the timer object
 * @private
 */
TimerService.prototype._register_timer = function(reg, timer){
    // Generate a unique timer id
    var id = this._uniqid();

    // Save the timer, return the handle
    reg[id] = timer;

    // Augment the timer object & finish
    timer.__timerservice_id = id;
    return timer;
};

/** Generic routine to clear a timer object
 *
 * @param {Object} reg
 *      The registry to use
 * @param {Object} timer
 *      The timer object to clear
 * @param {function(timer:Object)} clear_func
 *      The clear function to call on the timer
 * @private
 */
TimerService.prototype._clear_timer = function(reg, timer, clear_func){
    // Clear
    clear_func(timer);
    // Forget
    try {
        delete reg[timer.__timerservice_id];
    } catch(e){} // ignore errors
};

/** setTimeout() as a service.
 *
 * @param callback
 * @param delay
 * @returns {Object}
 */
TimerService.prototype.setTimeout = function(callback, delay/*, ...args*/){
    var self = this,
        args = _.toArray(arguments).slice(2) // callback arguments
        ;

    // Register the timer
    var timer = setTimeout(function(){
        // Clean up (since it's not going to fire again)
        self.clearTimeout(timer);
        // Execute callback
        return callback.apply(this, args);
    }, delay);
    return this._register_timer( this._timeouts, timer);
};

/** clearTimeout() as a service.
 *
 * @param timer
 */
TimerService.prototype.clearTimeout = function(timer){
    this._clear_timer(this._timeouts, timer, clearTimeout);
};

/** setInterval() as a service.
 *
 * @param callback
 * @param delay
 * @returns {Object}
 */
TimerService.prototype.setInterval = function(callback, delay/*, ...args*/){
    // Register the timer
    var timer = setInterval.apply(null, arguments)
    return this._register_timer(this._intervals, timer);
};

/** clearInterval() as a service
 *
 * @param timer
 */
TimerService.prototype.clearInterval = function(timer){
    this._clear_timer(this._intervals, timer, clearInterval);
};



TimerService.prototype.start = function(){
};

TimerService.prototype.stop = function(){
    var self = this;

    // Clear all
    _.forEach(this._timeouts,  function(timer){ self.clearTimeout( timer); });
    _.forEach(this._intervals, function(timer){ self.clearInterval(timer); });

    // Full reset
    this._timeouts = {};
    this._intervals = {};
};
