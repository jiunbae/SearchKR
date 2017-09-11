var DEFAULT_INSTANT_RESULTS = true;
var ERROR_COLOR = '#ff8989';
var WHITE_COLOR = '#ffffff';
var ERROR_TEXT = "Content script was not loaded.";
var DEFAULT_CASE_INSENSITIVE = false;
var MAX_HISTORY_LENGTH = 30;

var sentInput = false;
var processingKey = false;
var searchHistory = null;
var maxHistoryLength = MAX_HISTORY_LENGTH;

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
  },
  function(tabs) {
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
  },
  function(tabs) {
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

function passInputToContentScript(configurationChanged){
  if (!processingKey) {
    var regexString = document.getElementById('inputRegex').value;
    if  (!isValidRegex(regexString)) {
      document.getElementById('inputRegex').style.backgroundColor = ERROR_COLOR;
    } else {
      document.getElementById('inputRegex').style.backgroundColor = WHITE_COLOR;
    }
    chrome.tabs.query(
      { 'active': true, 'currentWindow': true },
      function(tabs) {
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

function createHistoryLineElement(text) {
  var deleteEntrySpan = document.createElement('span');
  deleteEntrySpan.className = 'historyDeleteEntry'
  deleteEntrySpan.textContent = '\u2715';
  deleteEntrySpan.addEventListener('click', function() {
    for (var i = searchHistory.length - 1; i >= 0; i--) {
      if (searchHistory[i] == text) {
        searchHistory.splice(i, 1);
      }
    }
    chrome.storage.local.set({searchHistory: searchHistory});
    updateHistoryDiv();
  });
  var linkSpan = document.createElement('span');
  linkSpan.className = 'historyLink'
  linkSpan.textContent = text;
  linkSpan.addEventListener('click', function() {
    if (document.getElementById('inputRegex').value !== text) {
      document.getElementById('inputRegex').value = text;
      passInputToContentScript();
      document.getElementById('inputRegex').focus();
    }
  });
  var lineDiv = document.createElement('div');
  lineDiv.appendChild(deleteEntrySpan);
  lineDiv.appendChild(linkSpan);
  return lineDiv;
}

function updateHistoryDiv() {
  var historyDiv = document.getElementById('history');
  if (historyDiv) {
    historyDiv.innerHTML = '';
    if (searchHistory.length == 0) {
      var span = document.createElement('span');
      span.className = 'historyIsEmptyMessage';
      span.textContent = HISTORY_IS_EMPTY_TEXT;
      historyDiv.appendChild(span);
    } else {
      for (var i = searchHistory.length - 1; i >= 0; i--) {
        historyDiv.appendChild(createHistoryLineElement(searchHistory[i]));
      }
      var clearButton = document.createElement('a');
      clearButton.href = '#';
      clearButton.type = 'button';
      clearButton.textContent = CLEAR_ALL_HISTORY_TEXT;
      clearButton.className = 'clearHistoryButton';
      clearButton.addEventListener('click', clearSearchHistory);
      historyDiv.appendChild(clearButton);
    }
  }
}

function addToHistory(regex) {
  if (regex && searchHistory !== null) {
    if (searchHistory.length == 0 || searchHistory[searchHistory.length - 1] != regex) {
      searchHistory.push(regex);
    }
    for (var i = searchHistory.length - 2; i >= 0; i--) {
      if (searchHistory[i] == regex) {
        searchHistory.splice(i, 1);
      }
    }
    if (searchHistory.length > maxHistoryLength) {
      searchHistory.splice(0, searchHistory.length - maxHistoryLength);
    }
    chrome.storage.local.set({searchHistory: searchHistory});
    updateHistoryDiv();
  }
}

function setHistoryVisibility(makeVisible) {
  document.getElementById('history').style.display = makeVisible ? 'block' : 'none';
  document.getElementById('show-history').title = makeVisible ? HIDE_HISTORY_TITLE : SHOW_HISTORY_TITLE;
  if(makeVisible) {
    document.getElementById('show-history').className = 'selected';
  } else {
    document.getElementById('show-history').className = '';
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
    if (request.numResults > 0 && request.cause == 'selectNode') {
      addToHistory(request.regexString);
    }
    if (request.regexString !== document.getElementById('inputRegex').value) {
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

chrome.storage.local.get({
    'instantResults' : DEFAULT_INSTANT_RESULTS,
    'maxHistoryLength' : MAX_HISTORY_LENGTH,
    'searchHistory' : null,
    'isSearchHistoryVisible' : false},
  function(result) {
    if(result.instantResults) {
      document.getElementById('inputRegex').addEventListener('input', function() {
        passInputToContentScript();
      });
    } else {
      document.getElementById('inputRegex').addEventListener('change', function() {
        passInputToContentScript();
      });
    }
    console.log(result);
    if(result.maxHistoryLength) {
      maxHistoryLength = result.maxHistoryLength;
    }
    if(result.searchHistory) {
      searchHistory = result.searchHistory.slice(0);
    } else {
      searchHistory = [];
    }
    setHistoryVisibility(result.isSearchHistoryVisible);
    updateHistoryDiv();
  }
);

chrome.tabs.query({
  'active': true,
  'currentWindow': true
},
function(tabs) {
  if ('undefined' != typeof tabs[0].id && tabs[0].id) {
    chrome.tabs.sendMessage(tabs[0].id, {
      'message' : 'getSearchInfo'
    }, function(response){
      if (response) {
        console.log(response);
      } else {
        console.log(response);
        document.getElementById('error').textContent = ERROR_TEXT;
      }
    });
  }
});

document.getElementById('inputRegex').focus();
window.setTimeout( 
  function(){document.getElementById('inputRegex').select();}, 0);

var makeVisible = document.getElementById('history').style.display == 'none';
setHistoryVisibility(makeVisible);
chrome.storage.local.set({isSearchHistoryVisible: makeVisible});
