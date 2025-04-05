import React, { useState } from "react";

const DestinationForm = ({ submitDest }) => {
  const [dName, setDName] = useState("");
  const [address, setAddress] = useState("");
  const [weight, setWeight] = useState("1");
  const [errorMessage, setErrorMessage] = useState("");

  const geocodeAddress = async (address) => {
    // use SDK

    return {
      lat: 0,
      lng: 0,
    };
  };

  const handleSubmit = async (e) => {
    setErrorMessage("");
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
