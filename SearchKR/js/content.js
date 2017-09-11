var ELEMENT_NODE_TYPE = 1;
var TEXT_NODE_TYPE = 3;
var UNEXPANDABLE = /(script|style|svg|audio|canvas|figure|video|select|input|textarea)/i;
var HIGHLIGHT_TAG = 'highlight-tag';
var HIGHLIGHT_CLASS = 'highlighted';
var SELECTED_CLASS = 'selected';
var DEFAULT_MAX_RESULTS = 500;
var DEFAULT_HIGHLIGHT_COLOR = '#ffff00';
var DEFAULT_SELECTED_COLOR = '#ff9900';
var DEFAULT_TEXT_COLOR = '#000000';
var DEFAULT_CASE_INSENSITIVE = false;

var searchInfo;

Element.prototype.documentOffsetTop = function () {
  return this.offsetTop + ( this.offsetParent ? this.offsetParent.documentOffsetTop() : 0 );
};
Element.prototype.visible = function() {
    return (!window.getComputedStyle(this) || window.getComputedStyle(this).getPropertyValue('display') == '' || 
           window.getComputedStyle(this).getPropertyValue('display') != 'none')
}

function initSearchInfo(pattern) {
  var pattern = typeof pattern !== 'undefined' ? pattern : '';
  searchInfo = {
    regexString : pattern,
    regexReplaced : processString(pattern),
    selectedIndex : 0,
    highlightedNodes : [],
    length : 0
  }
}

function returnSearchInfo(cause) {
  chrome.runtime.sendMessage({
    'message' : 'returnSearchInfo',
    'regexString' : searchInfo.regexString,
    'currentSelection' : searchInfo.selectedIndex,
    'numResults' : searchInfo.length,
    'cause' : cause
  });
}

function isTextNode(node) {
  return node && node.nodeType === TEXT_NODE_TYPE;
}

function isExpandable(node) {
  return node && node.nodeType === ELEMENT_NODE_TYPE && node.childNodes && 
         !UNEXPANDABLE.test(node.tagName) && node.visible();
}

function highlight(regex, highlightColor, selectedColor, textColor, maxResults) {
  function highlightRecursive(node) {
    if(searchInfo.length >= maxResults){
      return;
    }
    if (isTextNode(node)) {
      var index = node.data.search(regex);
      if (index >= 0 && node.data.length > 0) {
        var matchedText = node.data.match(regex)[0];
        var matchedTextNode = node.splitText(index);
        matchedTextNode.splitText(matchedText.length);
        var spanNode = document.createElement(HIGHLIGHT_TAG); 
        spanNode.className = HIGHLIGHT_CLASS;
        spanNode.style.backgroundColor = highlightColor;
        spanNode.style.color = textColor;
        spanNode.appendChild(matchedTextNode.cloneNode(true));
        matchedTextNode.parentNode.replaceChild(spanNode, matchedTextNode);
        searchInfo.highlightedNodes.push(spanNode);
        searchInfo.length += 1;
        return 1;
      }
    } else if (isExpandable(node)) {
        var children = node.childNodes;
        for (var i = 0; i < children.length; ++i) {
          var child = children[i];
          i += highlightRecursive(child);
        }
    }
    return 0;
  }
  highlightRecursive(document.getElementsByTagName('body')[0]);
};

function removeHighlight() {
  while (node = document.body.querySelector(HIGHLIGHT_TAG + '.' + HIGHLIGHT_CLASS)) {
    node.outerHTML = node.innerHTML;
  }
    while (node = document.body.querySelector(HIGHLIGHT_TAG + '.' + SELECTED_CLASS)) {
    node.outerHTML = node.innerHTML;
  }
};

function scrollToElement(element) {
    element.scrollIntoView(); 
    var top = element.documentOffsetTop() - ( window.innerHeight / 2 );
    window.scrollTo( 0, Math.max(top, window.pageYOffset - (window.innerHeight/2))) ;
}

function selectFirstNode(selectedColor) {
  var length =  searchInfo.length;
  if(length > 0) {
    searchInfo.highlightedNodes[0].className = SELECTED_CLASS;
    searchInfo.highlightedNodes[0].style.backgroundColor = selectedColor;
    scrollToElement(searchInfo.highlightedNodes[0]);
  }
}

function selectNode(highlightedColor, selectedColor, getNext) {
  var length = searchInfo.length;
  if(length > 0) {
    searchInfo.highlightedNodes[searchInfo.selectedIndex].className = HIGHLIGHT_CLASS;
    searchInfo.highlightedNodes[searchInfo.selectedIndex].style.backgroundColor = highlightedColor;
      if(getNext) {
        if(searchInfo.selectedIndex === length - 1) {
          searchInfo.selectedIndex = 0; 
        } else {
          searchInfo.selectedIndex += 1;
        }
      } else {
        if(searchInfo.selectedIndex === 0) {
          searchInfo.selectedIndex = length - 1; 
        } else {
          searchInfo.selectedIndex -= 1;
        }
      }
    searchInfo.highlightedNodes[searchInfo.selectedIndex].className = SELECTED_CLASS;
    searchInfo.highlightedNodes[searchInfo.selectedIndex].style.backgroundColor = selectedColor;
    returnSearchInfo('selectNode');
    scrollToElement(searchInfo.highlightedNodes[searchInfo.selectedIndex]);
  }
}

function selectNextNode(highlightedColor, selectedColor) {
  selectNode(highlightedColor, selectedColor, true); 
}

function selectPrevNode(highlightedColor, selectedColor) {
  selectNode(highlightedColor, selectedColor, false);
}

function validateRegex(pattern) {
  try{
    var regex = new RegExp(pattern);
    return regex;
  } catch(e) {
    return false;
  }
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

function search(regexString, configurationChanged) {
  var regex = validateRegex(regexString);
  if (regex && regexString != '' && (configurationChanged || regexString !== searchInfo.regexString)) { // new valid regex string
    removeHighlight();
    chrome.storage.local.get({
      'highlightColor' : DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor' : DEFAULT_SELECTED_COLOR,
      'textColor' : DEFAULT_TEXT_COLOR,
      'maxResults' : DEFAULT_MAX_RESULTS,
      'caseInsensitive' : DEFAULT_CASE_INSENSITIVE}, 
      function(result) {
        initSearchInfo(regexString);
        highlight(searchInfo.regexReplaced, result.highlightColor, result.selectedColor, result.textColor, result.maxResults);
        //selectFirstNode(result.selectedColor);
        returnSearchInfo('search');
      }
    );
  } else if (regex && regexString != '' && regexString === searchInfo.regexString) { // elements are already highlighted
    chrome.storage.local.get({
      'highlightColor' : DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor' : DEFAULT_SELECTED_COLOR}, 
      function(result) {
        //selectNextNode(result.highlightColor, result.selectedColor);
      }
    );
  } else {
    removeHighlight();
    initSearchInfo(regexString);
    returnSearchInfo('search');
  }
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('search' == request.message) {
    search(request.regexString, request.configurationChanged);
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('selectNextNode' == request.message) {
    chrome.storage.local.get({
      'highlightColor' : DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor' : DEFAULT_SELECTED_COLOR
      }, 
      function(result) {
        selectNextNode(result.highlightColor, result.selectedColor);
      }
    );
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('selectPrevNode' == request.message) {
    chrome.storage.local.get({
      'highlightColor' : DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor' : DEFAULT_SELECTED_COLOR
      }, 
      function(result) {
        selectPrevNode(result.highlightColor, result.selectedColor);
      }
    );
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('getSearchInfo' == request.message) {
    sendResponse({message: "I'm alive!"});
    returnSearchInfo('getSearchInfo');
  }
});

initSearchInfo();
