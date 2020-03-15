// ==AppsScript==
// @name         Add City Helper
// @version      0.2.4
// @description  API for processing requests directly from WME
// @author       madnut
// @email        madnut.ua@gmail.com
// ==/AppsScript==

var sheetId = "1C6P-VmSTR2KTS9LMIFZFQyf7r57ki9Mzi7B-HNwjBbM";

function ch2index(letter) {
  var column = 0,
  length = letter.length;
  for (var i = 0; i < length; i++) {
    column += (letter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
  }
  return column;
}

// смещения в массиве данных
var aIndex = {
  "isprocessed": ch2index(cid.result) - 1,
  "author":      ch2index(cid.solvernick) - 1,
  "isemailed":   ch2index(cid.issent) - 1,
  "city":        ch2index(cid.cityname) - 1,
  "requestor":   ch2index(cid.fio) - 1,
  "permalink":   ch2index(cid.permalink) - 1,
  "stateid":     ch2index(cid.stateid) - 1,
  // additional *virtual* columns goes after the last one (cid.stateid)
  "status":      ch2index(cid.stateid),
  "row":         ch2index(cid.stateid) + 1
};

function doGet(e) {
  var funcName = e.parameter.func;
  var resultString = {};

  if (!funcName) {
    // compatibility with old WME Requests (Save L6)
    return sendLevel6(e);
  }

  switch (funcName) {
  case "getRequestsCount":
    resultString = getRequestsCount();
    break;
  case "getCityRequest":
    resultString = getCityRequest(e.parameter.user, e.parameter.row);
    break;
  case "processRequest":
    resultString = processRequest(e.parameter.row, e.parameter.user, e.parameter.action, e.parameter.note, e.parameter.addedcity, e.parameter.stateid);
    break;
  case "sendEmail":
    var sheet = SpreadsheetApp.openById(sheetId);
    resultString = sendEmail(e.parameter.row, sheet);
    break;
  case "saveLevel5":
    return sendLevel6(e);
    break;
  default:
    resultString = {
      "result": "error: unknown function name",
      "funcName": funcName
    };
    break;
  }

  return ContentService.createTextOutput(JSON.stringify(resultString)).setMimeType(ContentService.MimeType.JSON);
}

function _getSpreadsheet() {
  var sheet = SpreadsheetApp.openById(sheetId);

  var sheetName = "Ответы на форму (1)";
  var sheetObj = sheet.getSheetByName(sheetName);
  if (sheetObj === null) {
    return {
      "result": "error: sheet not found",
      "sheetName": sheetName
    };
  }

  return sheetObj;
}

// Don's array approach - checks first column only
// With added stopping condition & correct result.
// From answer https://stackoverflow.com/a/9102463/1677912
function _getFirstEmptyRowByColumnArray() {
  var foundSheet = _getSpreadsheet();

  // if it's an error object
  if (foundSheet.result) {
    return foundSheet;
  }

  var column = foundSheet.getRange(cid.issent + ':' + cid.issent);
  var values = column.getValues(); // get all data in one call
  var ct = 3; // need to shift a bit
  while (values[ct] && values[ct][0] !== "") {
    ct++;
  }
  return (ct + 1); // 1-based row indexes
}

function _getActiveRequests() {
  var foundSheet = _getSpreadsheet();

  // if it's an error object
  if (foundSheet.result) {
    return foundSheet;
  }

  var startRow = _getFirstEmptyRowByColumnArray();
  var arr = [];

  if (startRow > foundSheet.getLastRow()) {
    return {
      "result": "nothing to process",
      "values": arr
    };
  }

  var values = foundSheet.getRange(cid.date + startRow + ':' + cid.stateid).getValues();

  for (var x = 0; x < values.length; x++) {
    var value = values[x];
    var isProcessed = value[aIndex.isprocessed];
    var hasAuthor = value[aIndex.author];
    var isEmailed = value[aIndex.isemailed];
    // if key fields are set = request is done
    if (isProcessed && hasAuthor && isEmailed) {
      continue;
    }
    // add status
    var status = "active";
    if (isProcessed) {
      status = (isProcessed == 'да' ? "approved" : "declined");
      if (isEmailed) {
        status += ", emailed";
      }
    } else if (hasAuthor.match(/lock:/)) {
      status = 'locked';
    }
    value.push(status);
    // add row
    value.push(startRow + x);
    arr.push(value);
  }

  return {
    "result": "success",
    "values": arr
  };
}

function getRequestsCount() {
  var res = _getActiveRequests();
  return {
    "result": res.result,
    "count": res.values.length
  };
}

function getCityRequest(user, row) {
  var res = _getActiveRequests();
  if (res.result == "success") {
    for (var x = 0; x < res.values.length; x++) {
      
      var who = res.values[x][aIndex.author];
      if (!who || (user && user == who.replace("lock:", ""))) {
        // skip functionality
        if (row && res.values[x][aIndex.row] == row) {
          row = -1;
          if (x >= (res.values.length - 1)) {
            x = -1;
          } 
          continue;
        }
        
        return {
          "result": res.result,
          "city": res.values[x][aIndex.city],
          "requestor": res.values[x][aIndex.requestor],
          "permalink": res.values[x][aIndex.permalink],
          "row": res.values[x][aIndex.row],
          "status": res.values[x][aIndex.status],
          "countrycode": countryID,
          "statecode": (res.values[x][aIndex.stateid] ? res.values[x][aIndex.stateid] : "1"),
          "count": res.values.length
        };
      }
      
      if (row == -1 && x >= (res.values.length - 1)) {
          x = -1;
          row = null;
      }      
    }
    return {
      "result": "nothing to process",
      "count": "0"
    };
  } else {
    return {
      "result": res.result,
      "count": "0"
    };
  }
}

function processRequest(row, user, action, note, addedcity, stateid) {
  if (!(row && user && action)) {
    return {
      "result": "error: row, user or action are not specified"
    };
  }

  var foundSheet = _getSpreadsheet();

  // if it's error object
  if (foundSheet.result) {
    return foundSheet;
  }

  var result = {
    "result": "error"
  };
  var range,
  arr;
  switch (action) {
  case "lock":
    var lockName = "lock:" + user;
    range = foundSheet.getRange(cid.solvernick + row);
    var lockedBy = range.getValue();

    if (lockedBy !== "") {
      if (foundSheet.getRange(cid.result + row).getValue() !== "") {
        result = {
          "result": "error: request already processed by " + lockedBy.replace("lock:", "")
        };
      } else {
        result = {
          "result": "error: already locked by " + lockedBy.replace("lock:", "")
        };
      }
    } else {
      range = range.setValue(lockName);
      arr = range.getValues();
      if (arr[0][0] == lockName) {
        result = {
          "result": "success"
        };
      }
    }
    break;
  case "approve":
  case "decline":
    if (action == "approve" && !addedcity) {
      result = {
        "result": "error: added city shouldn't be empty"
      };
    } else if (action == "decline" && !note) {
      result = {
        "result": "error: decline comment shouldn't be empty"
      };
    } else {
      var isCompleted = foundSheet.getRange(cid.result + row).getValue();
      var author = foundSheet.getRange(cid.solvernick + row).getValue();
      if (isCompleted) {
        result = {
          "result": "error: request already processed by " + author.replace("lock:", "")
        };
      } else {
        range = foundSheet.getRange(cid.result + row).setValue(action == "approve" ? "да" : "нет");
        range = foundSheet.getRange(cid.solvernick + row).setValue(user);
        // for Ukraine & Russia we have the same column for city and for comment
        if ((countryID == "232" || countryID == "186") && action == "approve") {
          note = addedcity + (note ? (" : " + note) : '');
        } else {
          range = foundSheet.getRange(cid.addedcity + row).setValue(addedcity);
        }
        if (stateid && stateid != "1") {
          range = foundSheet.getRange(cid.stateid + row).setValue(stateid);
        }
        range = foundSheet.getRange(cid.outmsg + row).setValue(note);
        arr = range.getValues();
        if (arr[0][0] == note) {
          result = {
            "result": "success"
          };
        }
      }
    }
    break;
  default:
    result = {
      "result": "error: unknown action name",
      "action": action
    };
    break;
  }

  return result;
}
