function sendLevel5(e) {
  /*
  Функция используется для добавления нового НП.
  Функция опубликована, внешне скрипты вызывают её так:
  https://script.google.com/macros/s/AKfycby2OUnHmGkbTNeJDBcXu4zZ6eyNngh6XHpkcU_tsoVSmHn-NzY/exec?p1=Тест (тестовый р-н)&p2=skirda&p3=Permalink&p4=2015-08-31&p5=CityID
   */
  var sheet = SpreadsheetApp.openById("1C6P-VmSTR2KTS9LMIFZFQyf7r57ki9Mzi7B-HNwjBbM");

  var createUser = e.parameter.p1;
  var City = e.parameter.p2;
  var Permalink = e.parameter.p3;
  var segmentDate = e.parameter.p4;
  var CityID = e.parameter.p5;

  if (City === '' || CityID === '' || createUser === '' || Permalink === '' || segmentDate === '') {
    return ContentService.createTextOutput(JSON.stringify({
        "result": "error: incorrect parameters",
        "city": "",
        "CityID": -100,
        "sheet": "",
        "line": -1
      })).setMimeType(ContentService.MimeType.JSON);
  }

  // find my sheet (Level5)
  var idSheet = -1;
  for (var i = 0; i < sheet.getNumSheets(); ++i) {
    if ((sheet.getSheets())[i].getName() == "Level5") {
      idSheet = i;
      break;
    }
  }
  if (idSheet == -1) {
    return ContentService.createTextOutput(JSON.stringify({
        "result": "error: not found 'Level5'",
        "city": "",
        "CityID": -100,
        "sheet": "",
        "line": -1
      })).setMimeType(ContentService.MimeType.JSON);
  }

  // find City name
  var FoundCity = -1;
  for (var i = 0; i < sheet.getNumSheets(); ++i) {
    if ((sheet.getSheets())[i].getName() != "Статистика по запросам на 4+") {
      var startIndex,
      range;
      var LastRow = parseInt((sheet.getSheets())[i].getLastRow());
      if ((sheet.getSheets())[i].getName() == "Level5") {
        startIndex = 2;
        range = (sheet.getSheets())[i].getRange("C" + startIndex + ":F" + LastRow);
      } else {
        startIndex = 3;
        range = (sheet.getSheets())[i].getRange("O" + startIndex + ":R" + LastRow);
      }

      var arr = range.getValues();
      for (var j = 0; j < arr.length; ++j) {
        // arr[0][3] - CityID
        if (arr[j][0] == City) {
          FoundCity = j;
          var sheetName = (sheet.getSheets())[i].getName();

          return ContentService.createTextOutput(JSON.stringify({
              "result": "found",
              "city": City,
              "CityID": CityID,
              "sheet": sheetName,
              "line": j + startIndex
            })).setMimeType(ContentService.MimeType.JSON);
          break;
        }
      }
    }
  }

  if (FoundCity <= -1) {
    // Отметка времени User	City	Permalink	Date	CityID
    //  a                 b     c       d           e       f
    var n = parseInt((sheet.getSheets())[idSheet].getLastRow() + 1);

    function getShortDate(date) {
      // получить короткую дату DD.MM.YYYY
      var dd = date.getDate();
      var mm = date.getMonth() + 1;
      var yyyy = date.getFullYear();
      var HH = date.getHours();
      var MM = date.getMinutes();
      var SS = date.getSeconds();

      if (dd < 10) {
        dd = '0' + dd;
      }
      if (mm < 10) {
        mm = '0' + mm;
      }
      if (HH < 10) {
        HH = '0' + HH;
      }
      if (MM < 10) {
        MM = '0' + MM;
      }
      if (SS < 10) {
        SS = '0' + SS;
      }

      date = dd + '.' + mm + '.' + yyyy + ' ' + HH + ':' + MM + ':' + SS;

      return date;
    }

    var curDateStamp = new Date();
    (sheet.getSheets())[idSheet].getRange("A" + n).setValue(getShortDate(curDateStamp));
    (sheet.getSheets())[idSheet].getRange("C" + n).setValue(City);
    (sheet.getSheets())[idSheet].getRange("B" + n).setValue(createUser);
    (sheet.getSheets())[idSheet].getRange("D" + n).setValue(Permalink);
    (sheet.getSheets())[idSheet].getRange("E" + n).setValue(segmentDate);
    (sheet.getSheets())[idSheet].getRange("F" + n).setValue(CityID);

    var sheetName = (sheet.getSheets())[idSheet].getName();

    // https://developers.google.com/apps-script/guides/content
    return ContentService.createTextOutput(JSON.stringify({
        "result": "add",
        "city": City,
        "CityID": CityID,
        "sheet": sheetName,
        "line": n
      })).setMimeType(ContentService.MimeType.JSON);
  }
}
