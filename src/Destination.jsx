import React, { useState } from "react";
const Destination = ({ data, changeWeight, remove }) => {
  const [weight, setWeight] = useState(data.weight);
  return (
    <div className="destination">
      <span>{data.name}</span>
      <span>{data.address}</span>
      <input
        type="text"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={() => changeWeight(weight)}
        placeholder="Weight"
        // set the border to red if data.validWeight is false
        style={{
          border: data.validWeight ? "" : "1px solid red",
        }}
      />
      <button onClick={remove}>Remove</button>
    </div>
  );
};
export default Destination;
