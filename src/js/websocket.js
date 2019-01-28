import { Event } from './event';

const debug = require('debug')('js:websocket.js')

export function Websocket(url) {
  this._conn = new WebSocket(url);
  this._conn.binaryType = "arraybuffer";
  this._conn.addEventListener('open', this._onOpen.bind(this));
  this._conn.addEventListener('message', this._onMessage.bind(this));
  this._conn.addEventListener('error', this._onError.bind(this));
  this._conn.addEventListener('close', this._onClose.bind(this));
};

Event.mixin(Websocket.prototype);

Websocket.prototype._onOpen = function(e) {
  debug('onOpen')
  this.dispatchEvent(new CustomEvent('open'));
};

Websocket.prototype._onMessage = function(e) {
  debug('onMessage')
  var data = new Uint8Array(e.data);
  this.dispatchEvent(new CustomEvent('data', {
    detail: {
      data: String.fromCharCode.apply(String, data)
    }
  }));
};

Websocket.prototype._onError = function(e) {
  debug('onError')
  this.dispatchEvent(new CustomEvent('error'));
};

Websocket.prototype._onClose = function(e) {
  debug('onClose')
  this.dispatchEvent(new CustomEvent('close'));
};

Websocket.prototype.send = function(str) {
  // XXX: move this to app.
  // because ptt seems to reponse back slowly after large
  // chunk of text is pasted, so better to split it up.
  var chunk = 1000;
  for (var i = 0; i < str.length; i += chunk) {
    var chunkStr = str.substring(i, i+chunk);
    var byteArray = new Uint8Array(chunkStr.split('').map(function(x) { return x.charCodeAt(0); }));
    this._conn.send(byteArray.buffer);
  }
};

Websocket.prototype.close = function() {
  this._conn.close();
};
