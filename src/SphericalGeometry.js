// generate samplepoints around the midpoint outside the radius, which a spaceing in miles of gridSpacing, defaulting to 0.5 miles
const generateSamplePoints = (midpoint, radius, gridSpacing = 0.5) => {
  console.log("Generating sample points...");
  console.log("Midpoint: ", midpoint);
  console.log("Radius: ", radius);
  console.log("Grid spacing: ", gridSpacing);
  console.log(
    "approximate total points:",
    (radius / gridSpacing) ** 2 * (Math.PI / 4)
  );
  const samplePoints = [];

  let pointCount = 0;
  const cosCR = Math.cos(radius / EARTH_RADIUS_MILES); // calculate the cosine of the angle subtended by an arc `radius` miles on the surface of the Earth
  for (
    let verticalDisplacementMiles = radius;
    verticalDisplacementMiles >= -radius;
    verticalDisplacementMiles -= gridSpacing
  ) {
    const cosAR = Math.cos(verticalDisplacementMiles / EARTH_RADIUS_MILES); // calculate the cosine of the angle subtended by an arc `verticalDisplacementMiles` miles on the surface of the Earth
    const maxLateralDisplacementMiles =
      Math.acos(cosCR / cosAR) * EARTH_RADIUS_MILES; // calculate the maximum lateral displacement in miles, by solving the spherical pythagorean theorem
    for (
      let lateralDisplacementMiles = -maxLateralDisplacementMiles;
      lateralDisplacementMiles <= maxLateralDisplacementMiles;
      lateralDisplacementMiles += gridSpacing
    ) {
      const lat = vertMilesToLat(verticalDisplacementMiles) + midpoint.lat;
      const lng = latMilesToLng(lateralDisplacementMiles, lat) + midpoint.lng;
      samplePoints.push({ lat, lng }); // should always be within our radius thanks to the fancy spherical pythagorean math above
      pointCount++;
      if (pointCount >= 1000000) {
        console.log("Point count exceeded 1 million, stopping generation");
        return samplePoints;
      }
    }
  }
  return samplePoints;
};

const vertMilesToLat = (verticalDisplacementMiles) => {
  return verticalDisplacementMiles / 69;
};

const latMilesToLng = (lateralDisplacementMiles, lat) => {
  return lateralDisplacementMiles / (69 * Math.cos(lat * (Math.PI / 180)));
};
const calculateMidpoint = (destinations) => {
  const latSum = destinations.reduce(
    (sum, dest) => sum + dest.coordinates.lat,
    0
  );
  const lngSum = destinations.reduce(
    (sum, dest) => sum + dest.coordinates.lng,
    0
  );
  const midLat = latSum / destinations.length;
  const midLng = lngSum / destinations.length;
  return { lat: midLat, lng: midLng };
};

const calculateMaxDistance = (midpoint, destinations) => {
  let maxDistance = 5; // default to 5 miles
  const distances = destinations.map((dest) => {
    // const distance = calculateHaversineDistance(midpoint, dest.coordinates);
    const distance = calculateHaversineDistanceMiles(
      midpoint,
      dest.coordinates
    );
    if (distance > maxDistance) {
      maxDistance = distance;
    }
  });
  return maxDistance;
};

const calculateHaversineDistanceMiles = (point1, point2) => {
  const dLat = point2.lat - point1.lat * (Math.PI / 180); // Convert to radians
  const dLng = point2.lng - point1.lng * (Math.PI / 180); // Convert to radians
  const lat1Rad = point1.lat * (Math.PI / 180); // Convert to radians
  const lat2Rad = point2.lat * (Math.PI / 180); // Convert to radians
  const a =
    1 -
    Math.cos(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * (1 - Math.cos(dLng / 2));
  const b = Math.sqrt(a);
  const c = 2 * EARTH_RADIUS_MILES * Math.asin(b);
  return c;
};

const calculateEuclideanDistance = (point1, point2) => {
  const dLat = point2.lat - point1.lat;
  const dLng = point2.lng - point1.lng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

const EARTH_RADIUS_MILES = 3958.8; // average radius of Earth in miles

export {
  generateSamplePoints,
  calculateMidpoint,
  calculateMaxDistance,
  calculateHaversineDistance,
};
