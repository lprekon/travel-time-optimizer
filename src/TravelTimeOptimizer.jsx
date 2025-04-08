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
import matrixFactory from "@mapbox/mapbox-sdk/services/matrix";

const geocodeClient = geocodingFactory({
  accessToken: import.meta.env.VITE_MAPBOX_TOKEN,
});
const matrixClient = matrixFactory({
  accessToken: import.meta.env.VITE_MAPBOX_TOKEN,
});

const MIN_RADIUS = 5;

const TravelTimeOptimizer = () => {
  const [destinations, setDestinations] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [heatmapData, setHeatmapData] = useState([]); // {coordinates, travelTime}
  const [mapZoom, setMapZoom] = useState(12);
  const [midpoint, setMidpoint] = useState({ lat: 38.8352, lng: -77.38 });
  // const [sampleRadius, setSampleRadius] = useState(5);
  const mapRef = useRef(null);

  const [radiusFactor, setRadiusFactor] = useState(1.0);
  const [radius, setRadius] = useState(MIN_RADIUS);

  const generateHeatMap = async () => {
    console.log("Generating heatmap data...");
    setHeatmapData([]);

    // setIsCalculating(true);

    const midpoint = calculateMidpoint(destinations);
    var radius_local = calculateMaxDistance(midpoint, destinations);
    radius_local = Math.max(radius_local, MIN_RADIUS);
    radius_local *= radiusFactor; // multiply by the radius factor
    setRadius(radius_local);
    console.log("radius: ", radius_local);

    // generate sample points around the midpoint
    const samplePoints = generateSamplePoints(
      midpoint,
      radius_local,
      Math.max(0.5, radius_local / 10)
    );
    console.log("Sample points: ", samplePoints);
    // setHeatmapData(samplePoints);

    var travelTimePromises = [];
    // fire off all the travel time API requests in parallel, let them process as they come in
    console.log("Firing off travel time requests...");
    for (const point of samplePoints) {
      // for each sample point, get the travel times to all destinations
      travelTimePromises.push(
        getRawTravelTimes(point).then((rawTravelTimes) => {
          console.log("Raw travel times: ", rawTravelTimes);
          return rawTravelTimes;
        })
      );
    }
    console.log("Waiting for travel time requests to finish...");
    // wait for all the weighted times to come back before continuing. It'll be easier to pair each row of results up with the proper sample point out here
    const rawTravelTimes = await Promise.all(travelTimePromises);
    console.assert(
      rawTravelTimes.length === samplePoints.length,
      "Mismatch in lengths"
    );
    const results = [];
    for (let i = 0; i < samplePoints.length; i++) {
      const weightedTravelTimes = rawTravelTimes[i].map((time, index) => {
        return time * destinations[index].weight;
      });
      const totalTravelTime = weightedTravelTimes.reduce(
        (acc, time) => acc + time,
        0
      );
      results.push({
        coordinates: samplePoints[i],
        rawTravelTimes: rawTravelTimes[i],
        totalTravelTime: totalTravelTime,
      });
    }
    setHeatmapData(results);
    console.log("heatmap data set", results);
  };

  // Return a promise that resolves to the raw travel times from this point to all destinations
  const getRawTravelTimes = (point) => {
    // create a matrix request for the point and all destinations
    const matrixRequestConfig = {
      profile: "driving",
      points: [{ coordinates: [point.lng, point.lat] }],
      sources: [0],
      destinations: [],
    };
    // add all the destinations to the request
    destinations.forEach((dest, index) => {
      matrixRequestConfig.points.push({
        coordinates: [dest.coordinates.lng, dest.coordinates.lat],
      });
      matrixRequestConfig.destinations.push(index + 1);
    });

    // console.log("Matrix request config: ", matrixRequestConfig);
    // Create the promise, .then() it to parse the response, then return the promise which will resolve to the parsed response
    const matrixRequest = matrixClient.getMatrix(matrixRequestConfig);
    return matrixRequest.send().then((response) => {
      const statusCode = response.statusCode;
      if (statusCode != 200) {
        console.error("Error fetching travel times", response);
        return [];
      }
      const body = response.body;
      // console.log("Travel times: ", body);
      return body.durations[0];
    });
  };

  const handleAddDestination = (destination) => {
    setHeatmapData([]); // clear the heatmap data when a new destination is added
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
    setHeatmapData([]); // clear the heatmap data when a destination is removed
    const updatedDestinations = destinations.filter(
      (dest, destIndex) => destIndex !== index
    );
    setDestinations(updatedDestinations);
    if (updatedDestinations.length > 0) {
      const newMidpoint = calculateMidpoint(updatedDestinations);
      setMidpoint(newMidpoint);
    }
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

      // reweight the heatmap data
      console.log("Reweighting heatmap data...");
      for (let i = 0; i < heatmapData.length; i++) {
        const rawTravelTimes = heatmapData[i].rawTravelTimes;
        const weightedTravelTimes = rawTravelTimes.map((time, index) => {
          return time * destinationsCopy[index].weight;
        });
        const totalTravelTime = weightedTravelTimes.reduce(
          (acc, time) => acc + time,
          0
        );
        heatmapData[i].totalTravelTime = totalTravelTime;
      }
    }

    setDestinations(destinationsCopy);
  };

  const handleTimeChange = (index, timeType, value) => {
    const destinationsCopy = [...destinations];
    destinationsCopy[index].time[timeType] = value;
    setDestinations(destinationsCopy);
    console.log("Time changed for index: ", index, timeType, value);
  };

  const handleRadiusFactorChange = (value) => {
    setRadiusFactor(value);
    setHeatmapData([]); // clear the heatmap data when the radius factor changes
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
      <hr />
      {destinations.map((dest, index) => (
        <Destination
          key={dest.id}
          data={dest}
          changeWeight={(value) => handleWeightUpdate(index, value)}
          changeTime={(timeType, value) =>
            handleTimeChange(index, timeType, value)
          }
          remove={() => handleRemoveDestination(index)}
        />
      ))}

      <div className="mt-4">
        <div>
          <input
            type="range"
            min="1"
            max="2"
            step="0.1"
            value={radiusFactor}
            onChange={(e) => handleRadiusFactorChange(e.target.value)}
          />
          <span>Radius multiplication factor: {radiusFactor}</span>
        </div>

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
