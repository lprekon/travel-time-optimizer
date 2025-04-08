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
import directionsFactory from "@mapbox/mapbox-sdk/services/directions";

const geocodeClient = geocodingFactory({
  accessToken: import.meta.env.VITE_MAPBOX_TOKEN,
});
const matrixClient = matrixFactory({
  accessToken: import.meta.env.VITE_MAPBOX_TOKEN,
});
const directionsClient = directionsFactory({
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

    console.log("Firing off travel time requests...");
    var travelTimePromises = samplePoints.map((point) => {
      return getTimesForPoint(point);
    });
    // fire off all the travel time API requests in parallel, let them process as they come in
    console.log("Waiting for travel time requests to finish...");
    // wait for all the weighted times to come back before continuing. We want both the raw times and the weighted times, and that's easier to manage out here
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

  // return a promise that resolves to the raw travel times from this point to/from all passed destinations, in the same order as the destinations array
  const getTimesForPoint = (point) => {
    var timePromises = destinations.map((dest) => {
      return pointToDestTime(point, dest);
    });
    return Promise.all(timePromises);
  };

  // return a promise that resolves to the round-trip travel time from the point to the destination, at the specified departure times if specified
  const pointToDestTime = (point, dest) => {
    const baseConfig = {
      // the API and SDK docs do not agree on how this should be formatted. This is the SDK way
      waypoints: [
        { coordinates: [point.lng, point.lat], radius: "unlimited" },
        {
          coordinates: [dest.coordinates.lng, dest.coordinates.lat],
          radius: "unlimited",
        },
      ], // we'll always calculate from point to dest
      overview: "false",
    };
    if (!dest.time) {
      // no specified time, just get the one-way travel time with no time restrictions and double it
      const requestConfig = { ...baseConfig, profile: "driving" };
      return directionsClient
        .getDirections(requestConfig)
        .send()
        .then((response) => {
          if (response.statusCode != 200) {
            console.error("Error fetching travel time", response);
            return 0;
          }
          const data = response.body;
          const routes = data.routes;
          if (routes.length === 0) {
            console.error("No routes found");
            return 0;
          }
          const travelTime = routes[0].duration;
          return travelTime * 2; // round trip
        });
    } else {
      // specified time, so make two requests, one each way, and add them together
      console.log("destination time: ", dest.time);
      const dow = dest.time.weekday ? 1 : 6;
      console.log("Using weekday: ", dow);
      var dayOfTravel = new Date();
      dayOfTravel.setDate(
        dayOfTravel.getDate() + ((dow + (7 - dayOfTravel.getDay())) % 7)
      );
      console.log("Day of travel: ", dayOfTravel.toISOString());
      const departForCongig = {
        ...baseConfig,
        profile: "driving-traffic",
        departAt:
          dayOfTravel.toISOString().split("T")[0] + "T" + dest.time.departFor,
      };
      // reorder the coordinates to be from the destination to the point
      const departFromConfig = {
        ...baseConfig,
        profile: "driving-traffic",
        departAt:
          dayOfTravel.toISOString().split("T")[0] + "T" + dest.time.departFrom,
        waypoints: [baseConfig.waypoints[1], baseConfig.waypoints[0]], // swap the order
      };
      console.log(
        "Sending timebound requests",
        departForCongig,
        departFromConfig
      );
      const departForRequest = directionsClient
        .getDirections(departForCongig)
        .send();
      const departFromRequest = directionsClient
        .getDirections(departFromConfig)
        .send();
      return Promise.all([departForRequest, departFromRequest]).then(
        (responses) => {
          const departForResponse = responses[0];
          const departFromResponse = responses[1];
          if (
            departForResponse.statusCode != 200 ||
            departFromResponse.statusCode != 200
          ) {
            console.error(
              "Error fetching travel time",
              departForResponse,
              departFromResponse
            );
            return 0;
          }
          const data1 = departForResponse.body;
          const data2 = departFromResponse.body;
          const routes1 = data1.routes;
          const routes2 = data2.routes;
          if (routes1.length === 0 || routes2.length === 0) {
            console.error("No routes found");
            return 0;
          }
          const travelTime = routes1[0].duration + routes2[0].duration; // round trip
          return travelTime;
        }
      );
    }
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

  const handleWeekdayChange = (index, value) => {
    const destinationsCopy = [...destinations];
    destinationsCopy[index].time.weekday = value;
    setDestinations(destinationsCopy);
    console.log("Weekday changed for index: ", index, value);
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
          changeWeekday={(value) => handleWeekdayChange(index, value)}
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
