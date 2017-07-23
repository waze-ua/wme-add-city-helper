function doGet(e)
{
  /*
       https://script.google.com/macros/s/AKfycbz5YdoEiLAc74gOkRPYwEPbG0IGPMLHceoU0oi05ERtdzOk9Gs/exec?func=Test&p1=Test2
  */
  
  var funcName = e.parameter.func;
  var resultString = {};
  
  switch (funcName)
  {
    case "getRequestsCount":
      resultString = getRequestsCount();
      break;
    case "getCityRequest":
      resultString = getCityRequest(e.parameter.user);
      break;
    case "processRequest":
      resultString = processRequest(e.parameter.row, e.parameter.user, e.parameter.action, e.parameter.note);
      break;
    case "sendEmail":
      resultString = sendEmail(e.parameter.row);
      break;
    default:
      resultString = {"result":"error: unknown function name","funcName" : funcName};
      break;
  }
  
  return ContentService.createTextOutput(JSON.stringify(resultString)).setMimeType(ContentService.MimeType.JSON);
}

function _getSpreadsheet()
{
  //var sheet = SpreadsheetApp.openById("1nYBebJQ0E3byTKMJM57rXqSkLsPBnxWBV_a1x5MD048");
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  
  var sheetName = "Ответы на форму (1)";
  var sheetObj = sheet.getSheetByName(sheetName);
  if (sheetObj == null)
  {
    return {"result": "error: sheet not found", "sheetName": sheetName};
  }
  
  return sheetObj;
}

function _getActiveRequests()
{
  var foundSheet = _getSpreadsheet();
  
  // if it's error object
  if (foundSheet.result)
  {
    return foundSheet;
  }

  var lastRow;
  var count = 0;
  
  for (lastRow = foundSheet.getLastRow(); lastRow > 0; --lastRow)
  {
    var isCompleted = foundSheet.getRange("M" + lastRow).getValue();
    if (isCompleted != "")
    {
      break;
    }
    count++;
  }
  if (lastRow == 0 || lastRow == foundSheet.getLastRow())
  {
    return {"result": "nothing to process", "count": "0"};
  }
  else
  {
    lastRow++;
    count--;
  }
  
  var range = foundSheet.getRange("A" + lastRow + ":N" + (lastRow + count));
  var arr = range.getValues();
  
  return {"result": "success", "values": arr, "startRow": lastRow};
}

function getRequestsCount()
{
  var res = _getActiveRequests();
  if (res.result == "success")
  {
    return {"result": res.result, "count": res.values.length};
  }
  else
  {
    return res;
  }
}

function getCityRequest(user)
{
  var res = _getActiveRequests();
  if (res.result == "success")
  {
    for (var x = 0; x < res.values.length; x++) {
      var who = res.values[x][13];
      if (!who || (user && user == who.replace("lock:", "")))
      {
        var status = who ? "locked" : "active";
        return {"result": res.result, "city": res.values[x][4], "requestor": res.values[x][1], "permalink": res.values[x][3], "row": res.startRow, "status": status, "count": res.values.length};
      }
    }
    return {"result": "nothing to process"};
  }
  else
  {
    return res;
  }
}

function processRequest(row, user, action, note)
{
  if (!(row && user && action))
  {
    //return {"result": "error: row, user or action are not specified"};
    row = "2118"; user = "madnut"; action = "decline"; note = "test comment";
  }
  
  var foundSheet = _getSpreadsheet();
  
  // if it's error object
  if (foundSheet.result)
  {
    return foundSheet;
  }    
  
  var result = {"result": "error"};
  var range, arr;
  switch (action)
  {
    case "lock":
      var lockName = "lock:" + user;
      range = foundSheet.getRange("N" + row);
      var lockedBy = range.getValue();
      
      if (lockedBy != "")
      {
        if (foundSheet.getRange("M" + row).getValue() != "")
        {
          result = {"result": "error: request already processed by " + lockedBy.replace("lock:","")};
        }
        else
        {
          result = {"result": "error: already locked by " + lockedBy.replace("lock:","")};
        }
      }
      else
      {
        range = range.setValue(lockName);
        arr = range.getValues();
        if (arr[0][0] == lockName)
        {
          result = {"result": "success"};
        }
      }
      break;
    case "approve":
    case "decline":
      if (!note)
      {
        if (action == "approve")
        {
          result = {"result": "error: city shouldn't be empty"};
        }
        else
        {
          result = {"result": "error: decline notes shouldn't be empty"};
        }
      }
      else
      {
        var isCompleted = foundSheet.getRange("M" + row).getValue();
        var author = foundSheet.getRange("N" + row).getValue();
        if (isCompleted)
        {
          result = {"result": "error: request already processed by " + author.replace("lock:","")};
        }
        else
        {
          range = foundSheet.getRange("M" + row).setValue(action == "approve" ? "да" : "нет");
          range = foundSheet.getRange("N" + row).setValue(user);
          range = foundSheet.getRange("O" + row).setValue(note);
          arr = range.getValues();
          if (arr[0][0] == note)
          {
            result = {"result": "success"};
          }
        }
      }
      break;
    default:
      result = {"result":"error: unknown action name","action" : action};
      break;
  }
  
  return result;
}
