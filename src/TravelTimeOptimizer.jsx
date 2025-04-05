import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
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
  const [mapCenter, setMapCenter] = useState([38.8352, -77.38]);
  const [mapZoom, setMapZoom] = useState(12);
  const [midpoint, setMidpoint] = useState(null);
  // const [sampleRadius, setSampleRadius] = useState(5);
  const mapRef = useRef(null);

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
      console.log("New destination: ", newDestination);

      setDestinations([...destinations, newDestination]);
      console.log("Destinations: ", destinations);

      // Reset form fields
      setName("");
      setAddress("");
      setWeight("1");
      setError("");
      // setMidpoint(calculateMidpoint(destinations));
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

    // setIsCalculating(true);
    setError("");

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
      console.log("firing off point: ", point);
      // for each sample point, get the travel times to all destinations
      const promise = getRawTravelTimes(point);
      const promise2 = promise.then((response) => {
        if (!response.ok) {
          throw new Error("Error fetching travel times");
        }
        const data = response.json();
        const weightedTravelTimes = weightTravelTimes(
          data.durations[0].slice(1)
        ); // skip the first element (the travel time to itself)
        // return the average
        return (
          weightedTravelTimes.reduce((a, b) => a + b, 0) /
          weightedTravelTimes.length
        );
      });
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
        avgTravelTime: weightedAverageTravelTimes[i],
      });
    }

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
    const API_KEY = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!API_KEY) {
      setError("Mapbox API key is missing");
      return null;
    }
    if (!point) {
      setError("point is required");
      return null;
    }

    var apiParams = {
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
    console.log(apiParams);
    coordinates = coordinates.slice(0, -1); // remove last semicolon
    apiParams.destinations = apiParams.destinations.slice(0, -1); // remove last semicolon
    console.log("API params: ", apiParams);
    const url =
      API_BASE_URL +
      "/directions-matrix/v1/driving/" +
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

  const createIcon = (color) => {
    return L.divIcon({
      className: "custom-marker",
      html: `<div style="
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: ${color};
        border: 2px solid white;
        box-shadow: 0 0 5px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };
  const getColor = (value) => {
    // Red (1) to Yellow (0.5) to Green (0)
    if (value <= 0.5) {
      // Green to Yellow (0-0.5)
      const r = Math.round(255 * (value * 2));
      const g = 255;
      const b = 0;
      return `rgba(${r}, ${g}, ${b}, 0.7)`;
    } else {
      // Yellow to Red (0.5-1)
      const r = 255;
      const g = Math.round(255 * (1 - (value - 0.5) * 2));
      const b = 0;
      return `rgba(${r}, ${g}, ${b}, 0.7)`;
    }
  };

  // Update map when destinations change
  useEffect(() => {
    if (destinations.length > 0) {
      const newCenter = calculateMidpoint(destinations);
      setMapCenter(newCenter);
      setMidpoint(newCenter);

      if (mapRef.current) {
        mapRef.current.setView(newCenter, mapZoom);
      }
    }
  }, [destinations]);

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Travel Time Optimizer</h1>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Add Destinations</h2>
        <form onSubmit={addDestination} className="p-4 bg-gray-100 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Work, Home, etc."
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, City, State"
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block mb-1">Weight (e.g. 1, 1/7, 0.5)</label>
              <input
                type="text"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="1"
                className="w-full p-2 border rounded"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Destination
          </button>
        </form>

        {error && (
          <div className="mt-2 p-2 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Destinations</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Address</th>
                <th className="p-3 text-left">Weight</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {destinations.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-3 text-center text-gray-500">
                    No destinations added yet
                  </td>
                </tr>
              ) : (
                destinations.map((dest) => (
                  <tr key={dest.id} className="border-t">
                    <td className="p-3">{dest.name}</td>
                    <td className="p-3">{dest.address}</td>
                    <td className="p-3">
                      {typeof dest.weight === "number"
                        ? dest.weight.toFixed(4)
                        : dest.weight}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => removeDestination(dest.id)}
                        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <button
            onClick={generateHeatMap}
            disabled={isCalculating || destinations.length < 2}
            className={`px-4 py-2 rounded ${
              isCalculating || destinations.length < 2
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-green-500 text-white hover:bg-green-600"
            }`}
          >
            {isCalculating ? "Calculating..." : "Generate Travel Time Heat Map"}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Travel Time Heat Map</h2>
        <div style={{ height: "600px", width: "100%" }}>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: "100%", width: "100%" }}
            whenCreated={(map) => {
              mapRef.current = map;
            }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {destinations.map((dest, index) => (
              <Marker
                key={dest.id}
                position={dest.coordinates}
                icon={createIcon("#3949AB")}
              >
                <Popup>
                  <div>
                    <h3 className="font-bold">{dest.name}</h3>
                    <p>{dest.address}</p>
                    <p>Weight: {dest.weight.toFixed(4)}</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {midpoint && (
              <Circle
                center={midpoint}
                radius={121}
                pathOptions={{
                  color: "black",
                  fillColor: "black",
                  fillOpacity: 0.9,
                }}
              />
            )}

            {heatmapData.map((point, index) => (
              <Circle
                key={`heat-${index}`}
                center={point.coordinates}
                radius={121}
                pathOptions={{
                  color: "transparent",
                  fillColor: getColor(point.normalizedTime),
                  fillOpacity: 0.7,
                }}
              ></Circle>
            ))}
          </MapContainer>
        </div>

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
