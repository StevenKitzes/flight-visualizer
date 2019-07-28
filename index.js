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

// will be reassigned to represent divs later
let points, altAxis, velAxis;

const DEBUG = true;
const log = msg => {
  if(DEBUG) {
    console.log(msg);
  }
}

const drawFlights = (flights, minAlt, maxAlt, maxVel, minVert, maxVert) => {
  log('Drawing flights');
  const viewHeight = 500, viewWidth = 1000;
  const colorRange = 255;
  const factorHeight = viewHeight / maxAlt, factorWidth = viewWidth / maxVel;
  const factorPosVert = colorRange / maxVert, factorNegVert = viewWidth / minVert;

  flights.forEach(flight => {
    const point = document.createElement('div');
    point.className = 'flight-point';
    point.style.position = 'absolute';
    point.style.top = 500 - Math.floor(flight.alt * factorHeight);
    point.style.left = Math.floor(flight.vel * factorWidth);
    point.style.top = point.style.top > 495 ? 495 : point.style.top;
    point.style.left = point.style.left > 995 ? 995 : point.style.left;
    if(flight.vert > 0) {
      let color = flight.vert * factorPosVert;
      point.style.backgroundColor = 'rgb(' + color + ',255,' + color + ')';
    }
    else if(flight.vert < 0) {
      let color = flight.vert * factorNegVert;
      point.style.backgroundColor = 'rgb(255,' + color + ',' + color + ')';
    }
    else {  // flight.verticalVelocity == 0
      point.style.backgroundColor = 'white';
    }
    points.appendChild(point);
  });

  document.getElementById('alt-axis').innerHTML = '^\nAltitude range is from \n' + Math.ceil(minAlt * 3.28084) + 'ft\nto\n' + Math.ceil(maxAlt * 3.28084) + 'ft\nv';
  document.getElementById('speed-axis').innerHTML = '&#60 Velocity range is from 0 to ' + Math.ceil(maxVel * 3.6 / 1.6) + 'mi/hr &#62\n<span style="color:red;">Red</span> flights are descending, <span style="color:green;">green</span> flights are ascending, white are level flight (or no data)';
}

const parse = response => {
  log('Parsing flight data');
  const data = response.states;
  const flights = [];

  let
    maxAlt = -1,
    minAlt = Infinity,
    maxVel = -1,
    minVel = Infinity,
    maxVert = -1,
    minVert = Infinity;
  let altFails = 0;
  let velFails = 0;
  let grounded = 0;
  
  data.forEach(flight => {
    let alt = flight[altitudeBarometric];
    let vel = flight[velocity];
    let vert = flight[verticalVelocity];
    const grd = flight[onGround];

    if(!alt) altFails++;
    if(!vel) velFails++;
    if(grd) grounded++;

    if(!alt || !vel || grd) {
      log('flight dropped; data point absent (or plane on ground)');
      return;
    }
    if(!vert) vert = 0;

    alt = alt < 1 ? 1 : alt;
    vel = vel < 1 ? 1 : vel;

    flights.push({alt,vel,vert});

    if(alt > maxAlt)
      maxAlt = alt;
    if(alt < minAlt)
      minAlt = alt;
    if(vel > maxVel)
      maxVel = vel;
    if(vel < minVel)
      minVel = vel;
    if(vert > maxVert)
      maxVert = vert;
    if(vert < minVert)
      minVert = vert;
  });

  if(maxAlt == -1 || maxVel == -1 || minAlt == Infinity || minVel == Infinity) {
    log('failed; invalid value detected for extrema');
    return;
  }

  log('Found ' + flights.length + ' valid flights from ' + data.length + ' total');
  log('alt: ' + minAlt + ' ' + maxAlt + ' vel: ' + minVel + ' ' + maxVel + ' vert: ' + minVert + ' ' + maxVert);
  log('Missing alt: ' + altFails + ' Missing vel: ' + velFails + ' Skipped; grounded: ' + grounded);

  drawFlights(flights, minAlt, maxAlt, maxVel, minVert, maxVert);
}

const run = () => {
  log('Beginning fetch');
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
  
  points = document.getElementById('points');
  altAxis = document.getElementById('alt-axis');
  velAxis = document.getElementById('speed-axis');
}

document.addEventListener('DOMContentLoaded', run);