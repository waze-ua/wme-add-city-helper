// ==AppsScript==
// @name         Send Level 5
// @version      0.2.0
// @description  API for saving city data to Level5 sheet
// @author       skirda, madnut
// @email        
// ==/AppsScript==

function sendLevel5(e) {
  /*
  Функция используется для добавления нового НП.
  Функция опубликована, внешне скрипты вызывают её так:
  https://script.google.com/macros/s/AKfycby2OUnHmGkbTNeJDBcXu4zZ6eyNngh6XHpkcU_tsoVSmHn-NzY/exec?p1=Тест (тестовый р-н)&p2=skirda&p3=Permalink&p4=2015-08-31&p5=CityID&p6=StateID
   */
  //var sheet = SpreadsheetApp.openById("1C6P-VmSTR2KTS9LMIFZFQyf7r57ki9Mzi7B-HNwjBbM");
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  
  var createUser = e.parameter.p1;
  var City = e.parameter.p2;
  var Permalink = e.parameter.p3;
  var segmentDate = e.parameter.p4;
  var CityID = e.parameter.p5;
  var StateID = ((!e.parameter.p6 || e.parameter.p6 == "1") ? "" : e.parameter.p6);
  
  if (City === '' || CityID === '' || createUser === '' || Permalink === '' || segmentDate === '') {
    return ContentService.createTextOutput(JSON.stringify({
        "result": "error: incorrect parameters",
        "city": "",
        "CityID": -100,
        "StateID": -100,
        "sheet": "",
        "line": -1
      })).setMimeType(ContentService.MimeType.JSON);
  }

  // find my sheet (Level5)
  var mySheet = sheet.getSheetByName("Level5");
  
  if (mySheet === null) {
    return ContentService.createTextOutput(JSON.stringify({
        "result": "error: not found 'Level5'",
        "city": "",
        "CityID": -100,
        "StateID": -100,
        "sheet": "",
        "line": -1
      })).setMimeType(ContentService.MimeType.JSON);
  }

  // find City name
  var FoundCity = -1;
  for (var i = 0; i < sheet.getNumSheets(); ++i) {
    var sh = sheet.getSheets()[i];
    var shName = sh.getName();
    if (shName != "Статистика по запросам на 4+") {
      var startIndex,
          cityIDIndex,
          stateIDIndex,
          range;
      var LastRow = parseInt(sh.getLastRow());
      if (shName == "Level5") {
        startIndex = 2;
        cityIDIndex = 3;
        stateIDIndex = 4;
        range = sh.getRange("C" + startIndex + ":G" + LastRow);
      } else {
        startIndex = 3;
        cityIDIndex = 1;
        stateIDIndex = 6;
        range = sh.getRange("O" + startIndex + ":U" + LastRow);
      }

      var arr = range.getValues();
      for (var j = 0; j < arr.length; ++j) {
        if (arr[j][0] == City && arr[j][stateIDIndex] == StateID) {
          FoundCity = j;

          return ContentService.createTextOutput(JSON.stringify({
              "result": "found",
              "city": City,
              "CityID": arr[j][cityIDIndex],
              "StateID": arr[j][stateIDIndex],
              "sheet": shName,
              "line": j + startIndex
            })).setMimeType(ContentService.MimeType.JSON);
          //break;
        }
      }
    }
  }

  if (FoundCity < 0) {
    // Отметка времени User	City	Permalink	Date	CityID    StateID
    //  a                 b     c       d           e       f     g
    var n = parseInt(mySheet.getLastRow() + 1);

    var curDateStamp = new Date();
    mySheet.getRange("A" + n).setValue(getShortDate(curDateStamp));
    mySheet.getRange("C" + n).setValue(City);
    mySheet.getRange("B" + n).setValue(createUser);
    mySheet.getRange("D" + n).setValue(Permalink);
    mySheet.getRange("E" + n).setValue(segmentDate);
    mySheet.getRange("F" + n).setValue(CityID);
    mySheet.getRange("G" + n).setValue(StateID);

    // https://developers.google.com/apps-script/guides/content
    return ContentService.createTextOutput(JSON.stringify({
        "result": "add",
        "city": City,
        "CityID": CityID,
        "StateID": StateID,
        "sheet": mySheet.getName(),
        "line": n
      })).setMimeType(ContentService.MimeType.JSON);
  }
}
