// A web app that lively plots data from Firebase Realtime Database nodes, thanks to plotly.js

// Firebase initialization is already done as we use "simpler project configuration".
// See https://firebase.google.com/docs/web/setup?authuser=0#host_your_web_app_using_firebase_hosting

// Number of last records to display:
const nbOfElts = 750;

// Declaration of an array of devices ids
let devicesIds = [];
// Declaration of an array of devices aliases 
let devicesAliases = [];
// How these arrays will be generated in the code?
// Devices ids and aliases are read at startup from a specific node of the Firebase
// Realtime Database named 'devices-id'.
// Devices ids are keys of simple key/value objects whose values are either an alias
// of the device or a boolean valuing true.
// For instance, if the database is:
//
// hello-cloud-iot-core
//  |
//  +-devices-ids
//  |  |
//  |  +-esp32_1B2B04: 'outdoor'
//  |  |
//  |  +-esp32_ABB3B4: true
//  |
//  +-devices-telemetry
//     |
//     +-esp32_1B2B04...
//     |
//     +-esp32_ABB3B4...
// 
// We will then have the following features:
// * devicesIDs array will be equal to ['esp32_1B2B04', 'esp32_ABB3B4'].
// * devicesAliases array will be equal to ['outdoor', 'esp32_ABB3B4'].
// * Data from devices whose ids are in deviceIds array will be ploted.
// * In the charts legend, 'esp32_1B2B04' device will be marked as 'outdoor'
//   but 'esp32_ABB3B4' device will still be marked as 'esp32_ABB3B4'
//   as the value for this key is a boolean valuing true.

// To get a list of devices ids, why did we add this specific 'devices-ids' node
// in the database instead of reading the children of 'devices-telemetry' node
// (i.e. 'esp32_1B2B04' and 'esp32_ABB3B4')?
// Because:
// * This reading is a non shallow one, the whole data of 'devices-telemetry' node
//   would have been read! Thus, and it is common in NoSQL database, some parts
//   of data are duplicated ("denormalization").
// * It allows us to choose the devices whose data will be plotted or not.

// Today (Feb. 24, 2019), we still have to create manually the 'devices-ids' node
// in the database. TODO: a UI to select devices whose data should be plotted.

// Get references to the DOM node that welcomes the plots drawn by Plotly.js
const temperaturePlotDiv = document.getElementById('temperaturePlot');
const humidityPlotDiv = document.getElementById('humidityPlot');

// Get a reference to Firebase Realime Database:
const db = firebase.database();

// Declaration of 3 objects named timestamps, temperatures and humidities
let timestamps;
let temperatures;
let humidities;
// Each of these objects will have n property, n being the number of devices ids
// present in the devicesIds array.
// Each property will be named with each device id.
// Each property is an array of 'nbOfElts' elements.
// For instance, if devicesIDs array is equal to ['esp32_1B2B04', 'esp32_ABB3B4']
// and if nbOfElts equals to 150:
// * temperatures.esp32_1B2B04 is an array of the last 150 temperatures measured
//   by 'esp32_1B2B04' device. The related array of timestamps is timestamps.esp32_1B2B04.
// * temperatures.esp32_ABB3B4 is also an array of the last 150 temperatures measured
//   by esp32_ABB3B4. The related array of timestamps is timestamps.esp32_ABB3B4.

// For temperature and humidity, the common plotly.js layout
const commonLayout = {
    titlefont: {
        family: 'Courier New, monospace',
        size: 16,
        color: '#000'
    },
    xaxis: {
        linecolor: 'black',
        linewidth: 2
    },
    yaxis: {
        titlefont: {
            family: 'Courier New, monospace',
            size: 14,
            color: '#000'
        },
        linecolor: 'black',
        linewidth: 2,
    },
    margin: {
        r: 50,
        pad: 0
    }
};
// Specific layout aspects for temperature chart
let temperatureLayout = JSON.parse(JSON.stringify(commonLayout));
temperatureLayout.title = '<b>Temperature live plot</b>';
temperatureLayout.yaxis.title = '<b>Temp (°C)</b>';
// Specific layout aspects for humidity chart
let humidityLayout = JSON.parse(JSON.stringify(commonLayout));
humidityLayout.title = '<b>Humidity live plot</b>';
humidityLayout.yaxis.title = '<b>Humidity (%)</b>';

// Okay, let's start!
// Make ONCE an array of devices ids and devices aliases
db.ref('devices-ids').once('value', (snapshot) => {
    snapshot.forEach(childSnapshot => {
        const childKey = childSnapshot.key;
        devicesIds.push(childKey);
        const childData = childSnapshot.val();
        let deviceAlias;
        if(childData == true) {
            deviceAlias = childKey; // alias is 'esp32_1B2B04' for instance
        } else {
            deviceAlias = childData; // alias is 'outdoor' for instance
        }
        devicesAliases.push(deviceAlias);
    });
    //console.log(devicesAliases);
    if (devicesIds.length != 0) {
        // objects 1st property (an array) initialization...
        timestamps = { [devicesIds[0]]: [] };
        temperatures = { [devicesIds[0]]: [] };
        humidities = { [devicesIds[0]]: [] };
        // ...and the rest of properties (somme arrays) initialization
        for (let i = 1; i < devicesIds.length; i++) {
            timestamps[devicesIds[i]] = [];
            temperatures[devicesIds[i]] = [];
            humidities[devicesIds[i]] = [];
        }
        //console.log('At startup timestamps =', timestamps);
        //console.log('At startup temperatures =', temperatures);
    } else console.log('No device id was found.')
})
.then(() => { // We start building database nodes listeners only when we have devices ids.
    for (let i = 0; i < devicesIds.length; i++) {
        db.ref(`devices-telemetry/${devicesIds[i]}`).limitToLast(nbOfElts).on('value', ts_measures => {
            //console.log(ts_measures.val());
            // We reinitialize the arrays to welcome timestamps, temperatures and humidities values:
            timestamps[devicesIds[i]] = [];
            temperatures[devicesIds[i]] = [];
            humidities[devicesIds[i]] = [];

            ts_measures.forEach(ts_measure => {
                timestamps[devicesIds[i]].push(moment(ts_measure.val().timestamp).format('YYYY-MM-DD HH:mm:ss'));
                temperatures[devicesIds[i]].push(ts_measure.val().temperature);
                humidities[devicesIds[i]].push(ts_measure.val().humidity);
            });

            // plotly.js: See https://plot.ly/javascript/getting-started/
            // Temperatures
            let temperatureTraces = []; // array of plotly temperature traces (n devices => n traces) 
            for (let i = 0; i < devicesIds.length; i++) {
                temperatureTraces[i] = {
                    x: timestamps[devicesIds[i]],
                    y: temperatures[devicesIds[i]],
                    name: devicesAliases[i]
                }
            }
            let temperatureData = []; // last plotly object to build
            for (let i = 0; i < devicesIds.length; i++) {
                temperatureData.push(temperatureTraces[i]);
            }
            Plotly.newPlot(temperaturePlotDiv, temperatureData, temperatureLayout, { responsive: true });

            // Humidities
            let humidityTraces = []; // array of plotly humidity traces (n devices => n traces) 
            for (let i = 0; i < devicesIds.length; i++) {
                humidityTraces[i] = {
                    x: timestamps[devicesIds[i]],
                    y: humidities[devicesIds[i]],
                    name: devicesAliases[i]
                }
            }
            let humidityData = []; // last plotly object to build
            for (let i = 0; i < devicesIds.length; i++) {
                humidityData.push(humidityTraces[i]);
            }
            Plotly.newPlot(humidityPlotDiv, humidityData, humidityLayout, { responsive: true });
        });
    }
})
.catch(err => {
    console.err('An error occured:', err);
});
