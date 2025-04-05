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
import { useState, useEffect } from "react";

const PointViewer = ({
  destinations,
  heatmapPoints,
  zoom: mapStartingZoom,
  center: mapStartingCenter,
}) => {
  const [mapBounds, setMapBounds] = useState(null);

  // when destinations change, update the map bounds state
  // this will trigger the MapUpdater to update the map bounds
  // and fit the map to the new bounds
  useEffect(() => {
    if (!destinations || destinations.length === 0) {
      setMapBounds(null);
      return;
    }
    const bounds = L.latLngBounds(
      destinations.map((dest) => [dest.coordinates.lat, dest.coordinates.lng])
    );
    setMapBounds(bounds);
  }, [destinations]);

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

  const createHeatIcon = (normalizeValue) => {
    const heatmapColor = getColor(normalizeValue);
    return L.divIcon({
      className: "custom-marker",
      html: `<div style="
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background-color: ${heatmapColor};
              border: 2px solid white;
              box-shadow: 0 0 5px rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              opacity: 0.7;
            "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  return (
    <div style={{ height: "600px", width: "800px" }}>
      <MapContainer
        center={mapStartingCenter}
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

        <Marker position={mapStartingCenter} icon={createDestIcon("green")}>
          <Popup>
            <div>
              <h3>Midpoint</h3>
              <p>
                Coordinates: {mapStartingCenter.lat}, {mapStartingCenter.lng}
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
          <Marker
            key={index}
            position={[point.lat, point.lng]}
            icon={createHeatIcon(point.value)}
          >
            <Popup>
              <div>
                <h3>Normalized Travel Time: {point.value}</h3>
              </div>
            </Popup>
          </Marker>
        ))}
        <MapUpdater bounds={mapBounds} />
      </MapContainer>
    </div>
  );
};

const MapUpdater = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    console.log("Fitting map to bounds:", bounds);
    if (!bounds) {
      console.log("No bounds to fit");
      return;
    }
    map.fitBounds(bounds, { maxZoom: 15 });
  }, [bounds]);
  return null;
};

export default PointViewer;
