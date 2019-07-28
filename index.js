// OpenSky API documentation: https://opensky-network.org/apidoc/rest.html
// OpenSky data indices
const
  icaoAddress = 0,
  callSign = 1,
  country = 2,
  lastPositionUpdate = 3,
  lastUpdate = 4,
  longitude = 5,
  latitude = 6,
  altitudeBarometric = 7,
  onGround = 8,
  velocity = 9,
  heading = 10,
  verticalVelocity = 11,
  receiversArray = 12,
  altitudeGeometric = 13,
  transponder = 14,
  specialPurposeIndicator = 15,
  positionSource = 16;

const drawFlights = (flights, maxAlt, maxVel) => {
  
}

const parse = response => {
  const data = response.states;
  const flights = [];

  let
    maxAlt = -1,
    minAlt = Infinity,
    maxVel = -1,
    minVel = Infinity;
  let altFails = 0;
  let velFails = 0;
  let grounded = 0;
  
  data.forEach(flight => {
    let alt = flight[altitudeBarometric];
    let vel = flight[velocity];
    const grd = flight[onGround];

    if(!alt) altFails++;
    if(!vel) velFails++;
    if(grd) grounded++;

    if(!alt || !vel || grd) {
      console.log('flight dropped; data point absent (or plane on ground)');
      return;
    }

    alt = alt < 1 ? 1 : alt;
    vel = vel < 1 ? 1 : vel;

    flights.push({alt,vel});

    if(alt > maxAlt)
      maxAlt = alt;
    if(alt < minAlt)
      minAlt = alt;
    if(vel > maxVel)
      maxVel = vel;
    if(vel < minVel)
      minVel = vel;
  });

  if(maxAlt == -1 || maxVel == -1 || minAlt == Infinity || minVel == Infinity) {
    console.log('failed; invalid value detected for extrema');
    return;
  }

  console.log('Found',flights.length,'valid flights from',data.length,'total');
  console.log('alt:',minAlt,maxAlt,'vel:',minVel,maxVel);
  console.log('Missing alt:',altFails,'Missing vel:',velFails,'Skipped; grounded:',grounded);

  drawFlights(flights, maxAlt, maxVel);
}

const run = () => {
  fetch('https://opensky-network.org/api/states/all')
    .then(function(response) {
      return response.json();
    })
    .then(function(myJson) {
      parse(myJson);
    })
    .catch(error => {
      console.log('Oopsie doopsie!');
      console.log(error);
    });
}

document.addEventListener('DOMContentLoaded', run);