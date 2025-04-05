import React, { useState } from "react";
const Destination = ({ data, changeWeight, remove }) => {
  const [weight, setWeight] = useState(data.weight);
  return (
    <div className="destination">
      <span>{data.name}</span>
      <span>{data.address}</span>
      <input
        type="text"
        value={data.weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={() => changeWeight(weight)}
        placeholder="Weight"
      />
      <button onClick={remove}>Remove</button>
    </div>
  );
};
export default Destination;
