//ors-test.js
const axios = require ("axios")

const API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjllMzhmNmVjZDgwODQwM2U5YWM0NmNkNGNkZjgwOWJiIiwiaCI6Im11cm11cjY0In0=";

//example coordinates: [longitude, latitude]
const start = [101.6869, 3.1390]; //kl
const end = [101.7072, 3.0533]; //mid valley megamall

async function getRoute(){
    try{
        const response = await axios.post(
            "https://api.openrouteservice.org/v2/directions/driving-car",
            {
                coordinates: [start, end],
            },
            {
                headers: {
                    Authorization: API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        const data = response.data;
        const route = data.routes[0].summary;

        console.log("Distance (km):", (route.distance / 1000).toFixed(2));
        console.log("Duration (min):", (route.duration/60).toFixed(2));
    } catch (error){
        console.error("Error fetching route:", error.response?.data || error.message);

    }
}

getRoute();