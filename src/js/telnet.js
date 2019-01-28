// Handle Telnet Connections according to RFC 854

import { Event } from './event';
import { u2b, ansiHalfColorConv } from './string_util';

const debug = require('debug')('js:telnet.js')

// Telnet commands
// https://tools.ietf.org/html/rfc854
// \x 是 hex 的意思，可能是因為 ptt 是用 C 寫的，所以用 C 看得懂的方式送 command 
const SE = '\xf0';
const NOP = '\xf1';
const DATA_MARK = '\xf2';
const BREAK = '\xf3';
const INTERRUPT_PROCESS = '\xf4';
const ABORT_OUTPUT = '\xf5';
const ARE_YOU_THERE = '\xf6';
const ERASE_CHARACTER = '\xf7';
const ERASE_LINE = '\xf8';
const GO_AHEAD  = '\xf9';
const SB = '\xfa';

// Option commands
const WILL  = '\xfb';
const WONT  = '\xfc';
const DO = '\xfd';
const DONT = '\xfe';
const IAC = '\xff';

// Telnet options
const ECHO  = '\x01';
const SUPRESS_GO_AHEAD = '\x03';
const TERM_TYPE = '\x18';
const IS = '\x00';
const SEND = '\x01';
const NAWS = '\x1f';

// state
const STATE_DATA=0;
const STATE_IAC=1;
const STATE_WILL=2;
const STATE_WONT=3;
const STATE_DO=4;
const STATE_DONT=5;
const STATE_SB=6;

export function TelnetConnection(socket) { // socket here is new Websocket(url)
  this.socket = socket;
  this.socket.addEventListener('open', this._onOpen.bind(this));
  this.socket.addEventListener('data', this._onDataAvailable.bind(this));
  this.socket.addEventListener('close', this._onClose.bind(this));

  this.state = STATE_DATA;
  this.iac_sb = '';

  this.termType = 'VT100';
}

// 為 TelnetConnection.prototype 加上三個 methods: addEventListener, dispatchEvent, removeEventListener 及一個內部 property: _listeners
// 因為我們自創的 TelnetConnection 並沒有像 Websocket 有內建以上三個 methods
// pttchrome.js 中會用到 addEventListener open, close, data
Event.mixin(TelnetConnection.prototype);

//#region socket events handlers
// 負責送出 CustomEvent: open
TelnetConnection.prototype._onOpen = function(e) {
  debug('onOpen')
  // https://developer.mozilla.org/zh-TW/docs/Web/API/CustomEvent/CustomEvent
  this.dispatchEvent(new CustomEvent('open'));
};

// 負責送出 CustomEvent: close
TelnetConnection.prototype._onClose = function(e) {
  debug('onClose')
  this.dispatchEvent(new CustomEvent('close'));
};

//#region NOTE: on socket event: data event handlers
// TODO: 應該是送出 CustomEvent: data 之前先做一些「處理」
// NOTE: 當 data 是登入畫面時，其實無異於直接 _dispatchData 出去 pttchrome.js
// http://140.134.131.145/upload/paper_uni/922pdf/4d/922014.pdf
TelnetConnection.prototype._onDataAvailable = function(e) {
  debug('onDataAvailable-------------------------------------')

  var str = e.detail.data;
  debug('init str:', str)

  var data='';

  var count = str.length;
  debug('init count:', count)

  while (count > 0) {
    debug('exec a while loop')

    var s = str;
    debug('s:', s)

    count -= s.length;
    debug('count:', count)

    var n = s.length;
    debug('n:', n)

    for (var i = 0; i < n; ++i) {
      var ch = s[i];


      switch (this.state) {
        case STATE_DATA:
          if( ch == IAC ) {
            if (data) {
              this._dispatchData(data);
              data='';
            }
            this.state = STATE_IAC;
          } else {
            data += ch;
          }
          break;
        case STATE_IAC:
          switch (ch) {
          case WILL:
            this.state=STATE_WILL;
            break;
          case WONT:
            this.state=STATE_WONT;
            break;
          case DO:
            this.state=STATE_DO;
            break;
          case DONT:
            this.state=STATE_DONT;
            break;
          case SB:
            this.state=STATE_SB;
            break;
          default:
            this.state=STATE_DATA;
          }
          break;
        case STATE_WILL:
          switch (ch) {
          case ECHO:
          case SUPRESS_GO_AHEAD:
            this._sendRaw( IAC + DO + ch );
            break;
          default:
            this._sendRaw( IAC + DONT + ch );
          }
          this.state = STATE_DATA;
          break;
        case STATE_DO:
          switch (ch) {
          case TERM_TYPE:
            this._sendRaw( IAC + WILL + ch );
            break;
          case NAWS:
            // Don't respond.
            //this._sendRaw( IAC + WILL + ch );
            //this.sendNaws();
            break;
          default:
            this._sendRaw( IAC + WONT + ch );
          }
          this.state = STATE_DATA;
          break;
        case STATE_DONT:
        case STATE_WONT:
          this.state = STATE_DATA;
          break;
        case STATE_SB: // sub negotiation
          this.iac_sb += ch;
          if ( this.iac_sb.slice(-2) == IAC + SE ) {
            // end of sub negotiation
            switch (this.iac_sb[0]) {
            case TERM_TYPE: 
              // FIXME: support other terminal types
              //var termType = this.app.__prefs__.TermType;
              var rep = IAC + SB + TERM_TYPE + IS + this.termType + IAC + SE;
              this._sendRaw( rep );
              break;
            }
            this.state = STATE_DATA;
            this.iac_sb = '';
            break;
          }
      }
    }
    if (data) {
      this._dispatchData(data);
      data='';
    }
  }
};

// 負責送出 CustomEvent: data
TelnetConnection.prototype._dispatchData = function(data) {
  this.dispatchEvent(new CustomEvent('data', {
    detail: {
      data: data
    }
  }));
};
//#endregion
//#endregion

//#region NOTE: send 資料，有分 raw 或 conv
// 直接送 hex code request
TelnetConnection.prototype.send = function(str) {
  // XXX Should do escape on IAC.
  this._sendRaw(str);
};

TelnetConnection.prototype._sendRaw = function(data) {
  if (data) {
    this.socket.send(data);
  }
}

// 送 utf8 request
TelnetConnection.prototype.convSend = function(unicode_str) {
  // supports UAO
  // when converting unicode to big5, use UAO.

  var s = u2b(unicode_str);
  // detect ;50m (half color) and then convert accordingly
  if (s) {
    s = ansiHalfColorConv(s);
    this._sendRaw(s);
  }
};
//#endregion

TelnetConnection.prototype.sendNaws = function(cols, rows) {
  var nawsStr = String.fromCharCode(Math.floor(cols/256), cols%256, Math.floor(rows/256), rows%256).replace(/(\xff)/g,'\xff\xff');
  var rep = IAC + SB + NAWS + nawsStr + IAC + SE;
  this._sendRaw( rep );
};
