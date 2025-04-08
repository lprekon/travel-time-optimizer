const MAX_POINTS = 10000;
// const MAX_POINTS = 2; // DEBUGGING ONLY

// generate samplepoints around the midpoint outside the radius, which a spaceing in miles of gridSpacing, defaulting to 0.5 miles
const generateSamplePoints = (midpoint, radius, gridSpacing = 0.5) => {
  console.log("Generating sample points...");
  console.log("Midpoint: ", midpoint);
  console.log("Radius: ", radius);
  console.log("Grid spacing: ", gridSpacing);
  console.log(
    "approximate total points:",
    ((2 * radius) / gridSpacing) ** 2 * (Math.PI / 4)
  );
  const samplePoints = [];

  let pointCount = 0;

  // this is the "dumber" but simpler way to generate sample points.
  for (let vDisM = -radius; vDisM <= radius; vDisM += gridSpacing) {
    for (let hDisM = -radius; hDisM <= radius; hDisM += gridSpacing) {
      const latStep = vertMilesToLat(vDisM);
      const pointLat = midpoint.lat + latStep;
      const lngStep = latMilesToLng(hDisM, pointLat);
      const pointLng = midpoint.lng + lngStep;
      const newPoint = { lat: pointLat, lng: pointLng };
      const newPointDist = haversineDistanceMiles(midpoint, newPoint);
      if (newPointDist > radius) {
        continue; // Skip points within the radius
      }
      samplePoints.push(newPoint);

      pointCount++;
      if (pointCount >= MAX_POINTS) {
        console.log("Point count exceeded 1 million, stopping generation");
        return samplePoints;
      }
    }
  }
  console.log("Generated sample points: ", samplePoints.length);
  return samplePoints;
};

const vertMilesToLat = (verticalDisplacementMiles) => {
  return verticalDisplacementMiles / 69;
};

const latMilesToLng = (lateralDisplacementMiles, lat) => {
  return lateralDisplacementMiles / (69 * Math.cos(lat * (Math.PI / 180)));
};
const calculateMidpoint = (destinations) => {
  console.log("Calculating midpoint over destinations...", destinations);
  let maxLat = -Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let minLng = Infinity;
  destinations.forEach((dest) => {
    if (dest.coordinates.lat > maxLat) {
      maxLat = dest.coordinates.lat;
    }
    if (dest.coordinates.lat < minLat) {
      minLat = dest.coordinates.lat;
    }
    if (dest.coordinates.lng > maxLng) {
      maxLng = dest.coordinates.lng;
    }
    if (dest.coordinates.lng < minLng) {
      minLng = dest.coordinates.lng;
    }
  });
  const midpoint = {
    lat: (maxLat + minLat) / 2,
    lng: (maxLng + minLng) / 2,
  };
  console.log("returning midpoint: ", midpoint);
  return midpoint;
};

const calculateMaxDistance = (midpoint, destinations) => {
  console.log("Calculating max distance...");
  var maxDistance = 0;
  const distances = destinations.map((dest) => {
    // const distance = calculateHaversineDistance(midpoint, dest.coordinates);
    const distance = haversineDistanceMiles(midpoint, dest.coordinates);
    console.log({ midpoint, dest, distance });
    if (distance > maxDistance) {
      maxDistance = distance;
    }
  });
  return maxDistance;
};

const haversine = (point1, point) => {
  const lat1Rad = point1.lat * (Math.PI / 180);
  const lat2Rad = point.lat * (Math.PI / 180);
  const dLat = (point.lat - point1.lat) * (Math.PI / 180);
  const dLng = (point.lng - point1.lng) * (Math.PI / 180);

  const a = (1 - Math.cos(dLat)) / 2;
  const b = Math.cos(lat1Rad) * Math.cos(lat2Rad);
  const c = (1 - Math.cos(dLng)) / 2;

  const haversine = a + b * c;
  return haversine;
};

const haversineDistanceMiles = (point1, point2) => {
  const haversineValue = haversine(point1, point2);
  const root = Math.sqrt(haversineValue);
  const distance = 2 * EARTH_RADIUS_MILES * Math.asin(root);
  return distance;
};

const euclideanDistanceMiles = (point1, point2) => {
  const dLat = point2.lat - point1.lat;
  const dLng = point2.lng - point1.lng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

const EARTH_RADIUS_MILES = 3958.8; // average radius of Earth in miles

export { generateSamplePoints, calculateMidpoint, calculateMaxDistance };
