export function Event() {}

// 為 obj 加上三個 event methods: addEventListener, dispatchEvent, removeEventListener
// 以上三個 event methods 都會為 obj 建立一個內部 property 稱為 _listeners
Event.mixin = function(obj) {
  for (var key in Event.prototype) {
    obj[key] = Event.prototype[key];
  }
};

Event.prototype.addEventListener = function(type, listener) {
  this._listeners = this._listeners || {};
  (this._listeners[type] = this._listeners[type] || []).push(listener);
};

Event.prototype.dispatchEvent = function(e) {
  this._listeners = this._listeners || {};
  var fns = this._listeners[e.type];
  if (fns) {
    fns = fns.slice(0);
    for (var i in fns) {
      fns[i](e);
    }
  }
};

Event.prototype.removeEventListener = function(type, listener) {
  this._listeners = this._listeners || {};
  var fns = this._listeners[type];
  if (fns) {
    for (var i in fns) {
      if (fns[i] === listener) {
        fns.splice(i, 1);
        break;
      }
    }
  }
};
