var DEFAULT_INSTANT_RESULTS = true;
var ERROR_COLOR = '#ff8989';
var WHITE_COLOR = '#ffffff';
var ERROR_TEXT = "Content not loaded!";

var sentInput = false;
var processingKey = false;

function isValidRegex(pattern) {
  try{
    var regex = new RegExp(pattern);
    return true;
  } catch(e) {
    return false;
  }
}

function selectNext(){
  chrome.tabs.query({
    'active': true,
    'currentWindow': true
  }, function(tabs) {
    if ('undefined' != typeof tabs[0].id && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        'message' : 'selectNextNode'
      });
    }
  });
}

function selectPrev(){
  chrome.tabs.query({
    'active': true,
    'currentWindow': true
  }, function(tabs) {
    if ('undefined' != typeof tabs[0].id && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        'message' : 'selectPrevNode'
      });
    }
  });
}

function passInputToContentScript(){
  passInputToContentScript(false);
}

String.format = function(format) {
  var args = Array.prototype.slice.call(arguments, 1);
  return format.replace(/{(\d+)}/g, function(match, number) { 
    return typeof args[number] != 'undefined'
      ? args[number] 
      : match
    ;
  });
};

function tokenize(char) {
  var code = char.charCodeAt(0);
  if (code == 32) return " ";
  if (Hangul.isComplete(char)) return char;
  if (Hangul.isCho(char)) {
    return String.format("[{0}-{1}{2}]",
      Hangul.a([char, 'ㅏ']),
      Hangul.a([char, 'ㅣ', 'ㅎ']),
      char);
  }
  if (Hangul.isVowel(char)) {
    return "";
  }
  return char;
}

function processString(string) {
  var resultString = "";
  for (let char of string) {
    resultString += tokenize(char);
  }
  return resultString;
}

function passInputToContentScript(configurationChanged) {
  if (!processingKey) {
    console.log('query start;');
    var regexString = processString(document.getElementById('inputRegex').value);

    if  (!isValidRegex(regexString)) {
      document.getElementById('inputRegex').style.backgroundColor = ERROR_COLOR;
    } else {
      document.getElementById('inputRegex').style.backgroundColor = WHITE_COLOR;
    }
    chrome.tabs.query({
        'active': true,
        'currentWindow': true
      }, function(tabs) {
        if ('undefined' != typeof tabs[0].id && tabs[0].id) {
          processingKey = true;
          chrome.tabs.sendMessage(tabs[0].id, {
            'message' : 'search',
            'regexString' : regexString,
            'configurationChanged' : configurationChanged,
            'getNext' : true
          });
          sentInput = true;
        }
      }
    );
  }
}

document.getElementById('next').addEventListener('click', function() {
  selectNext();
});

document.getElementById('prev').addEventListener('click', function() {
  selectPrev();
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('returnSearchInfo' == request.message) {
    processingKey = false;
    if (request.numResults > 0) {
      document.getElementById('numResults').textContent = String(request.currentSelection+1) + ' of ' + String(request.numResults);
    } else {
      document.getElementById('numResults').textContent = String(request.currentSelection) + ' of ' + String(request.numResults);
    }
    if (!sentInput) {
      document.getElementById('inputRegex').value = request.regexString;
    }
    if (request.regexString !== processString(document.getElementById('inputRegex').value)) {
      passInputToContentScript();
    }
  }
});

var key = [];
onkeydown = onkeyup = function(e) {
  key[e.keyCode] = e.type == 'keydown';
  if (document.getElementById('inputRegex') === document.activeElement) {
    if (!key[16] && key[13]) {
      if (sentInput) {
        selectNext();
      } else {
        passInputToContentScript();
      }
    } else if (key[16] && key[13]) {
      selectPrev();
    }
  }
}

chrome.tabs.query({
  'active': true,
  'currentWindow': true
}, function(tabs) {
  if ('undefined' != typeof tabs[0].id && tabs[0].id) {
    chrome.tabs.sendMessage(tabs[0].id, {
      'message' : 'getSearchInfo'
    }, function(response){
      if (response) {
      } else {
        document.getElementById('error').textContent = ERROR_TEXT;
      }
    });
  }
});

document.getElementById('inputRegex').focus();
window.setTimeout( 
  function(){
    document.getElementById('inputRegex').select();
  }, 0);
