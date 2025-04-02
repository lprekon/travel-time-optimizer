import { useState } from "react";

const API_BASE_URL = "api.mapbox.com";

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
  const mapRef = useRef(null);

  const geocodeAddress = async (addressString) => {
    try {
      const url =
        API_BASE_URL +
        "/search/geocode/v6/forward?q=" +
        encodeURIComponent(addressString) +
        "&access_token=" +
        process.env.MAPBOX_ACCESS_TOKEN;
      const response = await fetch(url);
      const data = await response.json();
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

  return "This is the TravelTimeOptimizer component";
};

export default TravelTimeOptimizer;
