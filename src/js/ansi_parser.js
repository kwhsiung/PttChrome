// Parser for ANSI escape sequence
const debug = require('debug')('js:ansi_parser.js')

export function AnsiParser(termbuf) {
  this.termbuf = termbuf;
  this.state = AnsiParser.STATE_TEXT;
  this.esc = '';
};

AnsiParser.STATE_TEXT = 0;
AnsiParser.STATE_ESC = 1;
AnsiParser.STATE_CSI = 2;
AnsiParser.STATE_C1 = 3;

AnsiParser.prototype.feed = function(data) {
  debug('feed() called somewhere, handling...')
  debug('data:', data)

  var term = this.termbuf;
  if (!term)
    return;
  var s = '';
  var n = data.length;
  for (var i = 0; i < n; ++i) {
    var ch = data[i];
    // debug('process character------------------------------')
    // debug('character is:', ch)
    // debug('current state is:', this.state)

    switch (this.state) {
    case AnsiParser.STATE_TEXT:
      switch (ch) {
      case '\x1b':
        // debug('encouter escape character \x1b')
        if (s) {
          term.puts(s);
          s = '';
        }
        this.state = AnsiParser.STATE_ESC;
        break;
      default:
        s += ch;
      }
      break;
    case AnsiParser.STATE_CSI:
      if ( (ch >= '`' && ch <= 'z') || (ch >= '@' && ch <='Z') ) {
        // if(ch != 'm')
        //    dump('CSI: ' + this.esc + ch + '\n');
        var params=this.esc.split(';');
        var firstChar = '';
        if (params[0]) {
          if (params[0].charAt(0)<'0' || params[0].charAt(0)>'9') {
            firstChar = params[0].charAt(0);
            params[0] = params[0].slice(1);
          }
        }
        if (firstChar && ch != 'h' && ch != 'l') { // unknown CSI
          //dump('unknown CSI: ' + this.esc + ch + '\n');
          this.state = AnsiParser.STATE_TEXT;
          this.esc = '';
          break;
        }
        for (var j=0; j<params.length; ++j) {
          if ( params[j] )
            params[j] = parseInt(params[j], 10);
          else
            params[j] = 0;
        }
        switch (ch) {
        case 'm':
          term.assignParamsToAttrs(params);
          break;
        case '@':
          term.insert(params[0]>0 ? params[0] : 1);
          break;
        case 'A':
          term.gotoPos(term.cur_x, term.cur_y-(params[0]?params[0]:1));
          break;
        case 'B':
        case 'e':
          term.gotoPos(term.cur_x, term.cur_y+(params[0]?params[0]:1));
          break;
        case 'C':
        case 'e':
          term.gotoPos(term.cur_x+(params[0]?params[0]:1), term.cur_y);
          break;
        case 'D':
          term.gotoPos(term.cur_x-(params[0]?params[0]:1), term.cur_y);
          break;
        case 'E':
          term.gotoPos(0, term.cur_y+(params[0]?params[0]:1));
          break;
        case 'F':
          term.gotoPos(0, term.cur_y-(params[0]?params[0]:1));
          break;
        case 'G':
        case '`':
          term.gotoPos(params[0]>0?params[0]-1:0, term.cur_y);
          break;
        case 'I':
          term.tab(params[0]>0 ? params[0] : 1);
          break;
        case 'd':
          term.gotoPos(term.cur_x, params[0]>0?params[0]-1:0);
          break;
        /*
        case 'h':
          if (firstChar == '?') {
            var mainobj = term.view.conn.listener;
            switch(params[0]) {
            case 1:
              term.view.cursorAppMode = true;
              break;
            case 1048:
            case 1049:
              term.cur_x_sav = term.cur_x;
              term.cur_y_sav = term.cur_y;
              if (params[0] != 1049) break; // 1049 fall through
            case 47:
            case 1047:
              mainobj.selAll(true); // skipRedraw
              term.altScreen=mainobj.ansiCopy(true); // external buffer
              term.altScreen+=term.ansiCmp(TermChar.newChar, term.attr);
              term.clear(2);
              term.attr.resetAttr();
              break;
            default:
            }
          }
          break;
        case 'l':
          if (firstChar == '?') {
            switch (params[0]) {
            case 1:
              term.view.cursorAppMode = false;
              break;
            case 47:
            case 1047:
            case 1049:
              term.clear(2);
              term.attr.resetAttr();
              if (term.altScreen) {
                this.state = AnsiParser.STATE_TEXT;
                this.esc = '';
                this.feed(term.altScreen.replace(/(\r\n)+$/g, '\r\n'));
              }
              term.altScreen='';
              if (params[0] != 1049) break; // 1049 fall through
            case 1048:
              if (term.cur_x_sav<0 || term.cur_y_sav<0) break;
              term.cur_x = term.cur_x_sav;
              term.cur_y = term.cur_y_sav;
              break;
            default:
            }
          }
          break;
        */
        case 'J':
          term.clear(params ? params[0] : 0);
          break;
        case 'H':
        case 'f':
          if (params.length < 2) {
            term.gotoPos(0, 0);
          } else {
            if (params[0] > 0)
              --params[0];
            if (params[1] > 0)
              --params[1];
            term.gotoPos(params[1], params[0]);
          }
          break;
        case 'K':
          term.eraseLine(params? params[0] : 0);
          break;
        case 'L':
          term.insertLine(params[0]>0 ? params[0] : 1);
          break;
        case 'M':
          term.deleteLine(params[0]>0 ? params[0] : 1);
          break;
        case 'P':
          term.del(params[0]>0 ? params[0] : 1);
          break;
        case 'r': // FIXME: scroll range
          if (params.length < 2) {
            term.scrollStart=0;
            term.scrollEnd=term.rows-1;
          } else {
            if (params[0] > 0)
              --params[0];
            if (params[1] > 0)
              --params[1];
            term.scrollStart=params[0];
            term.scrollEnd=params[1];
          }
          break;
        case 's':
          term.cur_x_sav=term.cur_x;
          term.cur_y_sav=term.cur_y;
          break;
        case 'u':
          if (term.cur_x_sav<0 || term.cur_y_sav<0) break;
          term.cur_x = term.cur_x_sav;
          term.cur_y = term.cur_y_sav;
          break;
        case 'S':
          term.scroll(false, (params[0]>0 ? params[0] : 1));
          break;
        case 'T':
          term.scroll(true, (params[0]>0 ? params[0] : 1));
          break;
        case 'X':
          term.eraseChar(params[0]>0 ? params[0] : 1);
          break;
        case 'Z':
          term.backTab(params[0]>0 ? params[0] : 1);
          break;
        default:
          //dump('unknown CSI: ' + this.esc + ch + '\n');
        }
        this.state = AnsiParser.STATE_TEXT;
        this.esc = '';
      } else {
        this.esc += ch;
      }
      break;
    case AnsiParser.STATE_C1:
      var C1_End = true;
      var C1_Char = [' ', '#', '%', '(', ')', '*', '+', '-', '.', '/'];
      if (this.esc) { // multi-char is not supported now
        for (var j = 0; j < C1_Char.length; ++j)
          if (this.esc == C1_Char[j]) C1_End = false;
        if (C1_End) --i;
        else this.esc += ch;
        //dump('UNKNOWN C1 CONTROL CHAR IS FOUND: ' + this.esc + '\n');
        this.esc = '';
        this.state = AnsiParser.STATE_TEXT;
        break;
      }
      switch (ch) {
      case '7':
        term.cur_x_sav = term.cur_x;
        term.cur_y_sav = term.cur_y;
        break;
      case '8':
        if (term.cur_x_sav<0 || term.cur_y_sav<0) break;
        term.cur_x = term.cur_x_sav;
        term.cur_y = term.cur_y_sav;
        break;
      case 'D':
        term.scroll(false,1);
        break;
      case 'E':
        term.lineFeed();
        term.carriageReturn();
        break;
      case 'M':
        term.scroll(true,1);
        break;
      /*
      case '=':
          term.view.keypadAppMode = true;
          break;
      case '>':
          term.view.keypadAppMode = false;
          break;
      */
      default:
        this.esc += ch;
        C1_End=false;
      }
      if (!C1_End) break;
      this.esc = '';
      this.state = AnsiParser.STATE_TEXT;
      break;
    case AnsiParser.STATE_ESC:
      if (ch == '[')
        this.state=AnsiParser.STATE_CSI;
      else {
        this.state=AnsiParser.STATE_C1;
        --i;
      }
      break;
    }
  }
  if (s) {
      term.puts(s);
      s = '';
  }
};
