import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  calculateMidpoint,
  calculateMaxDistance,
  generateSamplePoints,
} from "./SphericalGeometry.js";

const API_BASE_URL = "https://api.mapbox.com";

const EARTH_RADIUS_MILES = 3958.8; // Radius of the Earth in miles

const TravelTimeOptimizer = () => {
  const [destinations, setDestinations] = useState([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [weight, setWeight] = useState("1");
  const [isCalculating, setIsCalculating] = useState(false);
  const [heatmapData, setHeatmapData] = useState([]);
  const [error, setError] = useState("");
  const [mapCenter, setMapCenter] = useState([37.7749, -122.4194]);
  const [mapZoom, setMapZoom] = useState(12);
  const [sampleRadius, setSampleRadius] = useState(5);
  // const mapRef = useRef(null);

  const [pointsFired, setPointsFired] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);

  const geocodeAddress = async (addressString) => {
    console.log("Geocoding address: ", addressString);
    const API_KEY = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!API_KEY) {
      setError("Mapbox API key is missing");
      return null;
    }
    if (!addressString) {
      setError("Address is required");
      return null;
    }
    try {
      const url =
        API_BASE_URL +
        "/search/geocode/v6/forward?q=" +
        encodeURIComponent(addressString) +
        "&access_token=" +
        API_KEY;
      const response = await fetch(url);
      console.log("Response: ", response);
      const data = await response.json();
      console.log("Data: ", data);
      if (data.features && data.features.length > 0) {
        // received valid data
        // get the first (best) result
        const [lng, lat] = data.features[0].geometry.coordinates;
        return { lat, lng };
      } else {
        // no results found
        throw new Error("Address not found");
      }
    } catch (error) {
      console.error("Error geocoding address: ", addressString);
      setError("Error geocoding address: " + error.message);
      return null;
    }
  };

  const addDestination = async (e) => {
    console.log("Adding destination: ", name, address, weight);
    e.preventDefault();
    if (!name || !address || !weight) {
      setError("All fields are required");
      return;
    }
    try {
      var weightValue;
      if (weight.includes("/")) {
        const splitWeight = weight.split("/");
        weightValue = parseFloat(splitWeight[0]) / parseFloat(splitWeight[1]);
      } else {
        weightValue = parseFloat(weight);
      }
      if (isNaN(weightValue) || weightValue <= 0) {
        setError("Weight must be a positive number");
        return;
      }
      const coordinates = await geocodeAddress(address);
      if (!coordinates) {
        return;
      }

      const newDestination = {
        id: uuidv4(),
        name,
        address,
        weight: weightValue,
        coordinates,
      };

      setDestinations([...destinations, newDestination]);

      // Reset form fields
      setName("");
      setAddress("");
      setWeight("1");
      setError("");
    } catch (error) {
      console.error("Error adding destination: ", error);
      setError("Error adding destination: " + error.message);
      return;
    }
  };

  const generateHeatMap = async () => {
    if (destinations.length < 2) {
      setError("At least two destinations are required to generate a heatmap");
      return;
    }
    console.log("Generating heatmap data...");
    setHeatmapData([]);

    setIsCalculating(true);
    setError("");

    const midpoint = calculateMidpoint(destinations);
    const radius = calculateMaxDistance(midpoint, destinations);

    // generate sample points around the midpoint
    const samplePoints = generateSamplePoints(midpoint, radius);

    setTotalPoints(samplePoints.length);
    let pointsFired = 0;
    setPointsFired(0);
    setIsCalculating(false);

    // const travelTimePromises = [];
    // // fire off all the travel time API requests in parallel, let them process as they come in
    // for (const point of samplePoints) {
    //   console.log();
    //   // for each sample point, get the travel times to all destinations
    //   pointsFired++;
    //   setPointsFired(pointsFired);
    //   travelTimePromises.push(
    //     getRawTravelTimes(point).then((response) => {
    //       if (!response.ok) {
    //         throw new Error("Error fetching travel times");
    //       }
    //       const data = response.json();
    //       const weightedTravelTimes = weightTravelTimes(
    //         data.durations[0].slice(1)
    //       ); // skip the first element (the travel time to itself)
    //       // return the average
    //       return (
    //         weightedTravelTimes.reduce((a, b) => a + b, 0) /
    //         weightedTravelTimes.length
    //       );
    //     })
    //   );
    // }
    // // wait for all the weighted times to come back before continuing. It'll be easier to pair each row of results up with the proper sample point out here
    // const weightedAverageTravelTimes = await Promise.all(travelTimePromises);
    // console.assert(
    //   weightedAverageTravelTimes.length === samplePoints.length,
    //   "Mismatch in lengths"
    // );
    // const results = [];
    // for (let i = 0; i < samplePoints.length; i++) {
    //   results.push({
    //     coordinates: samplePoints[i],
    //     avgTravelTime: weightedAverageTravelTimes[i],
    //   });
    // }

    // // normalize the results
    // const timeValues = results.map((result) => result.avgTravelTime);
    // const minTime = Math.min(...timeValues);
    // const maxTime = Math.max(...timeValues);
    // const normalizedResults = results.map((result) => ({
    //   ...result,
    //   normalizedTime: (result.avgTravelTime - minTime) / (maxTime - minTime),
    // }));
    // console.log("Normalized results: ", normalizedResults);
    // setIsCalculating(false);
    // setHeatmapData(normalizedResults);
  };

  // Get the travel times from the Mapbox API, returning the Promise
  const getRawTravelTimes = (point) => {
    if (!API_KEY) {
      setError("Mapbox API key is missing");
      return null;
    }
    if (!point) {
      setError("point is required");
      return null;
    }

    const apiParams = {
      sources: "0",
      destinations: "",
      access_token: import.meta.env.VITE_MAPBOX_TOKEN,
    };
    let coordinates = point.lng + "," + point.lat + ";";
    let pointIndex = 1;
    destinations.forEach((destination) => {
      coordinates +=
        destination.coordinates.lng + "," + destination.coordinates.lat + ";";
      apiParams.destinations += pointIndex + ";";
      pointIndex++;
    });
    apiParams.coordinates = apiParams.coordinates.slice(0, -1); // remove last semicolon
    apiParams.destinations = apiParams.destinations.slice(0, -1); // remove last semicolon
    console.log("API params: ", apiParams);
    const url =
      API_BASE_URL +
      "/directions-matrix/v1/driving" +
      coordinates +
      "?" +
      new URLSearchParams(apiParams);
    console.log("URL: ", url);
    return fetch(url); // return the fetch promise
  };

  const weightTravelTimes = (rawTravelTimes) => {
    const weightedTravelTimes = rawTravelTimes.map((time, index) => {
      const weight = destinations[index].weight;
      return time * weight;
    });
    return weightedTravelTimes;
  };

  const handleAddDestination = async (e) => {
    e.preventDefault();
    console.log("Address test submitted");
    setError("");
    addDestination(e);
  };

  return (
    <div>
      <h1>Add Destination Test</h1>
      <form onSubmit={handleAddDestination}>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter name"
        />
        <input
          type="text"
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter address"
        />
        <input
          type="text"
          id="weight"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Enter weight"
        />
        <button type="submit">Add Destination</button>
      </form>
      <button onClick={generateHeatMap} disabled={isCalculating}>
        Generate Heatmap Data
      </button>
      <p>
        {pointsFired} / {totalPoints}
      </p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <ul>
        {destinations.map((destination) => (
          <li key={destination.id}>
            <h3>{destination.name}</h3>
            <p>{destination.address}</p>
            <p>Weight: {destination.weight}</p>
            <p>
              Coordinates: {destination.coordinates.lat},{" "}
              {destination.coordinates.lng}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TravelTimeOptimizer;
