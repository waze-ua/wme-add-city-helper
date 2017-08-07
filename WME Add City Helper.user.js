// ==UserScript==
// @name         WME Add City Helper
// @namespace    madnut.ua@gmail.com
// @version      0.4.1
// @description  Helps to add cities using WME Requests spreadsheet
// @author       madnut
// @include      https://www.waze.com/editor/*
// @include      https://www.waze.com/*/editor/*
// @include      https://editor-beta.waze.com/editor/*
// @include      https://editor-beta.waze.com/*/editor/*
// @connect      google.com
// @connect      script.googleusercontent.com
// @connect      localhost
// @grant        GM_xmlhttpRequest
// @updateURL    https://github.com/madnut-ua/wme_addcityhelper/raw/master/WME%20Add%20City%20Helper.user.js
// @downloadURL  https://github.com/madnut-ua/wme_addcityhelper/raw/master/WME%20Add%20City%20Helper.user.js
// @supportURL   https://github.com/madnut-ua/wme_addcityhelper/issues
// ==/UserScript==

(function() {
    'use strict';

    var requestsTimeout = 20000; // in ms
    var minZoomLevel = 4;
    var minAnalyzerVersion = 110; // Ukraine's MinRegion Analyzer
    var config = {
        BO: {
            "country": "Беларусь",
            "code": "37",
            // prod
            "apiUrl": "https://script.google.com/macros/s/AKfycbxw0VxylM8Y8mPEMK5U3aIPcwR2ev91ln7dvQTr2I7t-bFmFm6I/exec"
            // dev
            //"apiUrl": "https://script.google.com/macros/s/AKfycbz8_xLefn_06nLRsfwnupviEEStCXfttg777KryBMnD/dev"
        },
        UP: {
            "country": "Україна",
            "code": "232",
            // prod
            "apiUrl": "https://script.google.com/macros/s/AKfycby2OUnHmGkbTNeJDBcXu4zZ6eyNngh6XHpkcU_tsoVSmHn-NzY/exec"
            // dev
            //"apiUrl": "https://script.google.com/macros/s/AKfycbxgluud2CmzFqpRm4Bp379UdEjuKhelt-0nT1feY_U/dev"
        },
        RS: {
            "country": "Россия",
            "code": "186",
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
        if (typeof Waze === "undefined" ||
            typeof Waze.map === "undefined" ||
            typeof Waze.selectionManager === "undefined" ||
            typeof Waze.model.countries.top.abbr === "undefined" ||
            typeof I18n === "undefined" ||
            typeof I18n.translations === "undefined") {
            setTimeout(ACHelper_bootstrap, 500);
            return;
        }
        ACHelper_init();

        log("started");
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
        var isRequestActive = false;

        var editPanel = $("#edit-panel");
        if (!editPanel) {
            setTimeout(ACHelper_init, 800);
            return;
        }

        var bordersLayer = new OpenLayers.Layer.Vector("City Borders", {
            displayInLayerSwitcher: true,
            uniqueName: "ACHBorders"
        });

        Waze.map.addLayer(bordersLayer);

        function drawCityBorder(cityname, coords)
        {
            bordersLayer.destroyFeatures();
            if (coords) {
                var gm = JSON.parse(coords);

                gm.coords.forEach(function(itemsA, i, arr) {
                    itemsA.forEach(function(itemsB, j, arr) {
                        var polyPoints = new Array(itemsB.length);
                        itemsB.forEach(function(itemsC, k, arr) {

                            polyPoints[k] = new OpenLayers.Geometry.Point(itemsC[0], itemsC[1]).transform(
                                new OpenLayers.Projection("EPSG:4326"), // transform from WGS 1984
                                Waze.map.getProjectionObject() // to Spherical Mercator Projection
                            );
                        });
                        var polygon = new OpenLayers.Geometry.Polygon(new OpenLayers.Geometry.LinearRing(polyPoints));
                        var site_style = new borderStyle('#FFFF00', cityname);

                        var poly = new OpenLayers.Feature.Vector(polygon, null, site_style);
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
                                                   style: 'white-space:nowrap; cursor:pointer; position:relative; border-radius:23px; height:23px; display:inline; float:right; padding-left:10px; padding-right:10px; margin:9px 5px 8px 5px; font-weight:bold; font-size:medium;'});
            var $spinnerElem = $('<i>', { id: 'achSpinner',
                                         style: 'display:none; position:relative; left:-3px;',
                                         class: 'fa fa-spin fa-spinner' });
            var $outputElem = $('<span>', { id: 'achCount',
                                           click: getCityRequest,
                                           style: 'text-decoration:none',
                                           'data-original-title': tooltipText});
            $outputElemContainer.append($spinnerElem);
            $outputElemContainer.append($outputElem);

            $('.toolbar-button.waze-icon-place').parent().prepend($outputElemContainer);
            $outputElem.tooltip({
                placement: 'auto top',
                delay: {show: 100, hide: 100},
                html: true,
                template: '<div class="tooltip" role="tooltip" style="opacity:0.95"><div class="tooltip-arrow"></div><div class="my-tooltip-header"><b></b></div><div class="my-tooltip-body tooltip-inner" style="font-weight:600; !important"></div></div>'
            });

            getRequestsCount();
        }

        function drawTab() {
            var cfg =  config[Waze.model.countries.top.abbr];
            // country is not supported
            if (!cfg) {
                return;
            }

            var panelID = "WME-ACH";
            var sItems = Waze.selectionManager.selectedItems;
            if (!document.getElementById(panelID) && sItems.length > 0 && sItems[0].model.type === 'segment') {
                var cityID, stateID;
                var primaryStreetID = sItems[0].model.attributes.primaryStreetID;
                if (primaryStreetID) {
                    var street = Waze.model.streets.objects[primaryStreetID];
                    if (street.cityID) {
                        var city = Waze.model.cities.objects[street.cityID];
                        cityID = street.cityID;
                        if (city.attributes.stateID) {
                            stateID = city.attributes.stateID;
                        }
                    }
                }
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
                        newtab = document.createElement('li');
                        newtab.innerHTML = '<a href="#' + panelID + '" id="achTab" data-toggle="tab">ACH</a>';
                        navTabs.appendChild(newtab);

                        var html =
                            '<h4>WME Add City Helper <sup>' + GM_info.script.version + '</sup></h4>'+
                            '</br>' +
                            // Level 5 save
                            '<div class="form-group">' +
                            '<button id="achSaveLevel5" class="action-button btn btn-positive btn-success" type="button" title="L5 Save: Сохранить информацию о созданном НП в таблице Level 5">' +
                            '<i class="fa fa-save"></i>&nbsp;Создал НП без запроса' +
                            '</button>' +
                            '</div>' +
                            // block 0
                            '<fieldset id="achInfoPanel" style="border: 1px solid silver; padding: 8px; border-radius: 4px;">' +
                            '<legend style="margin-bottom:0px; border-bottom-style:none;width:auto;"><h5 style="font-weight: bold;">Информация о сегменте</h5></legend>' +
                            '<div class="additional-attributes">' +
                            '<label style="font-weight: bold;">City ID:&nbsp;</label>' +
                            '<span id="achCityID">' + (cityID ? cityID : 'N/A') + '</span></br>' +
                            '<label style="font-weight: bold;">State ID:&nbsp;</label>' +
                            '<span id="achStateID">' + (stateID ? stateID : 'N/A') + '</span>' +
                            '</div>' +
                            // end 0
                            '</fieldset>' +
                            '</br>' +
                            // block 1
                            '<fieldset id="achActiveRequestPanel" style="border: 1px solid silver; padding: 8px; border-radius: 4px;">' +
                            '<legend style="margin-bottom:0px; border-bottom-style:none;width:auto;"><h5 style="font-weight: bold;">Текущий запрос НП (' + cfg.country + ')</h5></legend>' +
                            // author
                            '<div class="form-group">' +
                            '<label class="control-label">Автор</label>' +
                            '<div class="controls">' +
                            '<input class="form-control" autocomplete="off" maxlength="100" id="achAuthor" name="" title="Автор запроса" type="text" value="N/A" readonly="readonly" />' +
                            '</div>' +
                            '</div>' +
                            // city
                            '<div class="form-group">' +
                            '<label class="control-label">Имя нового НП</label>' +
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
                            // status
                            '<div class="form-group">' +
                            '<label class="control-label">Статус</label>' +
                            '<div class="controls">' +
                            '<input class="form-control" autocomplete="off" maxlength="100" id="achStatus" name="" title="Статус запроса" type="text" value="N/A" readonly="readonly" />' +
                            '</div>' +
                            '</div>' +
                            '<div class="form-group">' +
                            '<label class="control-label">Действия</label>' +
                            '<div class="btn-toolbar" style="margin: auto;">' +
                            // lock request
                            '<button id="achLockRequest" class="btn btn-info" type="button" title="Взять запрос в работу (залочить)" style="font-size: 16px">' +
                            '<i class="fa fa-lock"></i>' +
                            '</button>' +
                            // approve
                            '<button id="achApproveRequest" class="btn btn-success" type="button" title="Одобрить запрос" style="font-size: 16px">' +
                            '<i class="fa fa-thumbs-up"></i>' +
                            '</button>' +
                            // decline
                            '<button id="achDeclineRequest" class="btn btn-danger" type="button" title="Отказать" style="font-size: 16px">' +
                            '<i class="fa fa-thumbs-down"></i>' +
                            '</button>' +
                            // send email
                            '<button id="achSendEmail" class="btn btn-default" type="button" title="Отправить письмо" style="font-size: 16px">' +
                            '<i class="fa fa-envelope-o"></i>' +
                            '</button>' +
                            '</div>' +
                            '</div>' +
                            // end 1
                            '</fieldset>';

                        // Ukraine
                        if (cfg.code == "232") {

                            html +=
                                // block 2
                                '</br>' +
                                '<fieldset id="achMinRegionPanel" style="border: 1px solid silver; padding: 8px; border-radius: 4px;">' +
                                '<legend style="margin-bottom:0px; border-bottom-style:none;width:auto;"><h5 style="font-weight: bold;">МинРегион</h5></legend>' +
                                // check name in MinRegion
                                '<div class="form-group">' +
                                '<button id="achCheckInMinRegion" class="action-button btn btn-lightning btn-positive" type="button" title="Проверить имя в МинРегионе">' +
                                '<i class="fa fa-map-o"></i>&nbsp;Проверить' +
                                '</button>' +
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
                                // end 2
                                '</fieldset>';
                        }
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
                    document.getElementById('achJumpToRequest').onclick = function() {
                        if (curRequest.permalink) {
                            jumpToLink(curRequest.permalink);
                        }
                    };
                    document.getElementById('achApplyRequestedCity').onclick = function() {
                        var cityName = document.getElementById('achRequestedCity').value;
                        if (cityName !== '' && cityName !== 'N/A') {
                            changeCity(cityName, false);
                        }
                        return false;
                    };
                    document.getElementById('achLockRequest').onclick = onLockRequest;
                    document.getElementById('achApproveRequest').onclick = onApproveRequest;
                    document.getElementById('achDeclineRequest').onclick = onDeclineRequest;
                    document.getElementById('achSendEmail').onclick = onSendEmail;

                    document.getElementById('achSaveLevel5').onclick = onSaveLevel5;

                    //Ukraine
                    if (cfg.code == "232") {
                        document.getElementById('achCheckInMinRegion').onclick = onCheckMinRegion;
                        document.getElementById('achApplyFoundCity').onclick = function() {
                            var cityName = document.getElementById('achFoundCity').value;
                            if (cityName !== '' && cityName !== 'N/A') {
                                changeCity(cityName, true);
                            }
                            return false;
                        };
                        document.getElementById('achApplySuggestedCity').onclick = function() {
                            var cityName = document.getElementById('achSuggestedName').value;
                            if (cityName !== '' && cityName !== 'N/A') {
                                changeCity(cityName, true);
                            }
                            return false;
                        };
                    }
                }
            }

            if (document.getElementById(panelID) !== null) {
                if (curRequest.requestedcity) {
                    document.getElementById('achAuthor').value = curRequest.author;
                    document.getElementById('achRequestedCity').value = curRequest.requestedcity;
                    //document.getElementById('achPermalink').value = curRequest.permalink;
                    document.getElementById('achJumpToRequest').disabled = false;
                    document.getElementById('achApplyRequestedCity').disabled = false;

                    document.getElementById("achTab").click();
                }
                else {
                    document.getElementById('achAuthor').value = "N/A";
                    document.getElementById('achRequestedCity').value = "N/A";
                    //document.getElementById('achPermalink').value = "N/A";
                    document.getElementById('achJumpToRequest').disabled = true;
                    document.getElementById('achApplyRequestedCity').disabled = true;
                }

                updateRequestStatus();

                //Ukraine
                if (cfg.code == "232") {
                    document.getElementById('achApplyFoundCity').disabled = true;
                    document.getElementById('achApplySuggestedCity').disabled = true;
                }
            }
        }

        function setButtonClass(id, className) {
            var iButton = document.getElementById(id).firstChild;
            if (iButton.className !== className) {
                iButton.className = className;
            }
        }

        function setRequestStatus(statusText) {
            curRequest.status = statusText ? statusText : '';
            updateRequestStatus();
        }

        function updateRequestStatus() {
            var inputStatus = document.getElementById('achStatus');

            if (inputStatus) {
                var btn1 = document.getElementById('achLockRequest');
                var btn2 = document.getElementById('achApproveRequest');
                var btn3 = document.getElementById('achDeclineRequest');
                var btn4 = document.getElementById('achSendEmail');

                inputStatus.value = curRequest.status ? curRequest.status : 'N/A';

                switch (curRequest.status)
                {
                    case 'active':
                        btn1.disabled = false;
                        btn2.disabled = false;
                        btn3.disabled = false;
                        btn4.disabled = true;
                        break;
                    case 'locked':
                        btn1.disabled = true;
                        btn2.disabled = false;
                        btn3.disabled = false;
                        btn4.disabled = true;
                        break;
                    case 'approved':
                    case 'declined':
                        btn1.disabled = true;
                        btn2.disabled = true;
                        btn3.disabled = true;
                        btn4.disabled = false;
                        break;
                    default:
                        btn1.disabled = true;
                        btn2.disabled = true;
                        btn3.disabled = true;
                        btn4.disabled = true;
                        break;
                }
            }
        }

        function onSaveLevel5() {
            var buttonID = 'achSaveLevel5';
            var cfg = config[Waze.model.countries.top.abbr];
            var selectedItem = Waze.selectionManager.selectedItems[0];

            if (cfg && selectedItem) {
                var cityName, segmentDate, cityID, permalink;
                var user = Waze.loginManager.user.userName;

                var attr = selectedItem.model.attributes;
                if (attr) {
                    var street = Waze.model.streets.get(attr.primaryStreetID);
                    cityID = street.cityID;
                    var city = Waze.model.cities.get(cityID);
                    cityName = city.attributes.name;
                    var attrDate = attr.updatedOn ? attr.updatedOn : attr.createdOn;
                    segmentDate = new Date(attrDate).toISOString();

                    // generate permalink
                    var centroid = selectedItem.geometry.getCentroid(true); // without "true" it will return start point as a centroid
                    var lnk = OpenLayers.Layer.SphericalMercator.inverseMercator(centroid.x, centroid.y);
                    permalink = location.origin + location.pathname + "?env=row&lon=" + lnk.lon + "&lat=" + lnk.lat + "&zoom=4&segments=" + attr.id;
                    permalink = encodeURIComponent(permalink);
                }

                if (cityName && segmentDate && cityID && permalink) {
                    GM_xmlhttpRequest({
                        url: cfg.apiUrl + '?func=saveLevel5&p1=' + user + '&p2=' + cityName + '&p3=' + permalink + '&p4=' + segmentDate + '&p5=' + cityID,
                        method: 'GET',
                        timeout: requestsTimeout,
                        onload: function(res) {
                            setButtonClass(buttonID, 'fa fa-save');
                            var msg = "Error processing request. Response: " + res.responseText;
                            if (res.status === 200 && res.responseHeaders.match(/content-type: application\/json/i)) {
                                var text = JSON.parse(res.responseText);
                                if (text.result) {
                                    if (text.result == 'found') {
                                        msg = "НП найден в таблице. Строка " + text.line;
                                    }
                                    else if (text.result == 'add') {
                                        msg = "НП успешно добавлен в таблицу.";
                                    }
                                }
                            }
                            alert(msg);
                        },
                        onreadystatechange: function(res) {
                            setButtonClass(buttonID, 'fa fa-spinner fa-pulse');
                        },
                        ontimeout: function(res) {
                            alert("Sorry, request timeout!");
                            setButtonClass(buttonID, 'fa fa-save');
                        },
                        onerror: function(res) {
                            alert("Sorry, request error!");
                            setButtonClass(buttonID, 'fa fa-save');
                        }
                    });
                }
                else {
                    log("Can't send saveLevel5 request. Some required fields are empty");
                }
            }
        }

        function onLockRequest() {
            var user = Waze.loginManager.user.userName;
            var buttonID = 'achLockRequest';
            var cfg = config[Waze.model.countries.top.abbr];

            if (curRequest.row && cfg) {
                GM_xmlhttpRequest({
                    url: cfg.apiUrl + '?func=processRequest&row=' + curRequest.row + '&user=' + user + '&action=lock',
                    method: 'GET',
                    timeout: requestsTimeout,
                    onload: function(res) {
                        setButtonClass(buttonID, 'fa fa-lock');
                        if (res.status === 200 && res.responseHeaders.match(/content-type: application\/json/i)) {
                            var text = JSON.parse(res.responseText);
                            if (text.result == 'success') {
                                setRequestStatus('locked');
                                document.getElementById('achLockRequest').disabled = true;
                            }
                            else {
                                alert(text.result);
                            }
                        }
                        else {
                            alert("Error processing request. Response: " + res.responseText);
                        }
                    },
                    onreadystatechange: function(res) {
                        setButtonClass(buttonID, 'fa fa-spinner fa-pulse');
                    },
                    ontimeout: function(res) {
                        alert("Sorry, request timeout!");
                        setButtonClass(buttonID, 'fa fa-lock');
                    },
                    onerror: function(res) {
                        alert("Sorry, request error!");
                        setButtonClass(buttonID, 'fa fa-lock');
                    }
                });
            }
        }

        function onCheckMinRegion() {
            var buttonID = 'achCheckInMinRegion';
            var tempUrl = 'http://localhost:8080/GetSuggestedCityName';
            var emptyResponse = {};
            var lnk;

            var selectedItem = Waze.selectionManager.selectedItems[0];
            if (selectedItem) {
                log("MinRegion check by object Centroid");

                var centroid = selectedItem.geometry.getCentroid(true); // without "true" it will return start point as a centroid
                lnk = OpenLayers.Layer.SphericalMercator.inverseMercator(centroid.x, centroid.y);
            }
            else if (curRequest.permalink) {
                log("MinRegion check by request permalink");
                lnk = parseLink(curRequest.permalink);
            }
            else {
                alert("This type of check is not supported yet!");
            }

            if (lnk) {
                GM_xmlhttpRequest({
                    url: tempUrl + '?lon=' + lnk.lon + '&lat=' + lnk.lat,
                    method: 'GET',
                    timeout: requestsTimeout,
                    onload: function(res) {
                        setButtonClass(buttonID, 'fa fa-map-o');
                        if (res.status === 200 && res.responseHeaders.match(/content-type: application\/json/i)) {
                            var text = JSON.parse(res.responseText);
                            if (!text.version || parseInt(text.version) < minAnalyzerVersion) {
                                alert("Ваша версия анализатора для МинРегиона устарела. Пожалуйста, скачайте новую!");
                                updateMinRegionInfo(emptyResponse);
                            }
                            updateMinRegionInfo(text);
                        }
                        else {
                            alert("Error processing request. Response: " + res.responseText);
                            updateMinRegionInfo(emptyResponse);
                        }
                    },
                    onreadystatechange: function(res) {
                        setButtonClass(buttonID, 'fa fa-spinner fa-pulse');
                    },
                    ontimeout: function(res) {
                        alert("Sorry, request timeout!");
                        setButtonClass(buttonID, 'fa fa-map-o');
                        updateMinRegionInfo(emptyResponse);
                    },
                    onerror: function(res) {
                        alert("Sorry, request error!");
                        setButtonClass(buttonID, 'fa fa-map-o');
                        updateMinRegionInfo(emptyResponse);
                    }
                });
            }
        }

        function onApproveRequest() {
            var user = Waze.loginManager.user.userName;
            var buttonID = 'achApproveRequest';
            var cfg = config[Waze.model.countries.top.abbr];

            if (curRequest.row && cfg) {
                var selectedItem = Waze.selectionManager.selectedItems[0].model;
                if (selectedItem.type === "segment") {
                    var err = false;
                    if (!selectedItem.attributes.primaryStreetID) {
                        err = true;
                    }
                    else {
                        var street = Waze.model.streets.objects[selectedItem.attributes.primaryStreetID];
                        debugger;
                        var city = Waze.model.cities.objects[street.cityID];
                        curRequest.addedcity = city.attributes.name;
                        if (!curRequest.addedcity) {
                            err = true;
                        }
                    }

                    if (err) {
                        alert("Ошибка: сегмент без названия. Вы забыли присвоить сегменту НП?");
                        return;
                    }
                }

                curRequest.note = prompt('Обработанный НП: ' + curRequest.addedcity + '\nОдобрить запрос? Добавьте комментарий, если необходимо.', '');

                if (curRequest.note !== null) {
                    GM_xmlhttpRequest({
                        url: cfg.apiUrl + '?func=processRequest&row=' + curRequest.row + '&user=' + user + '&addedcity=' + curRequest.addedcity + '&action=approve&note=' + curRequest.note,
                        method: 'GET',
                        timeout: requestsTimeout,
                        onload: function(res) {
                            setButtonClass(buttonID, 'fa fa-thumbs-up');
                            if (res.status === 200 && res.responseHeaders.match(/content-type: application\/json/i)) {
                                var text = JSON.parse(res.responseText);
                                if (text.result == 'success') {
                                    setRequestStatus('approved');
                                }
                                else {
                                    alert(text.result);
                                }
                            }
                            else {
                                alert("Error processing request. Response: " + res.responseText);
                            }
                        },
                        onreadystatechange: function(res) {
                            setButtonClass(buttonID, 'fa fa-spinner fa-pulse');
                        },
                        ontimeout: function(res) {
                            alert("Sorry, request timeout!");
                            setButtonClass(buttonID, 'fa fa-thumbs-up');
                        },
                        onerror: function(res) {
                            alert("Sorry, request error!");
                            setButtonClass(buttonID, 'fa fa-thumbs-up');
                        }
                    });
                }
            }
        }

        function onDeclineRequest() {
            var user = Waze.loginManager.user.userName;
            var buttonID = 'achDeclineRequest';
            var cfg = config[Waze.model.countries.top.abbr];

            if (curRequest.row && cfg) {
                var selectedItem = Waze.selectionManager.selectedItems[0].model;
                if (selectedItem.type === "segment" && selectedItem.attributes.primaryStreetID) {
                    var street = Waze.model.streets.objects[selectedItem.attributes.primaryStreetID];
                    if (street.cityID) {
                        var city = Waze.model.cities.objects[street.cityID];
                        curRequest.addedcity = city.attributes.name;
                    }
                }

                curRequest.note = prompt('Причина отказа?', 'Такой НП уже существует.');

                if (curRequest.note !== null) {
                    GM_xmlhttpRequest({
                        url: cfg.apiUrl + '?func=processRequest&row=' + curRequest.row + '&user=' + user + '&addedcity=' + curRequest.addedcity + '&action=decline&note=' + curRequest.note,
                        method: 'GET',
                        timeout: requestsTimeout,
                        onload: function(res) {
                            setButtonClass(buttonID, 'fa fa-thumbs-down');
                            if (res.status === 200 && res.responseHeaders.match(/content-type: application\/json/i)) {
                                var text = JSON.parse(res.responseText);
                                if (text.result == 'success') {
                                    setRequestStatus('declined');
                                }
                                else {
                                    alert(text.result);
                                }
                            }
                            else {
                                alert("Error processing request. Response: " + res.responseText);
                            }
                        },
                        onreadystatechange: function(res) {
                            setButtonClass(buttonID, 'fa fa-spinner fa-pulse');
                        },
                        ontimeout: function(res) {
                            alert("Sorry, request timeout!");
                            setButtonClass(buttonID, 'fa fa-thumbs-down');
                        },
                        onerror: function(res) {
                            alert("Sorry, request error!");
                            setButtonClass(buttonID, 'fa fa-thumbs-down');
                        }
                    });
                }
            }
        }

        function onSendEmail() {
            var buttonID = 'achSendEmail';
            var cfg = config[Waze.model.countries.top.abbr];

            if (curRequest.row && cfg) {
                GM_xmlhttpRequest({
                    url: cfg.apiUrl + '?func=sendEmail&row=' + curRequest.row,
                    method: 'GET',
                    timeout: requestsTimeout,
                    onload: function(res) {
                        setButtonClass(buttonID, 'fa fa-envelope-o');
                        if (res.status === 200 && res.responseHeaders.match(/content-type: application\/json/i)) {
                            var text = JSON.parse(res.responseText);
                            if (text.result == 'success') {
                                setRequestStatus(curRequest.status + ", emailed");
                                alert("Письмо успешно отправлено!");
                                // update counter
                                getRequestsCount();
                            }
                            else {
                                alert(text.result);
                            }
                        }
                        else {
                            alert("Error processing request. Response: " + res.responseText);
                        }
                    },
                    onreadystatechange: function(res) {
                        setButtonClass(buttonID, 'fa fa-spinner fa-pulse');
                    },
                    ontimeout: function(res) {
                        alert("Sorry, request timeout!");
                        setButtonClass(buttonID, 'fa fa-envelope-o');
                    },
                    onerror: function(res) {
                        alert("Sorry, request error!");
                        setButtonClass(buttonID, 'fa fa-envelope-o');
                    }
                });
            }
        }

        function updateMinRegionInfo(rs) {
            var disableButtons = true;

            if (rs.foundcity) {
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

            document.getElementById('achMRResponseStatus').style.color = (rs.status == 'OK' ? 'green' : (rs.status.match(/error/i) ? 'red' : 'darkorange'));
            document.getElementById('achMRResponseStatus').innerHTML = rs.status.replace(',', '</br>');
            document.getElementById('achMRResponseComments').innerHTML = rs.comments.replace(',', '</br>');


            document.getElementById('achApplyFoundCity').disabled = disableButtons;
            document.getElementById('achApplySuggestedCity').disabled = disableButtons;
        }

        function processGetResult(rq) {
            if (rq && rq.city) {
                curRequest.author = rq.requestor;
                curRequest.requestedcity = rq.city;
                curRequest.permalink = rq.permalink;
                curRequest.row = rq.row;
                curRequest.countrycode = rq.countrycode;
                curRequest.statecode = rq.statecode;

                jumpToLink(rq.permalink);
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
                Waze.model.events.unregister("mergestart", null, mergestart);
                Waze.model.events.register("mergeend", null, mergeend);
            }
            function mergeend() {
                Waze.model.events.unregister("mergeend", null, mergeend);

                if (lnk.segments) {
                    // if we have multiple selection
                    var segArray = lnk.segments.split(",");
                    var objects = [];
                    for (var i = 0; i < segArray.length; i++) {
                        var sObj = Waze.model.segments.objects[segArray[i]];
                        if (sObj) {
                            objects.push(sObj);
                        }
                    }
                    if (objects.length > 0) {
                        Waze.selectionManager.select(objects);
                    }
                }
            }

            if (!(lnk.lon && lnk.lat && lnk.segments)) {
                alert("error parsing permalink: " + permalink);
                return;
            }

            Waze.model.events.register("mergestart", null, mergestart);

            Waze.selectionManager.unselectAll();
            var xy = OpenLayers.Layer.SphericalMercator.forwardMercator(parseFloat(lnk.lon), parseFloat(lnk.lat));
            Waze.map.setCenter(xy, (lnk.zoom && lnk.zoom > 3 ? parseInt(lnk.zoom) : minZoomLevel));
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

        function updateInProgressIndicator() {
            if (isRequestActive) {
                document.getElementById('achSpinner').style.display = "inline-block";
            }
            else {
                document.getElementById('achSpinner').style.display = "none";
            }
        }

        function getCityRequest() {
            var cfg = config[Waze.model.countries.top.abbr];
            if (cfg) {
                var user = Waze.loginManager.user.userName;
                isRequestActive = true;
                GM_xmlhttpRequest({
                    url: cfg.apiUrl + '?func=getCityRequest&user=' + user,
                    method: 'GET',
                    timeout: requestsTimeout,
                    onload: function(res) {
                        var count = "error";
                        isRequestActive = false;
                        updateInProgressIndicator();
                        if (res.status === 200 && res.responseHeaders.match(/content-type: application\/json/i)) {
                            var text = JSON.parse(res.responseText);
                            count = text.count;
                            if (text.result == 'success') {
                                setRequestStatus(text.status);
                                processGetResult(text);
                            }
                            else if (text.result == 'nothing to process') {
                                alert("Нет доступных запросов для обработки.");
                                // set request to empty
                                processGetResult();
                            }
                            else {
                                alert(text.result);
                                // set request to empty
                                processGetResult();
                            }
                        }
                        else {
                            alert("Error loading city. Response: " + res.responseText);
                        }
                        updateRequestsCount(count);
                    },
                    onreadystatechange: function(res) {
                        updateInProgressIndicator();
                    },
                    ontimeout: function(res) {
                        alert("Sorry, request timeout!");
                        isRequestActive = false;
                        updateInProgressIndicator();
                    },
                    onerror: function(res) {
                        alert("Sorry, request error!");
                        isRequestActive = false;
                        updateInProgressIndicator();
                    }
                });
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
        }

        function getRequestsCount() {
            var cfg = config[Waze.model.countries.top.abbr];
            if (cfg) {
                GM_xmlhttpRequest({
                    url: cfg.apiUrl + '?func=getRequestsCount',
                    method: 'GET',
                    timeout: requestsTimeout,
                    onload: function(res) {
                        var count = "error";
                        if (res.status === 200 && res.responseHeaders.match(/content-type: application\/json/i)) {
                            var text = JSON.parse(res.responseText);
                            count = text.count;
                        }
                        else if (res.responseHeaders.match(/content-type: text\/html/i)) {
                            displayHtmlPage(res);
                        }
                        else {
                            alert("Error loading requests count. Response: " + res.responseText + res.responseHeaders);
                        }
                        updateRequestsCount(count);
                    },
                    ontimeout: function(res) {
                        alert("Sorry, request timeout!");
                    },
                    onerror: function(res) {
                        alert("Sorry, request error!");
                    }
                });
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
            if (res.responseText.match(/ServiceLogin/)) {
                w.location = res.finalUrl;
            }
        }

        function getElementsByClassName(classname, node) {
            if (!node)
                node = document.getElementsByTagName("body")[0];
            var a = [];
            var re = new RegExp('\\b' + classname + '\\b');
            var els = node.getElementsByTagName("*");
            for (var i = 0, j = els.length; i < j; i++)
                if (re.test(els[i].className)) a.push(els[i]);
            return a;
        }

        // thanks, guys, for the functions :)
        function changeCity(cityName, doSave) {
            function getEditFormControlName(id) {
                var beta = (location.hostname == "editor-beta.waze.com" ? true : false);

                var controlsMap = {
                    form: beta ? 'div[class="address-edit-btn"]' : 'div[class="address-edit-btn"]',
                    country: beta ? 'select[name="countryID"]' : 'select[name="countryID"]',
                    state: beta ? 'select[name="stateID"]' : 'select[name="stateID"]',
                    cityname: beta ? 'input[name="cityName"]' : 'input[name="cityName"]',
                    citynamecheck: beta ? '#emptyCity' : '#emptyCity',
                    streetname: beta ? 'input[name="streetName"]' : 'input[name="streetName"]',
                    streetnamecheck: beta ? '#emptyStreet' : '#emptyStreet',
                    save: beta ? 'class="btn btn-primary save-button"' : 'class="btn btn-primary save-button"',
                    cancel: beta ? 'class="address-edit-cancel btn btn-default cancel-button"' : 'class="address-edit-cancel btn btn-default cancel-button"',
                    name: 'name'
                };

                return controlsMap[id];
            }
            $(getEditFormControlName('form')).click();

            setTimeout(function() {

                var cityChanged = false;
                var city = $(getEditFormControlName('cityname'));
                if (city.val() == cityName) {
                    alert('НП уже имеет такое имя. Отмена.');
                }
                else {
                    var chkCity = $(getEditFormControlName('citynamecheck'));
                    if (chkCity[0].checked) {
                        chkCity.click();
                    }

                    city = $(getEditFormControlName('cityname'));

                    if (city.val().length === 0 ||
                        (city.val().length !== 0 &&
                         confirm('Другое имя НП уже присвоено данному сегменту. \nВы уверены, что хотите изменить его?'))) {

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
                            state.val(curRequest.statecode).change();
                        }
                        var country = $(getEditFormControlName('country'));
                        if (curRequest.countrycode && country.val() != curRequest.countrycode)
                        {
                            country.val(curRequest.countrycode).change();
                        }
                    }
                }
                if (doSave === true && cityChanged) {
                    $('button[' + getEditFormControlName('save') + ']').click();
                }
                else if (cityChanged) {
                    city.focus();
                    city.select();
                }
                else {
                    $('button[' + getEditFormControlName('cancel') + ']').click();
                }
            }, 60);
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

        // need to call in case if it's permalink
        drawTab();
        drawIndicator();
    }
    setTimeout(ACHelper_bootstrap, 3000);
})();