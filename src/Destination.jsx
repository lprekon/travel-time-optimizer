import React, { useState } from "react";
const Destination = ({
  data,
  changeWeight,
  remove,
  changeTime,
  changeWeekday,
}) => {
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
              value={data.time.departFor}
              onChange={(e) => changeTime("departFor", e.target.value)}
            />
          </label>
          <label>
            Depart At
            <input
              type="time"
              value={data.time.departFrom}
              onChange={(e) => changeTime("departFrom", e.target.value)}
            />
          </label>
          <label>
            Weekday
            <input
              type="checkbox"
              checked={data.time.weekday}
              onChange={(e) => changeWeekday(e.target.checked)}
            />
          </label>
        </div>
      )}
      <button onClick={remove}>Remove</button>
    </div>
  );
};
export default Destination;
