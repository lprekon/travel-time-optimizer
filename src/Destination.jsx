import React, { useState } from "react";
const Destination = ({ data, changeWeight, remove, changeTime }) => {
  const [weight, setWeight] = useState(data.weight);
  return (
    <div className="destination">
      <span>{data.name}</span>
      <span>{data.address}</span>
      <label>
        Weight
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
      </label>

      {data.time && (
        <div>
          <label>
            Arrive By
            <input
              type="time"
              value={data.time.arriveTime}
              onChange={(e) => changeTime("arriveTime", e.target.value)}
            />
          </label>
          <label>
            Depart At
            <input
              type="time"
              value={data.time.departTime}
              onChange={(e) => changeTime("departTime", e.target.value)}
            />
          </label>
        </div>
      )}
      <button onClick={remove}>Remove</button>
    </div>
  );
};
export default Destination;
