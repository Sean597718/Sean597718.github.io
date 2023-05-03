//javascript.js
//set map options
var initLatLng = { lat: 25.0475613, lng: 121.5173399 };
var departureLatLng = null;
var arrivalLatLng = null;
var polyline = null;
var clickTimes = 0;
var currentStepIndex = 0; // 目前所在步驟的索引
var mapRotation = 0; // 地圖旋轉角度
var NowLatLng = null; // 目前所在位置
var endPosition = null; // 目的地位置
var positionRecord = []; // 紀錄移動路徑的陣列
var idleTimer = 0; // 計時器
var mapOptions = {
    zoom: 18, //放大的倍率
    center: initLatLng, //初始化的地圖中心位置
    mapTypeControl: false,//地圖樣式控制項
    fullscreenControl: true,//全螢幕控制項
    rotateControl: false,//旋轉控制項
    scaleControl: false,//比例尺控制項
    streetViewControl: false,//街景控制項
    zoomControl: true,//縮放控制項
    tilt: 0,//地圖傾斜角度
    mapId: '930dcea21763fbb0', //地圖樣式
    //mapTypeId:'hybrid'
};
var routeData;
//初始化按鈕狀態
var calcBtn = document.getElementById("calcBtn");
//初始化地圖
const map = new google.maps.Map(document.getElementById('googleMap'), mapOptions);

//自動填入選項篩選項目
var options = {
    componentRestrictions: { country: 'tw' },
    strictBounds: false,
    fields: ["place_id"],
    // types: ["establishment"],
}

var departureInfo = document.getElementById("from");
var departureInfoAP = new google.maps.places.Autocomplete(departureInfo, options);

var arrivalInfo = document.getElementById("to");
var arrivalInfoAP = new google.maps.places.Autocomplete(arrivalInfo, options);

//初始化geocoder
const geocoder = new google.maps.Geocoder();
//初始化direction API
const directionsService = new google.maps.DirectionsService();
//宣告計算角度函數
const computeHeading = google.maps.geometry.spherical.computeHeading;
//宣告計算距離函數
const computeDistance = google.maps.geometry.spherical.computeDistanceBetween;
//宣告判斷點是否在線段上的函數
const isLocationOnEdge = google.maps.geometry.poly.isLocationOnEdge;

//初始化路線顯示
const directionsDisplay = new google.maps.DirectionsRenderer({
    preserveViewport: true,
    draggable: false,
    suppressMarkers: true,
    polylineOptions: {
        strokeColor: "#004B97", // set the color of the route
        strokeWeight: 6, // set the width of the line of the route
    },
});

//校正API計算出來的角度成為地圖用的0~360度
function headingCorrection(heading) {
    if (heading < 0) {
        heading += 360;
    }
    return heading;
}
//規劃路線按鈕監聽
calcBtn.addEventListener("click", function () {
    let origin = document.getElementById("from").value;
    let destination = document.getElementById("to").value;
    calcRoute(origin, destination);
});
//出發地自動填入監聽
departureInfoAP.addListener("place_changed", function () {
    const place = departureInfoAP.getPlace();
    if (!place.place_id) {
        return;
    }
    geocoder
        .geocode({ placeId: place.place_id })
        .then(({ results }) => {
            document.getElementById("from").value = results[0].formatted_address;
            departureLatLng = results[0].geometry.location;
        })
        .catch((e) => window.alert("Geocoder failed due to: " + e));
});

//目的地自動填入監聽
arrivalInfoAP.addListener("place_changed", function () {
    const place = arrivalInfoAP.getPlace();
    if (!place.place_id) {
        return;
    }
    geocoder
        .geocode({ placeId: place.place_id })
        .then(({ results }) => {
            document.getElementById("to").value = results[0].formatted_address;
            arrivalLatLng = results[0].geometry.location;
        })
        .catch((e) => window.alert("Geocoder failed due to: " + e));
});

//取得WatchPosition權限後執行
function recordPosition(position) {
    let cardTextDistance = document.querySelector('#card-distance');
    let cardTextInstruction = document.querySelector("#card-instruction");
    let cardTextFare = document.querySelector("#card-fare");
    let currentStep = routeData.legs[0].steps[currentStepIndex];// 目前所在步驟
    if (currentStepIndex < routeData.legs[0].steps.length - 1) {
        // 如果目前步驟不是最後一步，則取得下一步驟
        var nextStep = routeData.legs[0].steps[currentStepIndex + 1]; // 下一步驟
    }
    NowLatLng = new google.maps.LatLng(
        position.coords.latitude,
        position.coords.longitude
    );
    positionRecord.push(NowLatLng);
    if (positionRecord[positionRecord.length - 1] && positionRecord[positionRecord.length - 1].equals(NowLatLng)) {
        // 如果現在位置與上一個位置相同，則計入待機時間
        idleTimer = idleTimer + 2;
        console.log(idleTimer);
    }
    cardTextFare.innerHTML = "目前車資：" + idleTimer*2 + "元";
    // 計算現在位置與目前步驟終點座標間的角度
    let heading = headingCorrection(computeHeading(NowLatLng, currentStep.end_location));
    // 計算現在位置與目前步驟終點座標間的距離
    let distance = computeDistance(NowLatLng, currentStep.end_location);
    // 判斷現在位置是否在目前步驟線段內
    let currentStepPathpolyline = new google.maps.Polyline({ path: currentStep.path });
    if (isLocationOnEdge(NowLatLng, currentStepPathpolyline, 0.0001)) {
        map.setTilt(65);
        map.setZoom(17);
        map.setHeading(heading);
        map.setCenter(NowLatLng);
        cardTextDistance.innerHTML = currentStep.distance.text+"後";
        cardTextInstruction.innerHTML = currentStep.instructions;
        console.log("在線段內");
        // 如果現在位置離現在步驟結束點<10公尺，且目前步驟線段內且未到達最後步驟，則設定地圖角度為目前步驟終點座標與下一步驟終點座標間的角度
        if (distance < 10 && currentStepIndex + 1 < routeData.legs[0].steps.length) {
            currentStepIndex++;
            heading = headingCorrection(computeHeading(NowLatLng, nextStep.end_location));
            map.setTilt(65);
            map.setZoom(17);
            map.setHeading(heading);
            map.setCenter(NowLatLng);
            cardTextDistance.innerHTML = currentStep.distance.text+"後";
            cardTextInstruction.innerHTML = currentStep.instructions;
            console.log("在線段內且未到達最後步驟");
        }
        // 如果現在位置離現在步驟結束點<10公尺，且目前步驟線段內且已到達最後步驟，則設定地圖角度為目前步驟終點座標與目的地座標間的角度
        else if (distance < 10 && currentStepIndex == routeData.legs[0].steps.length) {
            currentStepIndex++;
            heading = headingCorrection(computeHeading(NowLatLng, currentStep.end_location));
            map.setTilt(65);
            map.setZoom(17);
            map.setHeading(heading);
            map.setCenter(NowLatLng);
            cardTextDistance.innerHTML = currentStep.distance.text+"後";
            cardTextInstruction.innerHTML = currentStep.instructions;
            console.log("在線段內且已到達最後步驟");
        }
    } else {
        // 如果現在位置不在目前步驟線段內，則將起點設為現在位置，終點設為目的地，並重新計算路線
        // 路線設定
        calcRoute(NowLatLng, arrivalLatLng);
        map.setTilt(65);
        map.setZoom(17);
        map.setHeading(heading);
        map.setCenter(NowLatLng);
        // let request = {
        //     origin: NowLatLng,
        //     destination: autocomplete2.getPlace().geometry.location,//目的地
        //     travelMode: google.maps.TravelMode.DRIVING, //路徑類型
        //     unitSystem: google.maps.UnitSystem.MERTRIC //路徑距離單位
        // };
        // // 取得路線資訊並顯示
        // directionsService.route(request, function (result, status) {
        //     if (status == google.maps.DirectionsStatus.OK) {
        //         //讀取路徑資訊
        //         routeData = result.routes[0];
        //         let steps = result.routes[0].legs[0].steps;
        //         let StepDistance = [];
        //         let StepInstruction = [];
        //         steps.forEach((step) => {
        //             const distance = step.distance.text;
        //             const instruction = step.instructions;
        //             StepDistance.push(distance);
        //             StepInstruction.push(instruction);
        //         });
        //         var pathIndicator = document.querySelector('#path-indicator');
        //         pathIndicator.innerHTML = "<div class='alert-success'>" + "<br /> 行駛距離  : " + StepDistance[0] + "<br/>" + StepInstruction[0] + "<br/>" + "</div>";
        //         var overviewPath = result.routes[0].overview_path;

        //         // 建立路線 Polyline 物件
        //         polyline = new google.maps.Polyline({
        //             path: overviewPath,
        //         });
        //         if (clickTimes != 0) {
        //             directionsDisplay.setMap(null);
        //             console.log("clearMap");
        //         }
        //         // 繪製路線
        //         directionsDisplay.setMap(map);
        //         map.setCenter(NowLatLng);
        //         map.setZoom(18);
        //         map.setTilt(45);
        //         map.setHeading(headingCorrection(computeHeading(steps[0].start_location, steps[0].end_location)));
        //         clickTimes++;
        //     } else {
        //         //清空路徑
        //         directionsDisplay.setMap(null);
        //         //預設地圖中心位置為台北車站
        //         map.setTilt(45);
        //         map.setZoom(18);
        //         map.setCenter(initLatLng);

        //         //show error message
        //         pathIndicator.innerHTML = "<div class='alert-danger'><i class='fas fa-exclamation-triangle'></i> Could not retrieve driving distance.</div>";
        //     }
        // });
    }
}

// 获取定位信息失败时输出错误信息到控制台
function showError(error) {
    console.log("Error getting location: " + error.message);
}

// function pathIndicatorOutput() {
//     pathIndicator.innerHTML =
//         "<div class='alert-success'>" +
//         "<br /> 行駛距離 <i class='fa-solid fa-arrow-up'></i> : " +
//         StepDistance + "<br/>" + StepInstruction + "<br/>" +
//         "</div>";
// }

function startJourney() {
    // 每隔2秒获取一次定位信息並比較路徑偏移
    navigator.geolocation.watchPosition(recordPosition, showError, { timeout: 2 * 1000, maximumAge: 0, enableHighAccuracy: true });
    //判斷座標有無移動，有移動紀錄移動距離無移動則記錄靜止時間

}

// 取得現在位置
function getPosition() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            let latLng = new google.maps.LatLng(
                position.coords.latitude,
                position.coords.longitude
            );
            map.setZoom(18);
            map.setTilt(45);
            map.setCenter(latLng);
            var nowposition = new google.maps.Marker({
                position: latLng,
                map: map,
                title: "現在位置",
            });
            // 將經緯度轉換成地址
            geocoder.geocode({ latLng: latLng }, function (results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    // 將地址設定到 origin 欄位中
                    document.getElementById("from").value = results[0].formatted_address;
                }
            });
        });
    }
}

//define calcRoute function
function calcRoute(origin, destination) {
    //create request
    if (origin && destination) {
        var request = {
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.DRIVING, //路徑類型
            unitSystem: google.maps.UnitSystem.MERTRIC //路徑距離單位
        }
    }
    else {
        var request = {
            origin: document.getElementById("from").value,
            destination: document.getElementById("to").value,
            travelMode: google.maps.TravelMode.DRIVING, //路徑類型
            unitSystem: google.maps.UnitSystem.MERTRIC //路徑距離單位
        }
    }
    //pass the request to the route method
    directionsService.route(request, function (result, status) {
        if (status == google.maps.DirectionsStatus.OK) {
            //讀取路徑資訊
            routeData = result.routes[0];
            let steps = result.routes[0].legs[0].steps;
            let StepDistance = [];
            let StepInstruction = [];

            // directionsDisplay.setPanel(document.getElementById("directions-panel"));
            // for (let j = 0; j < steps.length; j++) {
            //     StepDistance[j] = steps[j].distance.text;
            //     StepInstruction[j] = steps[j].instructions;
            // }
            steps.forEach((step) => {
                const distance = step.distance.text;
                const instruction = step.instructions;
                StepDistance.push(distance);
                StepInstruction.push(instruction);
            });
            // var pathIndicator = document.querySelector('#path-indicator');
            // pathIndicator.innerHTML = "<div class='alert-success'>" + "<br /> 行駛距離  : " + StepDistance[0] + "<br/>" + StepInstruction[0] + "<br/>" + "</div>";
            // var Instruction = steps.instructions;
            //顯示路徑資訊(距離、時間)
            //   const output = document.querySelector('#output');
            //   output.innerHTML = "<div class='alert-info'>From: " + document.getElementById("from").value + ".<br />To: " + document.getElementById("to").value + ".<br /> 行駛距離 <i class='fas fa-road'></i> : " + result.routes[0].legs[0].distance.text + ".<br />所需時間 <i class='fas fa-hourglass-start'></i> : " + result.routes[0].legs[0].duration.text + ".</div>";
            //   // 取得路徑座標陣列
            var overviewPath = result.routes[0].overview_path;

            // 建立路線 Polyline 物件
            polyline = new google.maps.Polyline({
                path: overviewPath,
            });
            if (clickTimes != 0) {
                directionsDisplay.setMap(null);
                console.log("clearMap");
            }
            // 繪製路線
            directionsDisplay.setDirections(result);
            directionsDisplay.setMap(map);
            map.setZoom(18);
            map.setTilt(45);
            map.setHeading(computeHeading(steps[0].start_location, steps[0].end_location));
            console.log(result);
            clickTimes++;
            // //使用路徑資訊繪製路徑
            // directionsDisplay.setDirections(result);

            // 取得折線路徑
            // const polyline = result.routes[0].overview_polyline;
            // map.fitBounds(result.routes[0].bounds);
        } else {
            //清空路徑
            directionsDisplay.setDirections({ routes: [] });
            //預設地圖中心位置為台北車站
            map.setTilt(10);
            map.setCenter(initLatLng);

            //show error message
            window.alert("Directions request failed due to " + status);
        }
    });
}
