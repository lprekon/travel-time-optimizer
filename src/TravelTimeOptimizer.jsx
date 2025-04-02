import React, { useState } from "react";

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

  const handleGeocodeTest = async (e) => {
    e.preventDefault();
    console.log("Geocode test submitted");
    setError("");
    const result = await geocodeAddress(address);
    if (result) {
      setGeocodeResult(result);
    } else {
      setGeocodeResult(null);
    }
  };

  return (
    <div>
    <h1>Geocoding Test</h1>
    <form onSubmit={handleGeocodeTest}>
      <input type="text" id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter address" />
      <button type="submit">Geocode</button>
    </form>
    {error && <p style={{ color: "red" }}>{error}</p>}
    {geocodeResult && (
      <div>
        <h2>Geocoding Result</h2>
        <p>Latitude: {geocodeResult.lat}</p>
        <p>Longitude: {geocodeResult.lng}</p>
      </div>
    )}
    </div>
  );
};

export default TravelTimeOptimizer;
