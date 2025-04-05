import React, { useState } from "react";

const DestinationForm = ({ submitDest, geocodeClient }) => {
  const [dName, setDName] = useState("");
  const [address, setAddress] = useState("");
  const [weight, setWeight] = useState("1");
  const [errorMessage, setErrorMessage] = useState("");
  const [validAddress, setValidAddress] = useState(true);

  const geocodeAddress = async (address) => {
    // use SDK
    return geocodeClient
      .forwardGeocode({
        query: address,
        limit: 1,
      })
      .send()
      .then((response) => {
        const statusCode = response.statusCode;
        if (statusCode != 200) {
          console.error("Error geocoding address", response);
        }
        const body = response.body;
        const coordinates = body.features[0].geometry.coordinates;
        console.log("Geocoded coordinates:", coordinates);
        return {
          lat: coordinates[1],
          lng: coordinates[0],
        };
      });
  };

  const handleSubmit = async (e) => {
    setErrorMessage("");
    setValidAddress(true);
    e.preventDefault();
    console.log("Submitting destination:", dName, address, weight);
    if (!address || !weight) {
      setErrorMessage("Address and weight are required");
      return;
    }
    const coordinates = await geocodeAddress(address);
    console.log("Coordinates:", coordinates);
    if (!coordinates) {
      setErrorMessage("Invalid address");
      setValidAddress(false);
      return;
    }
    const newDestination = {
      name: dName,
      address: address,
      coordinates: coordinates,
      weight: weight,
    };
    submitDest(newDestination);
    setDName("");
    setAddress("");
    setWeight("");
  };

  return (
    <div>
      <div className="destination-form">
        <input
          type="text"
          value={dName}
          onChange={(e) => setDName(e.target.value)}
          placeholder="Work, Gym, etc."
        />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address"
          style={{
            border: validAddress ? "" : "1px solid red",
          }}
        />
        <input
          type="text"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Weight"
        />
        <button onClick={handleSubmit}>Add</button>
      </div>
      {errorMessage && <div className="error-message">{errorMessage}</div>}
    </div>
  );
};

export default DestinationForm;
