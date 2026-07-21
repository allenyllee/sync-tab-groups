const EventListener = function() {
  this.events = []; // Empty list of events/actions
}

EventListener.prototype.on = function(event, fn) {
  this.events[event] = this.events[event] || [];
  this.events[event].push(fn);
}

EventListener.prototype.fire = function(event) {
  if (!this.events[event]) {
    return Promise.resolve([]);
  }

  return Promise.all(this.events[event].map(function(fn) {
    return fn();
  }));
}

export default EventListener
