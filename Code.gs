// Страна
var countryID = "232";

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
  function setCell(sheet, c, s) {
    // установить значение ячейки C текущей строки в S с добавлением к предыдущему.
    var currRow = (row ? row : sheet.getActiveCell().getRow());
    sheet.getRange(c + currRow).setValue(s);
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var currRow = (row ? row : sheet.getActiveCell().getRow());

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

  var curDateStamp = new Date();

  var subject = "[WME City Lock] Запрос обработан ";
  var message = "<p>Здравствуйте, " + fio + "!" + "</br></p>";

  if (Result == "да" || Result == "yes") {
    subject += "положительно.";
    message += "<p><p>Ваш запрос от " + getShortDate(dtOrig) + " на добавление населенного пункта «<b>" + NameCity + "</b>» <font color=#007700><b>выполнен</b></font> " + getShortDate(curDateStamp) + ".</p>" +
    "<p>В области " + permalinkValues + " создан населенный пункт: «<b>" + FinalMes + "</b>».</p>";
  } else {
    subject += "отрицательно.";
    message += "<p><p>Ваш запрос от " + getShortDate(dtOrig) + " на добавление населенного пункта «<b>" + NameCity + "</b>» в области " + permalinkValues + " <font color=red><b>не выполнен</b></font>.</p>" +
    "<p>Причина: «<em>" + FinalMes + "</em>».</p>";
  }

  var PostScriptum = "<font color=#007500><b>Если Вы еще не присоединились к украинскому сообществу редакторов, но у вас есть желание продолжать улучшать карту Waze, взаимодействуя с остальными участниками проекта, заполните пожалуйста эту форму: http://goo.gl/forms/aUYIThl5gg. Будем рады Вас видеть! )))</b></font>";

  message += "<p><p>-- <p><em>" + NickSolver + "</em></p>" + PostScriptum;
  var wazeLogoUrl = "https://dl.dropboxusercontent.com/s/h4o31nbqjsmoth9/waze_ua.png";
  var wazeLogoBlob = UrlFetchApp
    .fetch(wazeLogoUrl)
    .getBlob()
    .setName("wazeLogoUrl");

  MailApp.sendEmail({
    to: address,
    subject: subject,
    htmlBody: message,
    inlineImages: {
      wazeLogoUrl: wazeLogoBlob
    }
  });

  // запись времени отправки
  setCell(sheet, cid.issent, getShortDate(curDateStamp));
  // запись "времени простоя"
  setCell(sheet, cid.delay, Math.round((curDateStamp.getTime() - dtOrig.getTime()) / (3600 * 24)));

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
