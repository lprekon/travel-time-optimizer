import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";

const API_BASE_URL = "https://api.mapbox.com";

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
      if (weight.includes("")) {
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
