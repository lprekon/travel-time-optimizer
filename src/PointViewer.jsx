import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const PointViewer = ({ destinations, heatmapPoints, zoom, center }) => {
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

  return (
    <div style={{ height: "600px", width: "800px" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        whenCreated={(map) => {
          mapRef.current = map;
        }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

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
      </MapContainer>
    </div>
  );
};

export default PointViewer;
