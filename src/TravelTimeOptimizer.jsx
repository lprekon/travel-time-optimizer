import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";

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

  const [geocodeResult, setGeocodeResult] = useState(null);
  const [addressString, setAddressString] = useState("");

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
      setGeocodeResult(null);
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

    setIsCalculating(true);
    setError("");

    const midpoint = calculateMidpoint(destinations);
    const radius = calculateMaxDistance(midpoint, destinations);

    // generate sample points around the midpoint
    const samplePoints = generateSamplePoints(midpoint, radius);

    const results = [];
    for (const point of samplePoints) {
      // for each sample point, get the travel times to all destinations
      const travelTimes = await getWeightedTravelTimes(point);
      if (travelTimes) {
        // calculate the average of the weighted travel times
        const avgTravelTime =
          travelTimes.reduce((acc, time) => acc + time, 0) / travelTimes.length;
        results.push({ point, avgTravelTime });
      }
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

  // generate samplepoints around the midpoint outside the radius, which a spaceing in miles of gridSpacing, defaulting to 0.5 miles
  const generateSamplePoints = (midpoint, radius, gridSpacing = 0.5) => {
    const samplePoints = [];

    const cosCR = Math.cos(radius / EARTH_RADIUS_MILES); // calculate the cosine of the angle subtended by an arc `radius` miles on the surface of the Earth
    for (
      let verticalDisplacementMiles = radius;
      verticalDisplacementMiles >= -radius;
      verticalDisplacementMiles -= gridSpacing
    ) {
      const cosAR = Math.cos(verticalDisplacementMiles / EARTH_RADIUS_MILES); // calculate the cosine of the angle subtended by an arc `verticalDisplacementMiles` miles on the surface of the Earth
      const maxLateralDisplacementMiles =
        Math.acos(cosCR / cosAR) * EARTH_RADIUS_MILES; // calculate the maximum lateral displacement in miles, by solving the spherical pythagorean theorem
      for (
        let lateralDisplacementMiles = -maxLateralDisplacementMiles;
        lateralDisplacementMiles <= maxLateralDisplacementMiles;
        lateralDisplacementMiles += gridSpacing
      ) {
        const lat = vertMilesToLat(verticalDisplacementMiles) + midpoint.lat;
        const lng = latMilesToLng(lateralDisplacementMiles, lat) + midpoint.lng;
        samplePoints.push({ lat, lng }); // should always be within our radius thanks to the fancy spherical pythagorean math above
      }
    }
    return samplePoints;
  };

  const getWeightedTravelTimes = async (point) => {
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
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Error fetching travel times");
      }
      const data = await response.json();
      console.log("Data: ", data);
      if (data.code !== "Ok") {
        throw new Error("Error fetching travel times: " + data.message);
      }
      const rawDurations = data.durations[0].slice(1); // skip the first element (the time to the point itself)
      const weightedDurations = rawDurations.map((duration, index) => {
        destinations[index].weight * duration;
      });

      return weightedDurations;
    } catch (error) {
      console.error("Error fetching travel times: ", error);
      setError("Error fetching travel times: " + error.message);
      return null;
    }
  };

  const vertMilesToLat = (verticalDisplacementMiles) => {
    return verticalDisplacementMiles / 69;
  };

  const latMilesToLng = (lateralDisplacementMiles, lat) => {
    return lateralDisplacementMiles / (69 * Math.cos(lat * (Math.PI / 180)));
  };

  const calculateMidpoint = (destinations) => {
    const latSum = destinations.reduce(
      (sum, dest) => sum + dest.coordinates.lat,
      0
    );
    const lngSum = destinations.reduce(
      (sum, dest) => sum + dest.coordinates.lng,
      0
    );
    const midLat = latSum / destinations.length;
    const midLng = lngSum / destinations.length;
    return { lat: midLat, lng: midLng };
  };

  const calculateMaxDistance = (midpoint, destinations) => {
    let maxDistance = 5; // default to 5 miles
    const distances = destinations.map((dest) => {
      const distance = calculateHaversineDistance(midpoint, dest.coordinates);
      if (distance > maxDistance) {
        maxDistance = distance;
      }
    });
    return maxDistance;
  };

  const calculateHaversineDistance = (point1, point2) => {
    const dLat = point2.lat - point1.lat * (Math.PI / 180); // Convert to radians
    const dLng = point2.lng - point1.lng * (Math.PI / 180); // Convert to radians
    const lat1Rad = point1.lat * (Math.PI / 180); // Convert to radians
    const lat2Rad = point2.lat * (Math.PI / 180); // Convert to radians
    const a =
      1 -
      Math.cos(dLat) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * (1 - Math.cos(dLng));
    const b = Math.sqrt(a / 2);
    const c = 2 * EARTH_RADIUS_MILES * Math.asin(b);
    return c;
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
