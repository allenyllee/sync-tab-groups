const Lifecycle = {};

let resolveReady;
let rejectReady;

const readyPromise = new Promise((resolve, reject) => {
  resolveReady = resolve;
  rejectReady = reject;
});

Lifecycle.ready = function() {
  return readyPromise;
};

Lifecycle.complete = function() {
  resolveReady();
};

Lifecycle.fail = function(error) {
  rejectReady(error);
};

export default Lifecycle;
