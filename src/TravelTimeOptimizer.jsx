import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  calculateMidpoint,
  calculateMaxDistance,
  generateSamplePoints,
} from "./SphericalGeometry.js";
import Destination from "./Destination.jsx";
import DestinationForm from "./DestinationForm.jsx";
import PointViewer from "./PointViewer.jsx";

import geocodingFactory from "@mapbox/mapbox-sdk/services/geocoding-v6";

const geocodeClient = geocodingFactory({
  accessToken: import.meta.env.VITE_MAPBOX_TOKEN,
});

const TravelTimeOptimizer = () => {
  const [destinations, setDestinations] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [heatmapData, setHeatmapData] = useState([]); // {coordinates, travelTime}
  const [mapZoom, setMapZoom] = useState(12);
  const [midpoint, setMidpoint] = useState({ lat: 38.8352, lng: -77.38 });
  // const [sampleRadius, setSampleRadius] = useState(5);
  const mapRef = useRef(null);

  const generateHeatMap = async () => {
    console.log("Generating heatmap data...");
    setHeatmapData([]);

    // setIsCalculating(true);

    const midpoint = calculateMidpoint(destinations);
    const radius = calculateMaxDistance(midpoint, destinations);

    // generate sample points around the midpoint
    const samplePoints = generateSamplePoints(
      midpoint,
      radius,
      Math.max(0.5, radius / 10)
    );
    console.log("Sample points: ", samplePoints);
    // setHeatmapData(samplePoints);

    var travelTimePromises = [];
    // fire off all the travel time API requests in parallel, let them process as they come in
    console.log("Firing off travel time requests...");
    for (const point of samplePoints) {
      // for each sample point, get the travel times to all destinations
      const promise = getRawTravelTimes(point);
      const promise2 = promise.then((response) => {
        // if (!response.ok) {
        //   throw new Error("Error fetching travel times");
        // }
        // const data = response.json();
        // const weightedTravelTimes = weightTravelTimes(
        //   data.durations[0].slice(1)
        // ); // skip the first element (the travel time to itself)
        // // return the average
        // return (
        //   weightedTravelTimes.reduce((a, b) => a + b, 0) /
        //   weightedTravelTimes.length
        // );

        // for now, just return a 1
        return 1;
      });
      travelTimePromises.push(promise2);
    }
    console.log("Waiting for travel time requests to finish...");
    // wait for all the weighted times to come back before continuing. It'll be easier to pair each row of results up with the proper sample point out here
    const weightedAverageTravelTimes = await Promise.all(travelTimePromises);
    console.assert(
      weightedAverageTravelTimes.length === samplePoints.length,
      "Mismatch in lengths"
    );
    const results = [];
    for (let i = 0; i < samplePoints.length; i++) {
      results.push({
        coordinates: samplePoints[i],
        travelTime: weightedAverageTravelTimes[i],
      });
    }
    setHeatmapData(results);
    console.log("heatmap data set", heatmapData);
    return;

    // normalize the results
    const timeValues = results.map((result) => result.avgTravelTime);
    const minTime = Math.min(...timeValues);
    const maxTime = Math.max(...timeValues);
    const normalizedResults = results.map((result) => ({
      ...result,
      normalizedTime: (result.avgTravelTime - minTime) / (maxTime - minTime),
    }));
    console.log("Normalized results: ", normalizedResults);
    setIsCalculating(false);
    setHeatmapData(normalizedResults);
  };

  // Get the travel times from the Mapbox API, returning the Promise
  const getRawTravelTimes = (point) => {
    // const API_KEY = import.meta.env.VITE_MAPBOX_TOKEN;
    // if (!API_KEY) {
    //   setError("Mapbox API key is missing");
    //   return null;
    // }
    // if (!point) {
    //   setError("point is required");
    //   return null;
    // }

    // var apiParams = {
    //   sources: "0",
    //   destinations: "",
    //   access_token: import.meta.env.VITE_MAPBOX_TOKEN,
    // };
    // let coordinates = point.lng + "," + point.lat + ";";
    // let pointIndex = 1;
    // destinations.forEach((destination) => {
    //   coordinates +=
    //     destination.coordinates.lng + "," + destination.coordinates.lat + ";";
    //   apiParams.destinations += pointIndex + ";";
    //   pointIndex++;
    // });
    // console.log(apiParams);
    // coordinates = coordinates.slice(0, -1); // remove last semicolon
    // apiParams.destinations = apiParams.destinations.slice(0, -1); // remove last semicolon
    // console.log("API params: ", apiParams);
    // const url =
    //   API_BASE_URL +
    //   "/directions-matrix/v1/driving/" +
    //   coordinates +
    //   "?" +
    //   new URLSearchParams(apiParams);
    // console.log("URL: ", url);
    // return fetch(url); // return the fetch promise
    return Promise.resolve(1);
  };

  const weightTravelTimes = (rawTravelTimes) => {
    const weightedTravelTimes = rawTravelTimes.map((time, index) => {
      const weight = destinations[index].weight;
      return time * weight;
    });
    return weightedTravelTimes;
  };

  const handleAddDestination = (destination) => {
    destination.id = uuidv4();
    const weightVal = parseWeight(destination.weight);
    if (isNaN(weightVal)) {
      destination.validWeight = false;
    } else {
      destination.weight = weightVal;
      destination.validWeight = true;
    }
    const updatedDestinations = [...destinations, destination];
    setDestinations(updatedDestinations);
    const newMidpoint = calculateMidpoint(updatedDestinations);
    setMidpoint(newMidpoint);
  };

  const handleRemoveDestination = (index) => {
    const updatedDestinations = destinations.filter(
      (dest, destIndex) => destIndex !== index
    );
    setDestinations(updatedDestinations);
    const newMidpoint = calculateMidpoint(updatedDestinations);
    setMidpoint(newMidpoint);
  };

  const handleWeightUpdate = (index, value) => {
    const destinationsCopy = [...destinations];
    console.log("Updating weight for index: ", index, value);
    const newWeight = parseWeight(value);
    console.log("Parsed weight: ", newWeight);
    if (isNaN(newWeight)) {
      destinationsCopy[index].validWeight = false;
    } else {
      destinationsCopy[index].weight = newWeight;
      destinationsCopy[index].validWeight = true;
    }
    setDestinations(destinationsCopy);
  };

  const parseWeight = (weightString) => {
    // check if weightSTring is a fraction
    if (weightString.includes("/")) {
      const parts = weightString.split("/");
      return parseFloat(parts[0]) / parseFloat(parts[1]);
    }
    return parseFloat(weightString);
  };

  // Update map when destinations change
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(midpoint, mapZoom);
    }
  }, [midpoint]);

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Travel Time Optimizer</h1>

      <DestinationForm
        submitDest={handleAddDestination}
        geocodeClient={geocodeClient}
      />

      {destinations.map((dest, index) => (
        <Destination
          key={dest.id}
          data={dest}
          changeWeight={(value) => handleWeightUpdate(index, value)}
          remove={() => handleRemoveDestination(index)}
        />
      ))}

      <div className="mt-4">
        <button
          onClick={generateHeatMap}
          disabled={isCalculating || destinations.length < 1}
          className={`px-4 py-2 rounded ${
            isCalculating || destinations.length < 2
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-green-500 text-white hover:bg-green-600"
          }`}
        >
          {isCalculating ? "Calculating..." : "Generate Travel Time Heat Map"}
        </button>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Travel Time Heat Map</h2>

        <PointViewer
          destinations={destinations}
          heatmapPoints={heatmapData}
          midpoint={midpoint}
          zoom={mapZoom}
        />

        {heatmapData.length > 0 && (
          <div className="mt-2 flex items-center justify-center">
            <div className="w-full max-w-md p-2 bg-white rounded shadow-md">
              <div className="text-center font-semibold mb-2">
                Travel Time Legend
              </div>
              <div className="w-full h-6 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded"></div>
              <div className="flex justify-between mt-1 text-sm">
                <span>Shorter Travel Time</span>
                <span>Longer Travel Time</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">How It Works</h2>
        <ol className="list-decimal ml-6 space-y-2">
          <li>
            Add your frequent destinations and assign weights based on visit
            frequency
          </li>
          <li>
            Weights represent relative importance (e.g., daily = 1, weekly =
            1/7)
          </li>
          <li>
            Click "Generate Travel Time Heat Map" to calculate optimal locations
          </li>
          <li>Green areas indicate shorter weighted average travel times</li>
          <li>Red areas indicate longer weighted average travel times</li>
        </ol>
      </div>
    </div>
  );
};

export default TravelTimeOptimizer;
