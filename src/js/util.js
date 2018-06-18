export function setTimer(repeat, func, timelimit) {
  if(repeat) {
	  return {
		  timer: setInterval(func, timelimit),
		  cancel: function() {
			  clearInterval(this.timer);
		  }
	  };
  } else {
	  return {
		  timer: setTimeout(func, timelimit),
		  cancel: function() {
			  clearTimeout(this.timer);
		  }
	  };
  }
}

export function getQueryVariable(variable) {
  // window.location.search: Return the querystring part of a URL
  // if url is www.google.com?one=1&two=2, query varible below will be one=1&two=2
  var query = window.location.search.substring(1);
  // if query is 'one=1&two=2', vars will be ['one=1', 'two=2']
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
    // first pair will be ['one', '1']
    var pair = vars[i].split("=");
    if (pair[0] == variable) {
      // decodeURIComponent: Decode a URI after encoding it
      return decodeURIComponent(pair[1]);
    }
  }
  return null;
}
