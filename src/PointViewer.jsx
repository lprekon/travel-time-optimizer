import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState, useEffect, use } from "react";

const PointViewer = ({
  destinations,
  heatmapPoints,
  zoom: mapStartingZoom,
  midpoint,
  radius,
}) => {
  const [mapBounds, setMapBounds] = useState(null);
  const [travelMax, setTravelMax] = useState(0);
  const [travelMin, setTravelMin] = useState(0);
  const [circleSize, setCircleSize] = useState(1);
  const [inverseRedPercent, setInverseRedPercent] = useState(0.0);

  // when destinations change, update the map bounds state
  // this will trigger the MapUpdater to update the map bounds
  // and fit the map to the new bounds
  useEffect(() => {
    console.log("Calculating map bounds...");
    if (!destinations || destinations.length === 0) {
      setMapBounds([midpoint]);
      return;
    }
    const allPoints = destinations
      .map((dest) => [dest.coordinates.lat, dest.coordinates.lng])
      .concat(
        heatmapPoints.map((point) => [
          point.coordinates.lat,
          point.coordinates.lng,
        ])
      );
    const bounds = L.latLngBounds(allPoints);
    setMapBounds(bounds);
  }, [destinations, heatmapPoints]);

  // log the radius for debugging
  useEffect(() => {
    console.log("working with radius: ", radius);
  }, [radius]);

  // calculate the max and min travel times for the heatmap
  useEffect(() => {
    var localMin = Infinity;
    var localMax = -Infinity;
    heatmapPoints.forEach((point) => {
      if (point.totalTravelTime < localMin) {
        localMin = point.totalTravelTime;
      }
      if (point.totalTravelTime > localMax) {
        localMax = point.totalTravelTime;
      }
    });
    setTravelMin(localMin);
    setTravelMax(localMax);
  }, [heatmapPoints]);

  const createDestIcon = (color) => {
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
  const getColor = (travelTime) => {
    // Red (1) to Yellow (0.5) to Green (0)
    const redPercent = 1 - inverseRedPercent;
    var normVal = Math.min(
      (travelTime - travelMin) / (travelMax - travelMin) / redPercent,
      1
    );

    if (normVal <= 0.5) {
      // Green to Yellow (0-0.5)
      const r = Math.round(255 * (normVal * 2));
      const g = 255;
      const b = 0;
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Yellow to Red (0.5-1)
      const r = 255;
      const g = Math.round(255 * (1 - (normVal - 0.5) * 2));
      const b = 0;
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  return (
    <div style={{ height: "600px", width: "800px" }}>
      <input
        type="range"
        min="1"
        max="10"
        value={circleSize}
        onChange={(e) => setCircleSize(e.target.value)}
        step="0.5"
      />
      <span>Circle Size: {circleSize}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={inverseRedPercent}
        onChange={(e) => setInverseRedPercent(e.target.value)}
      />
      <span>Contrast: {inverseRedPercent}</span>
      <MapContainer
        center={midpoint} // only triggers when the map is created
        zoom={mapStartingZoom}
        style={{ height: "100%", width: "100%" }}
        whenCreated={(map) => {
          mapRef.current = map;
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <Marker position={midpoint} icon={createDestIcon("green")}>
          <Popup>
            <div>
              <h3>Midpoint</h3>
              <p>
                Coordinates: {midpoint.lat}, {midpoint.lng}
              </p>
            </div>
          </Popup>
        </Marker>

        {destinations.map((destination, index) => (
          <Marker
            key={index}
            position={[
              destination.coordinates.lat,
              destination.coordinates.lng,
            ]}
            icon={createDestIcon("blue")}
          >
            <Popup>
              <div>
                <h3>{destination.name}</h3>
                <p>{destination.address}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {heatmapPoints.map((point, index) => (
          <Circle
            key={index}
            center={[point.coordinates.lat, point.coordinates.lng]}
            radius={circleSize * 400}
            pathOptions={{
              color: getColor(point.totalTravelTime),
              fillColor: getColor(point.totalTravelTime),
              opacity: 0.0,
              fillOpacity: 0.7,
            }}
          >
            <Popup>
              <div>
                <h3>Travel Time</h3>
                <p>
                  {Math.round(point.totalTravelTime / 60)} minutes
                  <br />
                  Coordinates: {point.coordinates.lat}, {point.coordinates.lng}
                </p>
              </div>
            </Popup>
          </Circle>
        ))}
        <MapUpdater bounds={mapBounds} defaultCenter={midpoint} />
      </MapContainer>
    </div>
  );
};

const MapUpdater = ({ bounds, defaultCenter }) => {
  const map = useMap();
  const DEFAULT_ZOOM = 12;
  useEffect(() => {
    console.log("Fitting map to bounds:", bounds);
    if (!bounds) {
      console.log("No bounds to fit");
      map.setView(defaultCenter, DEFAULT_ZOOM);
      return;
    }
    map.fitBounds(bounds, { maxZoom: DEFAULT_ZOOM });
  }, [bounds]);
  return null;
};

export default PointViewer;
