// ==AppsScript==
// @name         Main code for WME Requests
// @version      0.2.0
// @description  Different functions for easier city requests processing
// @author       skirda, madnut
// @email        
// ==/AppsScript==

// Country specific settings
var countryID = "232";
var timezone = "Europe/Kiev";

// "Идентификаторы" столбцов
var cid = {
  "date":        "A",
  "fio":         "B",
  "email":       "C",
  "permalink":   "D",
  "cityname":    "E",
  "statename":   "F",
  "region":      "G",
  "action":       "", // not used yet
  "result":      "M",
  "solvernick":  "N",
  "addedcity":   "O",
  "outmsg":      "O", // same as addedcity
  "issent":      "Q",
  "delay":       "R",
  "cityid":      "P",
  "cityfinal":   "S",
  "requesturl":  "V", // not used yet
  "emailstatus": "T",
  "stateid":     "U"
};
//************************************************************************************************

function getShortDate(date, tzone) {
  return Utilities.formatDate(date, tzone ? tzone : "GMT", "dd.MM.yyyy HH:mm:ss");
}

function onOpen() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var entries1 = [{
      name: "Отправить сообщение инициатору",
      functionName: "sendEmail"
    }, {
      name: "Отправить сообщение всем",
      functionName: "sendEmailAll"
    }
  ];
  sheet.addMenu("Отправить письмо", entries1);

  var entries2 = [{
      name: "Проставить все CityID",
      functionName: "setAllCityID"
    }, {
      name: "Проставить текущий CityID",
      functionName: "setCityID"
    }
  ];
  sheet.addMenu("CityID", entries2);
  //  howto();
}

function setCell0(sheet, currRow, c, s) {
  sheet.getRange(c + currRow).setValue(s);
}

function sendEmail(row) {
  function getCurrRow() {
    var currRow = (row ? row : sheet.getActiveCell().getRow());
    return currRow;
  }
  function setCell(sheet, c, s, f) {
    // установить значение ячейки C текущей строки в S с добавлением к предыдущему.
    var currRow = getCurrRow();
    sheet.getRange(c + currRow).setValue(s);
    if (f) {
      sheet.getRange(c + currRow).setNumberFormat(f);
    }
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var currRow = getCurrRow();

  var isSendYet = sheet.getRange(cid.issent + currRow).getValue();

  if (isSendYet) {
    Browser.msgBox("Письмо уже было отправлено ранее! Для повторной отправки очистите ячейку в столбце " + cid.issent);
    return {
      "result": "error: email already sent!"
    };
  }

  var dtOrig = sheet.getRange(cid.date + currRow).getValue();
  var fio = sheet.getRange(cid.fio + currRow).getValue();
  var address = sheet.getRange(cid.email + currRow).getValue();
  var permalinkValues = sheet.getRange(cid.permalink + currRow).getValue();
  var NameCity = sheet.getRange(cid.cityname + currRow).getValue();
  var NameState = sheet.getRange(cid.statename + currRow).getValue();
  var NameRegion = sheet.getRange(cid.region + currRow).getValue();

  var Result = sheet.getRange(cid.result + currRow).getValue();
  var FinalMes = sheet.getRange(cid.addedcity + currRow).getValue();
  var Comment = sheet.getRange(cid.outmsg + currRow).getValue();
  var NickSolver = sheet.getRange(cid.solvernick + currRow).getValue();

  if (!Result || !FinalMes || !NickSolver) {
    Browser.msgBox("Письмо не может быть отправлено. Заполните столбцы " + cid.result + ", " + cid.addedcity + ", " + cid.solvernick);
    return {
      "result": "error sending email - empty cells"
    };
  }

  var curDateStamp = getShortDate(new Date(), timezone);

  var subject = "[WME City Lock] Ваш запит ";
  var message = "<p>Вітаємо, " + fio + "!" + "</br></p>";
  message += "<p><p>Ваш запит від " + getShortDate(dtOrig) + " на додавання населеного пункту «<b>" + NameCity + "</b>» ";
  
  if (Result == "да" || Result == "yes") {
    subject += "оброблено.";
    message += "<font color=#007700><b>виконано</b></font> " + curDateStamp + ".</p>" + "<p>В області " + permalinkValues + " створено населений пункт: «<b>" + FinalMes + "</b>».</p>";
  } else {
    subject += "відхилено.";
    message += "в області " + permalinkValues + " <font color=red><b>не виконано</b></font>.</p>" + "<p>Причина: «<em>" + FinalMes + "</em>».</p>";
  }

  var PostScriptum = "<font color=#007500><b>Якщо Ви ще не приєднались до української спільноти редакторів, але маєте бажання продовжувати покращувати мапу Waze, взаємодіючи з іншими учасниками проекту, перейдіть за наступним посиланням - це запрошення у чат спільноти: http://wazeukraine.tk . Будемо раді Вас бачити! )))</b></font>";

  message += "<p><p>-- <p><em>" + NickSolver + "</em></p>" + PostScriptum;
  //var wazeLogoUrl = "https://dl.dropboxusercontent.com/s/h4o31nbqjsmoth9/waze_ua.png";
  //var wazeLogoBlob = UrlFetchApp
  //  .fetch(wazeLogoUrl)
  //  .getBlob()
  //  .setName("wazeLogoUrl");

  MailApp.sendEmail({
    to: address,
    subject: subject,
    htmlBody: message,
    inlineImages: {
      //wazeLogoUrl: wazeLogoBlob
    }
  });

  // запись времени отправки
  setCell(sheet, cid.issent, curDateStamp);
  // запись "времени простоя"
  setCell(sheet, cid.delay, "=" + cid.issent + currRow + "-" + cid.date + currRow, "[mm]");
  
  setCityID(currRow);

  //Browser.msgBox("Письмо успешно отправлено!");
  return {
    "result": "success"
  };
}

function howto() {
  //начальное приветствие
  var doc = SpreadsheetApp.getActiveSpreadsheet();
  var app = UiApp.createApplication().setTitle('ВНИМАНИЕ! Прочтите перед началом работы!').setWidth(650).setHeight(320);
  var arrLabelHowTo = new Array(
      // нечётный индекс - цвет текста в RGB, чётный - сам текст в формате HTML-разметки!!!
      '#000000', 'Данная таблица предназначена для обработки запросов пользователей на создание НП в соответствии с Правилами, принятых в украинском сообществе Waze.',
      '#000000', 'Для корректной работы необходимо разрешить запрашиваемую авторизацию учетной записи Google.',
      '#000000', '<p>',
      '#007700', '- Столбцы A-I (белый фон заголовка) заполняются по запросам из отправляемых форм',
      '#007700', '- Столбцы J-L (оранжевый и салатовый фон заголовка) заполняются автором отработки запроса',
      '#007700', '- Столбец O заполняется автоматически при отправке автору запроса подтверждающего письма (см. ниже)',
      '#007700', '- Столбец P содержит время в минутах между временем запроса и временем решения (или текущим временем)',
      '#007700', '- Для отправки письма автору запроса выберите пункт "отправить письмо" в верхнем меню. Дата-время отправки письма будет заполнено автоматически в столбце M.',
      '#000000', '<p>',
      '#CC0000', 'Учтите, что письмо автору будет отправлено <b>с Вашего персонального почтового ящика</b>!',
      '#CC0000', 'Не забудьте включить уведомления о поступающих запросах ("Инструменты" => "Уведомления")',
      '#000000', '<hr>',
      '#000000', 'Waze Сhamps Ukraine');

  // Create a grid with 3 text boxes and corresponding labels
  var grid = app.createGrid(arrLabelHowTo.length, 1);

  for (var i = 0; i < arrLabelHowTo.length; i += 2) {
    grid.setWidget(i / 2, 0, app.createHTML(arrLabelHowTo[i + 1]).setStyleAttribute("color", arrLabelHowTo[i]));
  }

  var panel = app.createVerticalPanel();
  panel.add(grid);

  app.add(panel);
  doc.show(app);
}

function getcityID(cityName) {
  cityName = encodeURI(cityName);
  cityName = cityName.replace(/%25C2/g, "%C2");
  cityName = cityName.replace(/%25A0/g, "%A0");
  
  var url = "https://www.waze.com/row-Descartes-live/app/CityExistence?cityName=" + cityName + "&countryID=" + countryID + "&stateID=1&box=38.245107%2C51.736717%2C38.282278%2C51.743494";
  var response = UrlFetchApp.fetch(url);
  var json = response.getContentText();
  var data = JSON.parse(json);

  if (data.existingCity && data.existingCity.id) {
    return data.existingCity.id;
  }
  return null;
}

function setCityID(row) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var currRow = (row ? row : sheet.getActiveCell().getRow());

  var cityName = sheet.getRange(cid.addedcity + currRow).getValue();

  if (cityName && sheet.getRange(cid.result + currRow).getValue().trim() == "да") {
    
    // strip comment if we have some
    cityName = cityName.split(':')[0].trim();
    
    var id = getcityID(cityName);
    if (id) {
      sheet.getRange(cid.cityid + currRow).setValue(id);
      sheet.getRange(cid.cityfinal + currRow).setValue(cityName);
    }
  }

}

function setAllCityID() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();

  for (var i = 3; i <= sheet.getLastRow(); ++i) {
    var cityName = sheet.getRange(cid.addedcity + i).getValue();

    if (cityName && !sheet.getRange(cid.cityid + i).getValue() && sheet.getRange(cid.result + i).getValue() == "да") {
      
      // strip comment if we have some
      cityName = cityName.split(':')[0].trim();
      
      var id = getcityID(cityName);
      if (id) {
        sheet.getRange(cid.cityid + i).setValue(id);
        sheet.getRange(cid.cityfinal + i).setValue(cityName);
      }
    }
  }
}
