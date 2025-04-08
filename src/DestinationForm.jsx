import React, { useState } from "react";

const DestinationForm = ({ submitDest, geocodeClient }) => {
  const [dName, setDName] = useState("");
  const [address, setAddress] = useState("");
  const [weight, setWeight] = useState("1");
  const [errorMessage, setErrorMessage] = useState("");
  const [validAddress, setValidAddress] = useState(true);
  const [timeSpecific, setTimeSpecific] = useState(true);
  const [departFor, setDepartFor] = useState("");
  const [departFrom, setDepartFrom] = useState("");
  const [weekday, setWeekday] = useState(false);

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
    var time = null;
    if (timeSpecific) {
      time = {
        departFor: departFor,
        departFrom: departFrom,
        weekday: weekday,
      };
    }
    const newDestination = {
      name: dName,
      address: address,
      coordinates: coordinates,
      weight: weight,
      time: time,
    };
    submitDest(newDestination);
    setDName("");
    setAddress("");
    setWeight("1");
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

        <label>
          Time Specific{" "}
          <input
            type="checkbox"
            checked={timeSpecific}
            onChange={(e) => setTimeSpecific(e.target.checked)}
          />
        </label>
        {timeSpecific && (
          <div>
            <label>
              Leave For
              <input
                type="time"
                value={departFor}
                onChange={(e) => setDepartFor(e.target.value)}
              />
            </label>
            <label>
              Leave From
              <input
                type="time"
                value={departFrom}
                onChange={(e) => setDepartFrom(e.target.value)}
              />
            </label>
            <label>
              Weekday
              <input
                type="checkbox"
                checked={weekday}
                onChange={(e) => setWeekday(e.target.checked)}
              />
            </label>
          </div>
        )}
        <button onClick={handleSubmit}>Add</button>
      </div>
      {errorMessage && <div className="error-message">{errorMessage}</div>}
    </div>
  );
};

export default DestinationForm;
