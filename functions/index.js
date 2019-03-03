// The "Cloud Functions for Firebase" SDK to create Cloud Functions and setup triggers:
const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database:
const admin = require('firebase-admin');
admin.initializeApp();

// Definition of the Cloud Function reacting to publication on the telemetry topic:
exports.detectTelemetryEvents = functions.pubsub.topic('weather-telemetry-topic').onPublish(
    (message, context) => {
        // The onPublish() trigger function requires a handler function that receives
        // 2 arguments: one related to the message published and
        // one related to the context of the message.

        // Firebase SDK for Cloud Functions has a 'json' helper property to decode
        // the message. We also round numbers to match DHT22 accuracy.
        const temperature = message.json.temperature.toFixed(1);
        const humidity = Math.round(message.json.humidity);
        if((temperature<-40) || (temperature>80) || (humidity <0) || (humidity > 100)) return;
        // A Pub/Sub message has an 'attributes' property. This property has itself some properties,
        // one of them being 'deviceId' to know which device published the message:
        const deviceId = message.attributes.deviceId;
        // The date the message was issued lies in the context object not in the message object:
        const timestamp = context.timestamp
        // Log telemetry activity:
        console.log(`Device=${deviceId}, Temperature=${temperature}°C, Humidity=${humidity}%, Timestamp=${timestamp}`);
        // Push to Firebase Realtime Database telemetry data sorted by device:
        return admin.database().ref(`devices-telemetry/${deviceId}`).push({
            timestamp: timestamp,
            temperature: temperature,
            humidity: humidity
        })
    });
