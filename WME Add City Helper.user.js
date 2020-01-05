// ==UserScript==
// @name         WME Add City Helper
// @namespace    madnut.ua@gmail.com
// @version      0.6.12
// @description  Helps to add cities using WME Requests spreadsheet
// @author       madnut
// @include      https://*waze.com/*editor*
// @exclude      https://*waze.com/*user/editor*
// @connect      google.com
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      localhost
// @connect      wazeolenta.org
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @updateURL    https://github.com/madnut-ua/wme_addcityhelper/raw/master/WME%20Add%20City%20Helper.user.js
// @downloadURL  https://github.com/madnut-ua/wme_addcityhelper/raw/master/WME%20Add%20City%20Helper.user.js
// @supportURL   https://github.com/madnut-ua/wme_addcityhelper/issues
// ==/UserScript==

/* global W */
/* global $ */
/* global OL */

(function() {
    'use strict';

    var requestsTimeout = 30000; // in ms
    var minZoomLevel = 4;
    var minAnalyzerVersion = 200; // Ukraine's MinRegion Analyzer minimum version required to work properly with the script
    var analyzerUrl = 'http://wazeolenta.org/api/uk/mr/GetSuggestedCityName';
    //var analyzerUrl = 'http://localhost:51672/api/uk/mr/GetSuggestedCityName';
    var config = {
        BO: {
            "country": "Беларусь",
            "code": "37",
            "requestsTable": "https://docs.google.com/spreadsheets/d/1uuRY8ib5h_8xMfpzgXG2N78foMtftUNkPzJxP56mDXI/edit#gid=573607847",
            // prod
            "apiUrl": "https://script.google.com/macros/s/AKfycbxw0VxylM8Y8mPEMK5U3aIPcwR2ev91ln7dvQTr2I7t-bFmFm6I/exec"
            // dev
            //"apiUrl": "https://script.google.com/macros/s/AKfycbz8_xLefn_06nLRsfwnupviEEStCXfttg777KryBMnD/dev"
        },
        UP: {
            "country": "Україна",
            "code": "232",
            "requestsTable": "https://docs.google.com/spreadsheets/d/1C6P-VmSTR2KTS9LMIFZFQyf7r57ki9Mzi7B-HNwjBbM/edit#gid=573607847",
            // prod
            "apiUrl": "https://script.google.com/macros/s/AKfycby2OUnHmGkbTNeJDBcXu4zZ6eyNngh6XHpkcU_tsoVSmHn-NzY/exec"
            // dev
            //"apiUrl": "https://script.google.com/macros/s/AKfycbxgluud2CmzFqpRm4Bp379UdEjuKhelt-0nT1feY_U/dev"
        },
        RS: {
            "country": "Россия",
            "code": "186",
            "requestsTable": "https://docs.google.com/spreadsheets/d/1ddcW8EmNjojJp7EQ4AYPdfBqNWe28WqRaQ_RtkB8JAU/edit#gid=573607847",
            // prod
            "apiUrl": "https://script.google.com/macros/s/AKfycbwTVr3PRnJAAEGWQFBRjt4bw4nO_-Ahy7Z26H1PAT6I_XDTOOrg/exec"
            // dev
            //"apiUrl": "https://script.google.com/macros/s/AKfycbzqA15-fy4g4StdRUmnuMj9z6rJ56gQPjCYpgCMni7h/dev"
        }
    };

    function log(message) {
        if (typeof message === 'string') {
            console.log('ACH: ' + message);
        } else {
            console.log('ACH: ', message);
        }
    }

    function ACHelper_bootstrap() {
        if (W &&
            W.loginManager &&
            W.loginManager.user &&
            W.map &&
            W.selectionManager &&
            W.model &&
            W.model.countries &&
            W.model.countries.getObjectArray().length) {
            ACHelper_init();
            log('started');
        } else {
            log('bootstrap failed. Trying again...');
            setTimeout(ACHelper_bootstrap, 700);
        }
    }

    function ACHelper_init() {
        var curRequest = {
            "author": "",
            "permalink": "",
            "requestedcity": "",
            "countrycode": "",
            "statecode": "",
            "row": "",
            "note": "",
            "addedcity": "",
            "status": ""
        };
        var curOptions = {
            'achAutoLock': (localStorage.getItem('achAutoLock') == 'true'),
            'achAutoSendEmail': (localStorage.getItem('achAutoSendEmail') == 'true'),
            'achAutoGoNextRequest': (localStorage.getItem('achAutoGoNextRequest') == 'true'),
            'achAutoSaveCity': (localStorage.getItem('achAutoSaveCity') == 'true')
        };
        var editPanel = $("#edit-panel");
        if (!editPanel) {
            setTimeout(ACHelper_init, 800);
            return;
        }

        var bordersLayer = new OL.Layer.Vector("City Borders", {
            displayInLayerSwitcher: true,
            uniqueName: "ACHBorders"
        });

        W.map.addLayer(bordersLayer);

        function drawCityBorder(cityname, coords)
        {
            bordersLayer.destroyFeatures();
            if (coords) {
                var gm = JSON.parse(coords);

                gm.coords.forEach(function(itemsA, i, arr) {
                    itemsA.forEach(function(itemsB, j, arr) {
                        var polyPoints = new Array(itemsB.length);
                        itemsB.forEach(function(itemsC, k, arr) {

                            polyPoints[k] = new OL.Geometry.Point(itemsC[0], itemsC[1]).transform(
                                new OL.Projection("EPSG:4326"), // transform from WGS 1984
                                W.map.getProjectionObject() // to Spherical Mercator Projection
                            );
                        });
                        var polygon = new OL.Geometry.Polygon(new OL.Geometry.LinearRing(polyPoints));
                        var site_style = new borderStyle('#FFFF00', cityname);

                        var poly = new OL.Feature.Vector(polygon, null, site_style);
                        bordersLayer.addFeatures(poly);
                    });
                });
            }
        }

        function borderStyle(color, label) {
            this.fill = false;
            this.stroke = true;
            this.strokeColor = color;
            this.strokeWidth = 3;
            this.label = label;
            this.fontSize = 20;
            this.fontColor = color;
            this.fontWeight = "bold";
        }

        function drawIndicator() {
            var tooltipText = "Количество&nbsp;необработанных запросов&nbsp;НП.&nbsp;Нажмите, чтобы&nbsp;перейти&nbsp;к&nbsp;первому.";

            var $outputElemContainer = $('<div>', { id: 'achCountContainer',
                                                    class: 'toolbar-button',
                                                    style: 'font-weight: bold; font-size: 16px; border-radius: 10px; padding-right: 10px; padding-left: 10px;'
                                                  });
            var $spinnerElem = $('<i>', { id: 'achSpinner',
                                          style: 'display:inline-block; position:relative; left:-3px;',
                                          class: ''
                                        });
            var $outputElem = $('<span>', { id: 'achCount',
                                           click: getCityRequest,
                                           style: 'text-decoration:none',
                                           'data-original-title': tooltipText
                                          });
            $outputElemContainer.append($spinnerElem);
            $outputElemContainer.append($outputElem);

            $('#edit-buttons').children().first().append($outputElemContainer);
            $outputElem.tooltip({
                placement: 'auto top',
                delay: {show: 100, hide: 100},
                html: true,
                template: '<div class="tooltip" role="tooltip" style="opacity:0.95"><div class="tooltip-arrow"></div><div class="my-tooltip-header"><b></b></div><div class="my-tooltip-body tooltip-inner" style="font-weight:600; !important"></div></div>'
            });

            getRequestsCount();
        }

        function drawTab() {
            var cfg = config[W.model.countries.top.abbr];

            if (!cfg) {
                // country is not supported
                return;
            }

            var panelID = "WME-ACH";
            var sItems = W.selectionManager.getSelectedFeatures();
            if (!document.getElementById(panelID) && sItems.length > 0 && sItems[0].model.type === 'segment') {
                var unsavedChanges = W.model.actionManager.unsavedActionsNum() > 0;
                var segInfo = getSegmentInfo();
                var panelElement = document.createElement('div');
                panelElement.id = panelID;

                var userTabs = document.getElementById('edit-panel');
                if (!userTabs) {
                    return;
                }

                var navTabs = getElementsByClassName('nav-tabs', userTabs)[0];
                if (typeof navTabs !== "undefined") {
                    var tabContent = getElementsByClassName('tab-content', userTabs)[0];

                    if (typeof tabContent !== "undefined") {
                        var newtab = document.createElement('li');
                        newtab.innerHTML = '<a href="#' + panelID + '" id="achTab" data-toggle="tab">ACH</a>';
                        navTabs.appendChild(newtab);

                        var html =
                            '<h5>WME Add City Helper <sup>' + GM_info.script.version + '</h5>' +
                            // block 0
                            '<div class="form-group">' +
                            '<label class="control-label">Информация о сегменте</label>' +
                            '<div class="additional-attributes">' +
                            '<label style="font-weight: bold;">City ID:&nbsp;</label>' +
                            '<span id="achCityID">' + (segInfo.cityID ? segInfo.cityID : 'N/A') +
                            '</span>' +
                            '<button id="achCopyCityID" class="btn-link" type="button" title="Скопировать в буфер" style="height: auto;">' +
                            '<i class="fa fa-clipboard"></i>' +
                            '</button>' +
                            '<span id="achCityName" style="color: ' + (segInfo.cityName && unsavedChanges && segInfo.status === "Update" ? '#e54444' : '#000000') + ';">' + (segInfo.cityName ? segInfo.cityName : 'N/A') +
                            '</span>' +
                            '</br>' +
                            '<label style="font-weight: bold;">State ID:&nbsp;</label>' +
                            '<span id="achStateID">' + (segInfo.stateID ? segInfo.stateID : 'N/A') +
                            '</span>' +
                            '<button id="achCopyStateID" class="btn-link" type="button" title="Скопировать в буфер" style="height: auto;">' +
                            '<i class="fa fa-clipboard"></i>' +
                            '</button>' +
                            '<span id="achStateName" style="color: ' + (segInfo.stateName && unsavedChanges && segInfo.status === "Update" ? '#e54444' : '#000000') + ';">' + (segInfo.stateName ? segInfo.stateName : 'N/A') +
                            '</span>' +
                            '</div>' +
                            '</div>' +
                            // end 0
                            // block 1
                            '<div class="form-group">' +
                            '<div style="float:right; z-index:100; cursor:pointer; top:0; right:0;" id="achClearRequest" title="Очистить данные о запросе"><i class="fa fa-times-circle fa-lg" aria-hidden="true"></i></div>' +
                            '<label class="control-label">Текущий запрос НП</label>' +
                            // city
                            '<div class="controls input-group">' +
                            // goto button
                            '<span class="input-group-btn">' +
                            '<button id="achJumpToRequest" class="btn btn-primary" type="button" data-original-title="" title="Перейти к сегменту" style="padding: 0 8px; border-bottom-right-radius: 0; border-top-right-radius: 0; font-size: 16px">' +
                            '<i class="fa fa-crosshairs"></i>' +
                            '</button>' +
                            '</span>' +
                            '<input class="form-control" autocomplete="off" maxlength="100" id="achRequestedCity" name="" title="Запрошенное имя НП" type="text" value="N/A" readonly="readonly" />' +
                            // apply button
                            '<span class="input-group-btn">' +
                            '<button id="achApplyRequestedCity" class="btn btn-primary" type="button" data-original-title="" title="Вставить это имя в поле ввода" style="padding: 0 8px; border-bottom-left-radius: 0; border-top-left-radius: 0; font-size: 16px">' +
                            '<i class="fa fa-paw"></i>' +
                            '</button>' +
                            '</span>' +
                            '</div>' +
                            '</div>' +
                            // author
                            '<div class="form-group">' +
                            '<label class="control-label">Автор</label>' +
                            '<div class="controls">' +
                            '<span id="achAuthor">N/A</span></br>' +
                            '</div>' +
                            '</div>' +
                            // status
                            '<div class="form-group">' +
                            '<label class="control-label">Статус</label>' +
                            '<div class="controls">' +
                            '<span id="achStatus" style="font-weight: bold;">N/A</span>' +
                            '</div>' +
                            '</div>' +
                            // actions
                            '<div class="form-group">' +
                            '<label class="control-label">Действия с запросом</label>' +
                            '<div class="controls">' +
                            '<div class="btn-toolbar">' +
                            // lock request
                            '<button id="achLockRequest" class="btn btn-info" type="button" title="Взять запрос в работу (залочить)" style="font-size: 16px; padding: 6px 16px;">' +
                            '<i class="fa fa-lock"></i>' +
                            '</button>' +
                            // approve
                            '<div class="btn-group">' +
                            '<button id="achApproveRequest" class="btn btn-success" type="button" title="Одобрить запрос" style="font-size: 16px; padding: 6px 14px;">' +
                            '<i class="fa fa-thumbs-up"></i>' +
                            '</button>' +
                            '<button id="achApproveRequestDd" type="button" class="btn btn-success dropdown-toggle" data-toggle="dropdown" style="padding: 6px;">' +
                            '<span class="caret"></span>' +
                            '</button>' +
                            '<ul class="dropdown-menu" role="menu">' +
                            '<li><a id="achApproveWithComment" href="#"><i class="fa fa-plus"></i>&nbsp;Комментарий</a></li>' +
                            '</ul>' +
                            '</div>' +
                            // decline
                            '<button id="achDeclineRequest" class="btn btn-danger" type="button" title="Отказать" style="font-size: 16px; padding: 6px 16px;">' +
                            '<i class="fa fa-thumbs-down"></i>' +
                            '</button>' +
                            // send email
                            '<button id="achSendEmail" class="btn btn-default" type="button" title="Отправить письмо" style="font-size: 16px; padding: 6px 16px;">' +
                            '<i class="fa fa-envelope-o"></i>' +
                            '</button>' +
                            // skip request
                            '<button id="achSkipRequest" class="btn btn-warning" type="button" title="Перейти к следующему запросу" style="font-size: 16px; padding: 6px 16px;">' +
                            '<i class="fa fa-forward"></i>' +
                            '</button>' +
                            // goto table cell
                            '<button id="achGotoTableCell" class="btn-link" type="button" title="Перейти к запросу в таблице" style="">' +
                            '<i class="fa fa-external-link"></i>&nbsp;Перейти к запросу в таблице' +
                            '</button>' +
                            '</div>' +
                            '</div>' +
                            '</div>' +
                            // end 1

                            // Level 5 save
                            '<div class="form-group">' +
                            '<label class="control-label">Другие действия</label>' +
                            '<div class="controls">' +
                            '<button id="achSaveLevel5" class="action-button btn btn-positive btn-success" type="button" title="L5 Save: Сохранить информацию о созданном НП в таблице Level 5">' +
                            '<i class="fa fa-save"></i>&nbsp;Создал НП без запроса' +
                            '</button>' +
                            '</div>' +
                            '</div>';

                        html +=
                            // block 2
                            '<div id="achMinRegionSection">' +
                            '</br>' +
                            '<div class="form-group">' +
                            '<label class="control-label">МинРегион</label>' +
                            // check name in MinRegion
                            '<div class="controls">' +
                            '<button id="achCheckInMinRegion" class="action-button btn btn-lightning btn-positive" type="button" title="Проверить имя в МинРегионе">' +
                            '<i class="fa fa-map-o"></i>&nbsp;Проверить' +
                            '</button>' +
                            '</div>' +
                            '</div>' +
                            // foundName
                            '<div class="form-group">' +
                            '<label class="control-label">Согласно МинРегиону здесь находится</label>' +
                            '<div class="controls input-group">' +
                            '<input class="form-control" autocomplete="off" id="achFoundCity" name="" title="Найденный НП" type="text" value="N/A" readonly="readonly" />' +
                            '<span class="input-group-btn">' +
                            '<button id="achApplyFoundCity" class="btn btn-primary" type="button" data-original-title="" title="Использовать это имя" style="padding: 0 8px; border-bottom-left-radius: 0; border-top-left-radius: 0; font-size: 16px">' +
                            '<i class="fa fa-paw"></i>' +
                            '</button>' +
                            '</span>' +
                            '</div>' +
                            '</div>' +
                            // suggestedName
                            '<div class="form-group">' +
                            '<label class="control-label">Имя с учетом правил именования</label>' +
                            '<div class="controls input-group">' +
                            '<input class="form-control" autocomplete="off" id="achSuggestedName" name="" title="Предложенное имя для НП" type="text" value="N/A" readonly="readonly" />' +
                            '<span class="input-group-btn">' +
                            '<button id="achApplySuggestedCity" class="btn btn-primary" type="button" data-original-title="" title="Использовать это имя" style="padding: 0 8px; border-bottom-left-radius: 0; border-top-left-radius: 0; font-size: 16px">' +
                            '<i class="fa fa-paw"></i>' +
                            '</button>' +
                            '</span>' +
                            '</div>' +
                            '</div>' +
                            // result
                            '<div class="form-group">' +
                            '<label class="control-label">Ответ анализатора</label>' +
                            '<div class="controls">' +
                            '<label style="font-weight: bold;">Статус:&nbsp;</label>' +
                            '<span id="achMRResponseStatus" style="font-weight: bold;"></span></br>' +
                            '<label style="font-weight: bold;">Комментарии:</label></br>' +
                            '<span id="achMRResponseComments"></span>' +
                            '</div>' +
                            '</div>' +
                            '</div>';
                        // end 2

                        // block 3 - settings
                        html +=
                            '<div class="form-group">' +
                            '<div id="achSettingsHeader">' +
                            '<label class="control-label" style="cursor: pointer;"><i class="fa fa-plus-square" style="margin-right: 5px;"></i>Настройки</label>' +
                            '</div>' +
                            '<div id="achSettingsContent" class="controls" style="border: 1px solid #d3d3d3; padding: 5px; display: none;">' +
                            '<input type="checkbox" id="achAutoLock" /><label for="achAutoLock" style="margin-bottom: 0px; font-weight: normal;">Авто-лок запроса при получении</label><br/>' +
                            '<input type="checkbox" id="achAutoSendEmail" /><label for="achAutoSendEmail" style="margin-bottom: 0px; font-weight: normal;">Авто-отправка письма при <i class="fa fa-thumbs-up"></i> или <i class="fa fa-thumbs-down"></i></label><br/>' +
                            '<input type="checkbox" id="achAutoGoNextRequest" /><label for="achAutoGoNextRequest" style="margin-bottom: 0px; font-weight: normal;">Авто-переход к след. запросу</label><br/>' +
                            '<input type="checkbox" id="achAutoSaveCity" /><label for="achAutoSaveCity" style="margin-bottom: 0px; font-weight: normal;">Авто-сохранение НП при <i class="fa fa-thumbs-up"></i></label><br/>' +
                            '</div>' +
                            '</div>';
                        // end 3

                        panelElement.innerHTML = html;
                        panelElement.className = "tab-pane";
                        tabContent.appendChild(panelElement);
                    }
                    else {
                        panelElement.id = '';
                    }
                }
                else {
                    panelElement.id = '';
                }

                if (panelElement.id !== '') {
                    document.getElementById('achCopyCityID').onclick = function() {
                        GM_setClipboard(document.getElementById('achCityID').innerHTML);
                    };
                    document.getElementById('achCopyStateID').onclick = function() {
                        GM_setClipboard(document.getElementById('achStateID').innerHTML);
                    };
                    document.getElementById('achClearRequest').onclick = function() {
                        curRequest = {};
                        updateRequestInfo();
                        updateRequestStatus();
                    };
                    document.getElementById('achJumpToRequest').onclick = function() {
                        if (curRequest.permalink) {
                            jumpToLink(curRequest.permalink);
                        }
                    };
                    document.getElementById('achApplyRequestedCity').onclick = function() {
                        var cityName = document.getElementById('achRequestedCity').value;
                        if (cityName !== '' && cityName !== 'N/A') {
                            var cutCity = cityName;
                            // for cases, like "City (Region1) (Region2" - cut only last region
                            var regx = /\s\(\w+$/;
                            if (cityName.match(regx)) {
                                cutCity = cityName.replace(regx, "").trim();
                            }
                            else {
                                cutCity = cityName.split('(')[0].trim();
                            }
                            changeCity(cutCity, false);

                            // display it bold and red
                            var cityTextBox = $('input[name="cityName"]');
                            if (cityTextBox && cityTextBox.val() == cityName) {
                                var cn = document.getElementById('achCityName');
                                cn.innerHTML = cityName;
                                cn.style.color = '#e54444';
                                cn.style.fontWeight = 'bold';

                                cn = document.getElementById('achStateName');
                                cn.innerHTML = $('select[name="stateID"]').text().trim();
                                cn.style.color = '#e54444';
                                cn.style.fontWeight = 'bold';
                            }
                        }

                        return false;
                    };
                    document.getElementById('achLockRequest').onclick = onLockRequest;

                    document.getElementById('achApproveRequest').onclick = function() {
                        onApproveRequest(false);
                    };
                    document.getElementById('achApproveWithComment').onclick = function(e) {
                        onApproveRequest(true);
                        e.preventDefault();
                    };

                    document.getElementById('achDeclineRequest').onclick = onDeclineRequest;
                    document.getElementById('achSendEmail').onclick = function() {
                        onSendEmail();
                    };
                    document.getElementById('achSkipRequest').onclick = onSkipRequest;
                    document.getElementById('achSaveLevel5').onclick = onSaveLevel5;

                    // Settings
                    // container expander
                    $("#achSettingsHeader").click(function () {
                        var header = $(this);
                        var content = header.next();
                        content.slideToggle(333, function () {
                            header.find("i").removeClass().addClass(function () {
                                return content.is(":visible") ? "fa fa-minus-square" : "fa fa-plus-square";
                            });
                        });
                    });
                    // init checkboxes state
                    var chk = document.getElementById('achAutoLock');
                    chk.checked = curOptions[chk.id];
                    chk.onclick = function() {
                        curOptions[this.id] = this.checked;
                        localStorage.setItem(this.id, this.checked.toString());
                        document.getElementById('achLockRequest').style.display = this.checked ? 'none' : 'block';
                    };
                    document.getElementById('achLockRequest').style.display = chk.checked ? 'none' : 'block';

                    chk = document.getElementById('achAutoSendEmail');
                    chk.checked = curOptions[chk.id];
                    chk.onclick = function() {
                        curOptions[this.id] = this.checked;
                        localStorage.setItem(this.id, this.checked.toString());
                        document.getElementById('achSendEmail').style.display = this.checked ? 'none' : 'block';
                    };
                    document.getElementById('achSendEmail').style.display = chk.checked ? 'none' : 'block';

                    chk = document.getElementById('achAutoGoNextRequest');
                    chk.checked = curOptions[chk.id];
                    chk.onclick = function() {
                        curOptions[this.id] = this.checked;
                        localStorage.setItem(this.id, this.checked.toString());
                    };

                    chk = document.getElementById('achAutoSaveCity');
                    chk.checked = curOptions[chk.id];
                    chk.onclick = function() {
                        curOptions[this.id] = this.checked;
                        localStorage.setItem(this.id, this.checked.toString());
                    };

                    // Ukraine related
                    document.getElementById('achCheckInMinRegion').onclick = onCheckMinRegion;
                }
            }

            if (document.getElementById(panelID) !== null) {
                // Change config related options
                // All countries
                document.getElementById('achApplySuggestedCity').onclick = function() {
                    var cityName = document.getElementById('achSuggestedName').value;
                    if (cityName !== '' && cityName !== 'N/A') {
                        changeCity(cityName, true, cfg.code);
                    }
                    return false;
                };
                document.getElementById('achGotoTableCell').onclick = function() {
                    var w = window.open();
                    w.location = cfg.requestsTable + '&range=' + curRequest.row + ':' + curRequest.row;
                };
                // Ukraine related
                document.getElementById('achApplySuggestedCity').disabled = true;
                document.getElementById('achApplyFoundCity').disabled = true;
                document.getElementById('achApplyFoundCity').onclick = function() {
                    var cityName = document.getElementById('achFoundCity').value;
                    if (cityName !== '' && cityName !== 'N/A') {
                        changeCity(cityName, false, cfg.code);
                    }
                    return false;
                };
                document.getElementById('achMinRegionSection').style.display = cfg.code == "232" ? 'block' : 'none';

                // update data
                updateRequestInfo();
                updateRequestStatus();
            }
        }

        function setButtonClass(id, className) {
            if (id) {
                var elem = document.getElementById(id);
                if (elem) {
                    var iButton = elem.firstChild;
                    if (iButton && iButton.className !== className) {
                        iButton.className = className;
                    }
                }
            }
        }

        function setRequestStatus(statusText) {
            curRequest.status = statusText ? statusText : '';
            updateRequestStatus();
        }

        function updateRequestInfo() {
            if (curRequest.requestedcity) {
                document.getElementById('achAuthor').innerHTML = curRequest.author;
                document.getElementById('achRequestedCity').value = curRequest.requestedcity;
                document.getElementById('achJumpToRequest').disabled = false;
                document.getElementById('achApplyRequestedCity').disabled = false;

                document.getElementById("achTab").click();
            }
            else {
                document.getElementById('achAuthor').innerHTML = "N/A";
                document.getElementById('achRequestedCity').value = "N/A";
                document.getElementById('achJumpToRequest').disabled = true;
                document.getElementById('achApplyRequestedCity').disabled = true;
                document.getElementById('achGotoTableCell').disabled = true;

                drawCityBorder(null, null);
            }
        }

        function updateRequestStatus() {
            var inputStatus = document.getElementById('achStatus');

            if (inputStatus) {
                var btn1 = document.getElementById('achLockRequest');
                var btn2 = document.getElementById('achApproveRequest');
                var btn22 = document.getElementById('achApproveRequestDd');
                var btn3 = document.getElementById('achDeclineRequest');
                var btn4 = document.getElementById('achSendEmail');

                inputStatus.innerHTML = curRequest.status ? curRequest.status : 'N/A';

                switch (curRequest.status)
                {
                    case 'active':
                        btn1.disabled = false;
                        btn2.disabled = false;
                        btn22.disabled = false;
                        btn3.disabled = false;
                        btn4.disabled = true;
                        inputStatus.style.color = 'blue';
                        break;
                    case 'locked':
                        btn1.disabled = true;
                        btn2.disabled = false;
                        btn22.disabled = false;
                        btn3.disabled = false;
                        btn4.disabled = true;
                        inputStatus.style.color = '#a05fa5';
                        break;
                    case 'approved':
                        btn1.disabled = true;
                        btn2.disabled = true;
                        btn22.disabled = true;
                        btn3.disabled = true;
                        btn4.disabled = false;
                        inputStatus.style.color = '#62a25f';
                        break;
                    case 'approved, emailed':
                        btn1.disabled = true;
                        btn2.disabled = true;
                        btn22.disabled = true;
                        btn3.disabled = true;
                        btn4.disabled = true;
                        inputStatus.style.color = '#62a25f';
                        break;
                    case 'declined':
                        btn1.disabled = true;
                        btn2.disabled = true;
                        btn22.disabled = true;
                        btn3.disabled = true;
                        btn4.disabled = false;
                        inputStatus.style.color = '#e54444';
                        break;
                    case 'declined, emailed':
                        btn1.disabled = true;
                        btn2.disabled = true;
                        btn22.disabled = true;
                        btn3.disabled = true;
                        btn4.disabled = true;
                        inputStatus.style.color = '#e54444';
                        break;
                    default:
                        btn1.disabled = true;
                        btn2.disabled = true;
                        btn22.disabled = true;
                        btn3.disabled = true;
                        btn4.disabled = true;
                        inputStatus.style.color = 'black';
                        break;
                }
            }
        }

        function onSaveLevel5() {
            function requestCallback(res) {
                if (validateHTTPResponse(res)) {
                    var msg = "Error processing request. Response: " + res.responseText;
                    var text = JSON.parse(res.responseText);

                    if (text.result) {
                        if (text.result == 'found') {
                            msg = "ACH: НП найден в таблице '" + text.sheet + "'. Строка " + text.line;
                        }
                        else if (text.result == 'add') {
                            msg = "ACH: НП успешно добавлен в таблицу.";
                        }
                    }
                    alert(msg);
                }
            }
            var cfg = config[W.model.countries.top.abbr];

            if (cfg) {
                var segInfo = getSegmentInfo();
                var user = W.loginManager.user.userName;

                if (segInfo.cityName && segInfo.date && segInfo.cityID && segInfo.permalink) {
                    var permalink = encodeURIComponent(segInfo.permalink);
                    var url = cfg.apiUrl + '?func=saveLevel5&p1=' + user + '&p2=' + segInfo.cityName + '&p3=' + permalink + '&p4=' + segInfo.date + '&p5=' + segInfo.cityID + '&p6=' + segInfo.stateID;
                    sendHTTPRequest(url, 'achSaveLevel5', 'fa fa-save', requestCallback);
                }
                else {
                    alert('ACH: Не могу отправить запрос сохранения - некоторые нужные поля пустые!');
                }
            }
        }

        function onLockRequest() {
            function requestCallback(res) {
                if (validateHTTPResponse(res)) {
                    var text = JSON.parse(res.responseText);
                    if (text.result == 'success') {
                        setRequestStatus('locked');
                        document.getElementById('achLockRequest').disabled = true;
                    }
                    else {
                        alert('ACH: ' + text.result);
                    }
                }
            }
            var user = W.loginManager.user.userName;
            var cfg = config[W.model.countries.top.abbr];

            if (curRequest.row && cfg) {
                var url = cfg.apiUrl + '?func=processRequest&row=' + curRequest.row + '&user=' + user + '&action=lock';
                sendHTTPRequest(url, 'achLockRequest', 'fa fa-lock', requestCallback);
            }
        }

        function onCheckMinRegion() {
            function requestCallback(res) {
                if (validateHTTPResponse(res)) {
                    var text = JSON.parse(res.responseText);
                    if (!text.version || parseInt(text.version) < minAnalyzerVersion) {
                        alert("ACH: Ваша версия анализатора для МинРегиона устарела. Пожалуйста, скачайте новую!");
                        updateMinRegionInfo(emptyResponse);
                    }
                    updateMinRegionInfo(text);
                }
            }

            var emptyResponse = {};
            var lnk;

            var selectedItem = W.selectionManager.getSelectedFeatures()[0];
            if (selectedItem) {
                log("MinRegion check by object Centroid");

                var centroid = selectedItem.geometry.getCentroid(true); // without "true" it will return start point as a centroid
                lnk = OL.Layer.SphericalMercator.inverseMercator(centroid.x, centroid.y);
            }
            else if (curRequest.permalink) {
                log("MinRegion check by request permalink");
                lnk = parseLink(curRequest.permalink);
            }
            else {
                alert("ACH: This type of check is not supported yet!");
            }

            if (lnk) {
                updateMinRegionInfo(emptyResponse);

                var url = analyzerUrl + '?lon=' + lnk.lon + '&lat=' + lnk.lat;
                sendHTTPRequest(url, 'achCheckInMinRegion', 'fa fa-map-o', requestCallback);
            }
        }

        function onApproveRequest(askForComment) {
            function requestCallback(res) {
                if (validateHTTPResponse(res)) {
                    var text = JSON.parse(res.responseText);
                    if (text.result == 'success') {
                        setRequestStatus('approved');

                        if (curOptions['achAutoSendEmail']) {
                            onSendEmail('achApproveRequest', 'fa fa-thumbs-up');
                        }
                    }
                    else {
                        alert('ACH: ' + text.result);
                    }
                }
            }
            var user = W.loginManager.user.userName;
            var cfg = config[W.model.countries.top.abbr];

            if (curRequest.row && cfg) {
                var segInfo = getSegmentInfo();

                if (!(segInfo.streetID && segInfo.cityName)) {
                    alert("ACH Ошибка: сегмент без названия. Возможно Вы забыли присвоить сегменту НП?");
                    return;
                }
                if (W.model.actionManager.unsavedActionsNum() > 0) {
                    if (curOptions['achAutoSaveCity']) {
                        // autosave
                        $('.waze-icon-save').click();
                    }
                    else {
                        alert("ACH: Похоже, что Вы забыли сохранить изменения в редакторе.\nСохраните перед одобрением запроса ;)");
                        return;
                    }
                }
                curRequest.addedcity = segInfo.cityName;
                if (askForComment) {
                    curRequest.note = prompt('Обработанный НП: ' + curRequest.addedcity +
                                             (segInfo.stateID != 1 ? '\nРегион (штат): ' + segInfo.stateName : '') +
                                             '\nОдобрить запрос? Добавьте комментарий, если необходимо.', '');
                }
                else {
                    curRequest.note = '';
                }

                if (curRequest.note !== null) {
                    var url = cfg.apiUrl + '?func=processRequest&row=' + curRequest.row + '&user=' + user + '&addedcity=' + curRequest.addedcity + '&action=approve&stateid=' + segInfo.stateID + '&note=' + curRequest.note;
                    sendHTTPRequest(url, 'achApproveRequest', 'fa fa-thumbs-up', requestCallback);
                }
            }
        }

        function onDeclineRequest() {
            function requestCallback(res) {
                if (validateHTTPResponse(res)) {
                    var text = JSON.parse(res.responseText);
                    if (text.result == 'success') {
                        setRequestStatus('declined');

                        if (curOptions['achAutoSendEmail']) {
                            onSendEmail('achDeclineRequest', 'fa fa-thumbs-down');
                        }
                    }
                    else {
                        alert('ACH: ' + text.result);
                    }
                }
            }
            var user = W.loginManager.user.userName;
            var cfg = config[W.model.countries.top.abbr];

            if (curRequest.row && cfg) {
                var segInfo = getSegmentInfo();

                curRequest.addedcity = segInfo.cityName;
                curRequest.note = prompt('Причина отказа?', document.getElementById('achMRResponseStatus').innerHTML.match(/City eliminated/i) ? 'НП Ліквідовано' : 'Такой НП уже существует.');

                if (curRequest.note !== null) {
                    var url = cfg.apiUrl + '?func=processRequest&row=' + curRequest.row + '&user=' + user + '&addedcity=' + curRequest.addedcity + '&action=decline&stateid=' + segInfo.stateID + '&note=' + curRequest.note;
                    sendHTTPRequest(url, 'achDeclineRequest', 'fa fa-thumbs-down', requestCallback);
                }
            }
        }

        function onSendEmail(buttonId, buttonClass) {
            function requestCallback(res) {
                if (validateHTTPResponse(res)) {
                    var text = JSON.parse(res.responseText);
                    if (text.result == 'success') {
                        setRequestStatus(curRequest.status + ", emailed");
                        //alert("ACH: Письмо успешно отправлено!");

                        if (curOptions['achAutoGoNextRequest']) {
                            getCityRequest(null, 'achSkipRequest', 'fa fa-forward');
                        }
                        else {
                            // update counter
                            getRequestsCount();
                        }
                    }
                    else {
                        alert('ACH: ' + text.result);
                    }
                }
            }

            var cfg = config[W.model.countries.top.abbr];

            if (curRequest.row && cfg) {
                var url = cfg.apiUrl + '?func=sendEmail&row=' + curRequest.row;
                sendHTTPRequest(url, buttonId ? buttonId : 'achSendEmail', buttonClass ? buttonClass : 'fa fa-envelope-o', requestCallback);
            }
        }

        function onSkipRequest() {
            var cfg = config[W.model.countries.top.abbr];

            if (cfg) {
                getCityRequest(curRequest.row ? curRequest.row : null, 'achSkipRequest', 'fa fa-forward');
            }
        }

        function sendHTTPRequest(url, buttonID, btnClass, callback) {
            setButtonClass(buttonID, 'fa fa-spinner fa-pulse'); // to make ViolentMonkey happy
            GM_xmlhttpRequest({
                url: url,
                method: 'GET',
                timeout: requestsTimeout,
                onload: function(res) {
                    setButtonClass(buttonID, btnClass);
                    callback(res);
                },
                onreadystatechange: function(res) {
                    setButtonClass(buttonID, 'fa fa-spinner fa-pulse');
                },
                ontimeout: function(res) {
                    setButtonClass(buttonID, btnClass);
                    alert("ACH: Sorry, request timeout!");
                },
                onerror: function(res) {
                    setButtonClass(buttonID, btnClass);
                    alert("ACH: Sorry, request error!");
                }
            });
        }

        function validateHTTPResponse(res) {
            var result = false, displayError = true;
            if (res) {
                switch (res.status) {
                    case 200:
                        displayError = false;
                        if (res.responseHeaders.match(/content-type: application\/json/i)) {
                            result = true;
                        }
                        else if (res.responseHeaders.match(/content-type: text\/html/i)) {
                            displayHtmlPage(res);
                        }
                        break;
                    default:
                        displayError = false;
                        alert("ACH Error: unsupported status code - " + res.status);
                        log(res.responseHeaders);
                        log(res.responseText);
                        break;
                }
            }
            else {
                displayError = false;
                alert("ACH Error: Response is empty!");
            }

            if (displayError) {
                alert("ACH: Error processing request. Response: " + res.responseText);
            }
            return result;
        }

        function updateMinRegionInfo(rs) {
            var disableButtons = true;

            if (rs && rs.foundcity) {
                disableButtons = false;
                document.getElementById('achFoundCity').value = rs.foundcity;
                document.getElementById('achSuggestedName').value = rs.suggestedcity;

                // draw border
                drawCityBorder(rs.foundcity, rs.geometry);
            }
            else {
                document.getElementById('achFoundCity').value = 'N/A';
                document.getElementById('achSuggestedName').value = 'N/A';

                drawCityBorder(null, null);
            }

            if (rs && rs.status) {
                var st = rs.status.join('</br>');
                var cm = rs.comments.join('</br>');
                document.getElementById('achMRResponseStatus').style.color = (st == 'OK' ? 'green' : (st.match(/error/i) ? 'red' : 'darkorange'));
                document.getElementById('achMRResponseStatus').innerHTML = st;
                document.getElementById('achMRResponseComments').innerHTML = cm;
            }
            else {
                document.getElementById('achMRResponseStatus').innerHTML = '';
                document.getElementById('achMRResponseComments').innerHTML = '';
            }

            document.getElementById('achApplyFoundCity').disabled = disableButtons;
            document.getElementById('achApplySuggestedCity').disabled = disableButtons;
        }

        function processGetResult(rq) {
            if (rq && rq.city) {

                GM_setClipboard(rq.city);

                curRequest.author = rq.requestor;
                curRequest.requestedcity = rq.city;
                curRequest.permalink = rq.permalink;
                curRequest.row = rq.row;
                curRequest.countrycode = rq.countrycode;
                curRequest.statecode = rq.statecode;

                jumpToLink(rq.permalink);

                if (curOptions['achAutoLock']) {
                    onLockRequest();
                }
            }
            else {
                curRequest.author = '';
                curRequest.requestedcity = '';
                curRequest.permalink = '';
                curRequest.row = '';
                curRequest.status = '';
                curRequest.countrycode = '';
                curRequest.statecode = '';
            }
        }

        function jumpToLink(permalink) {
            var lnk = parseLink(permalink);

            function mergestart() {
                W.model.events.unregister("mergestart", null, mergestart);
                W.model.events.register("mergeend", null, mergeend);
            }
            function mergeend() {
                W.model.events.unregister("mergeend", null, mergeend);

                if (lnk.segments) {
                    // autoselect any visible segment for bot generated links
                    if (lnk.segments == "-101") {
                        //lnk.segments = Object.keys(W.model.segments.objects)[0];
                        var segments = W.model.segments.objects;
                        var mapExtent = W.map.getExtent();

                        for (var s in segments) {
                            if (!segments.hasOwnProperty(s)) {
                                continue;
                            }

                            var seg = W.model.segments.get(s);
                            if (mapExtent.intersectsBounds(seg.geometry.getBounds())) {
                                //debugger;
                                lnk.segments = s;
                                // one is enough for now
                                break;
                            }
                        }
                    }
                    // if we have multiple selection
                    var segArray = lnk.segments.split(",");
                    var objects = [];
                    for (var i = 0; i < segArray.length; i++) {
                        var sObj = W.model.segments.objects[segArray[i]];
                        if (sObj) {
                            objects.push(sObj);
                        }
                    }
                    if (objects.length > 0) {
                        W.selectionManager.setSelectedModels(objects);
                    }
                }
            }

            if (!(lnk.lon && lnk.lat && lnk.segments)) {
                alert("ACH: error parsing permalink: " + permalink);
                return;
            }

            W.model.events.register("mergestart", null, mergestart);

            W.selectionManager.unselectAll();
            var xy = OL.Layer.SphericalMercator.forwardMercator(parseFloat(lnk.lon), parseFloat(lnk.lat));
            W.map.setCenter(xy, (lnk.zoom && lnk.zoom > 3 ? parseInt(lnk.zoom) : minZoomLevel));
        }

        function parseLink(permalink) {
            var link = {};

            var parts = permalink.split('?');
            var attrs = parts[1].split('&');
            for (var i = 0; attrs[i]; i++) {
                var attrName = attrs[i].split('=');
                switch (attrName[0]) {
                    case "lat":
                        link.lat = attrName[1];
                        break;
                    case "lon":
                        link.lon = attrName[1];
                        break;
                    case "zoom":
                        link.zoom = attrName[1];
                        break;
                    case "segments":
                        link.segments = attrName[1];
                        break;
                    default:
                        break;
                }
            }
            return link;
        }

        function getSegmentInfo() {
            var segInfo = {};

            var selectedItem = W.selectionManager.getSelectedFeatures()[0];
            if (selectedItem && selectedItem.model.type === "segment") {
                segInfo.status = selectedItem.model.state;
                var attr = selectedItem.model.attributes;
                if (attr) {
                    // 1
                    segInfo.id = attr.id;

                    if (attr.primaryStreetID) {
                        // 2
                        segInfo.streetID = attr.primaryStreetID;

                        var street = W.model.streets.getObjectById(attr.primaryStreetID);
                        if (street) {
                            // 3
                            segInfo.streetName = street.name;
                            if (street.cityID) {
                                // 4
                                segInfo.cityID = street.cityID;
                                var city = W.model.cities.getObjectById(street.cityID);
                                // 5
                                segInfo.cityName = city.attributes.name;

                                if (city.attributes.stateID) {
                                    // 6
                                    segInfo.stateID = city.attributes.stateID;
                                    var state = W.model.states.getObjectById(city.attributes.stateID);
                                    // 7
                                    segInfo.stateName = state.name;
                                }
                            }
                        }
                    }
                    // 8
                    var attrDate = attr.updatedOn ? attr.updatedOn : attr.createdOn;
                    if (attrDate) {
                        segInfo.date = new Date(attrDate).toISOString();
                    }

                    // generate permalink
                    var centroid = selectedItem.geometry.getCentroid(true); // without "true" it will return start point as a centroid
                    var lnk = OL.Layer.SphericalMercator.inverseMercator(centroid.x, centroid.y);
                    // 9
                    segInfo.permalink = location.origin + location.pathname + "?env=row&lon=" + lnk.lon + "&lat=" + lnk.lat + "&zoom=4&segments=" + attr.id;
                }
            }

            return segInfo;
        }

        function getCityRequest(row, btnID, btnClass) {
            function requestCallback(res) {
                var count = "error";
                if (validateHTTPResponse(res)) {
                    var text = JSON.parse(res.responseText);
                    count = text.count;
                    if (text.result == 'success') {
                        setRequestStatus(text.status);
                        processGetResult(text);
                    }
                    else if (text.result == 'nothing to process') {
                        alert("ACH: Нет доступных запросов для обработки.");
                        // set request to empty
                        processGetResult();
                    }
                    else {
                        alert('ACH: ' + text.result);
                        // set request to empty
                        processGetResult();
                    }
                }
                updateRequestsCount(count);
            }

            var cfg = config[W.model.countries.top.abbr];
            if (cfg) {
                var user = W.loginManager.user.userName;

                var url = cfg.apiUrl + '?func=getCityRequest&user=' + user;
                if (row) {
                    url = url + '&row=' + row;
                }
                if (btnID && btnClass) {
                    sendHTTPRequest(url, btnID, btnClass, requestCallback);
                }
                else {
                    sendHTTPRequest(url, 'achCountContainer', '', requestCallback);
                }
            }
        }

        function updateRequestsCount(count) {
            var textColor = '';
            var bgColor = '';
            var tooltipTextColor = 'white';

            if (parseInt(count) === 0) {
                textColor = 'white';
                bgColor = 'green';
            }
            else if (parseInt(count) > 0 && parseInt(count) <= 50) {
                bgColor = 'yellow';
                tooltipTextColor = 'black';
            }
            else {
                textColor = 'white';
                bgColor = 'red';
            }

            $('#achCountContainer').css('background-color', bgColor);
            $('#achCount').css('color', textColor).html('Запросы НП: ' + count);
            $('#achSpinner').css('color', textColor);
        }

        function getRequestsCount() {
            function requestCallback(res) {
                var count = "error";
                if (validateHTTPResponse(res)) {
                    var text = JSON.parse(res.responseText);
                    count = text.count;
                }
                updateRequestsCount(count);
            }

            var cfg = config[W.model.countries.top.abbr];
            if (cfg) {
                var url = cfg.apiUrl + '?func=getRequestsCount';
                sendHTTPRequest(url, null, null, requestCallback);
            }
        }

        function displayHtmlPage(res) {
            if (res.responseText.match(/Authorization needed/) || res.responseText.match(/ServiceLogin/)) {
                alert("WME Add City Helper:\n" +
                      "Для работы с таблицей запросов необходима авторизация. Это разовое действие.\n" +
                      "Сейчас Вы будете перенаправлены на внешнюю страницу, где сможете подтвердить права доступа.\n" +
                      "После подтверждения закройте страницу и перезагрузите редактор, чтобы изменения вступили в силу.");
            }
            var w = window.open();
            w.document.open();
            w.document.write(res.responseText);
            w.document.close();
            //if (res.responseText.match(/ServiceLogin/)) {
                w.location = res.finalUrl;
            //}
        }

        function getElementsByClassName(classname, node) {
            if (!node) {
                node = document.getElementsByTagName("body")[0];
            }
            var a = [];
            var re = new RegExp('\\b' + classname + '\\b');
            var els = node.getElementsByTagName("*");
            for (var i = 0, j = els.length; i < j; i++) {
                if (re.test(els[i].className)) a.push(els[i]);
            }
            return a;
        }

        // thanks, guys, for the functions :)
        function changeCity(cityName, doSave, forcedCountryCode) {
            function getEditFormControlName(id) {
                var beta = (location.hostname == "editor-beta.waze.com" ? true : false);

                var controlsMap = {
                    form: beta ? '.full-address' : '.full-address',
                    country: beta ? 'select[class~="country-id"]' : 'select[class~="country-id"]',
                    state: beta ? 'select[class~="state-id"]' : 'select[class~="state-id"]',
                    cityname: beta ? 'input[class~="city-name"]' : 'input[class~="city-name"]',
                    citynamecheck: beta ? '#empty-city' : '#empty-city',
                    streetname: beta ? 'input[class~="street-name"]' : 'input[class~="street-name"]',
                    streetnamecheck: beta ? '#empty-street' : '#empty-street',
                    save: beta ? 'button[class~="save-button"]' : 'button[class~="save-button"]',
                    cancel: beta ? 'button[class~="cancel-button"]' : 'button[class~="cancel-button"]'
                };

                return controlsMap[id];
            }
            $(getEditFormControlName('form')).click();

            var cityChanged = false;
            var city = $(getEditFormControlName('cityname'));
            if (city.val() == cityName) {
                alert('ACH: Сегмент уже имеет такое имя НП. Отмена.');
            }
            else {
                var chkCity = $(getEditFormControlName('citynamecheck'));
                if (chkCity[0].checked) {
                    chkCity.click();
                }

                city = $(getEditFormControlName('cityname'));

                if (city.val().length === 0 ||
                    (city.val().length !== 0 &&
                     confirm('ACH: Другое имя НП уже присвоено данному сегменту (' + city.val() + '). \nВы уверены, что хотите изменить его?'))) {

                    city.val(cityName).change();
                    cityChanged = true;

                    var street = $(getEditFormControlName('streetname')).val().length;
                    if (!street) {
                        var chkStreet = $(getEditFormControlName('streetnamecheck'));
                        if (!chkStreet[0].checked) {
                            chkStreet.click();
                        }
                    }

                    var state = $(getEditFormControlName('state'));
                    if (state && curRequest.statecode && state.val() && (state.val() != curRequest.statecode))
                    {
                        state.children().each(function() {
                            if (this.value == curRequest.statecode) {
                                state.val(curRequest.statecode).change();
                            }
                        });
                    }
                    var country = $(getEditFormControlName('country'));
                    if (!forcedCountryCode) {
                        forcedCountryCode = curRequest.countrycode;
                    }
                    if (forcedCountryCode && country.val() != forcedCountryCode)
                    {
                        country.val(forcedCountryCode).change();
                    }
                }
            }
            if (doSave === true && cityChanged) {
                $(getEditFormControlName('save')).click();
            }
            else if (cityChanged) {
                city.focus();
                city.select();
            }
            else {
                $(getEditFormControlName('cancel')).click();
            }
        }

        // add listener for tab changes
        var panelObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                for (var i = 0; i < mutation.addedNodes.length; i++) {
                    var addedNode = mutation.addedNodes[i];

                    if (addedNode.nodeType === Node.ELEMENT_NODE && addedNode.querySelector('div.selection')) {
                        drawTab();
                    }
                }
            });
        });
        panelObserver.observe(document.getElementById('edit-panel'), { childList: true, subtree: true });

        W.map.events.register("moveend", null, drawTab);

        // need to call in case if it's permalink
        drawTab();
        drawIndicator();
    }
    setTimeout(ACHelper_bootstrap, 3000);
})();
