/*
Copyright (c) 2019 Steven Kitzes

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

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

// stolen from stackoverflow here: https://stackoverflow.com/a/2901298/983173
function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const sizeUp = (event) => {
  event.target.style.width = '325px';
  event.target.style.height = '3em';
  event.target.style.zIndex = '5';
}
const sizeDown = (event) => {
  event.target.style.width = '5px';
  event.target.style.height = '5px';
  event.target.style.zIndex = '4';
}
const sizeDownTarget = (target) => {
  target.style.width = '5px';
  target.style.height = '5px';
  target.style.zIndex = '4';
}

const drawFlights = (flights, minAlt, maxAlt, maxVel) => {
  log('Drawing flights');
  // set up constants for mathification
  const viewHeight = 500, viewWidth = 1000;
  const colorRange = 255;
  const verticalVelocityExtrema = 10;   // based on typical climb/descent rates
  const factorHeight = viewHeight / maxAlt;
  const factorWidth = viewWidth / maxVel;
  const factorPosVert = colorRange / verticalVelocityExtrema;
  const factorNegVert = colorRange / -verticalVelocityExtrema;
 
  flights.forEach(flight => {
    const point = document.createElement('div');
    const pointInfo = [];
    
    let pos = Math.floor(flight.vel * factorWidth);
    let top = 500 - Math.floor(flight.alt * factorHeight);
    let color = 0;
    
    top = top > 495 ? 495 : top;

    point.className = 'flight-point';
    point.style.position = 'absolute';
    point.style.top = top;

    if(pos > 650) {
      point.style.right = 1000 - pos;
    }
    else {
      point.style.left = pos;
    }
    
    if(flight.vert > 0) {
      color = 255 - Math.ceil(flight.vert * factorPosVert);
      point.style.backgroundColor = 'rgb(' + color + ',255,' + color + ')';
      point.style.zIndex = '2';
    }
    else if(flight.vert < 0) {
      color = 255 - Math.ceil(flight.vert * factorNegVert);
      point.style.backgroundColor = 'rgb(255,' + color + ',' + color + ')';
      point.style.zIndex = '2';
    }
    else {  // flight.verticalVelocity == 0
      point.style.backgroundColor = 'white';
      point.style.zIndex = '1';
    }

    // for extreme climb/descent rates, bring this point to foreground
    if(Math.abs(flight.vert) > 10) {
      point.style.zIndex = '3';
    }

    // build info string for expanded (hovered) points
    pointInfo.push('<div class="point-info">');
    pointInfo.push(
      flight.vert > 0 ?
        'Flight is ascending from FL ' + numberWithCommas(Math.floor(flight.alt * 3.28084 / 100)) + ' at ' + Math.ceil(flight.vert) + ' m/s' :
        flight.vert < 0 ?
          'Flight is descending from FL ' + numberWithCommas(Math.floor(flight.alt * 3.28084 / 100)) + ' at ' + Math.ceil(flight.vert) + ' m/s' :
          'Level flight at FL ' + numberWithCommas(Math.floor(flight.alt * 3.28084 / 100))
    );
    pointInfo.push('\nVelocity is ' + numberWithCommas(Math.ceil((flight.vel*3.6/1.6)/1.151)) + ' knots across the ground');
    pointInfo.push('</div>');
    point.innerHTML = pointInfo.join('');
    points.appendChild(point);
  });

  // assign mouseover listeners to points
  const pointNodes = document.getElementsByClassName('flight-point');
  for(let p of pointNodes) {
    p.addEventListener('mouseenter', sizeUp);
    p.addEventListener('mouseleave', sizeDown);
    p.addEventListener('mousedown', () => {sizeDownTarget(p)}, false);
  }

  // populate axis labels
  document.getElementById('alt-axis').innerHTML = '<div id="alt-info">^\nAltitude range is from \n' + numberWithCommas(Math.ceil(minAlt * 3.28084)) + 'ft\nto\n' + numberWithCommas(Math.ceil(maxAlt * 3.28084)) + 'ft\nv</div>';
  document.getElementById('speed-axis').innerHTML = '<div id="speed-info">&#60 = = Velocity range is from 0 to ' + numberWithCommas(Math.ceil(maxVel * 3.6 / 1.6)) + ' mi/hr = = &#62\n<span style="color:red;">Red</span> flights are descending, <span style="color:green;">green</span> flights are ascending, white are level flight (or no data)</div>';
  // hide loading div
  document.getElementById('loading-div').style.display = 'none';
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
    const call = flight[callSign];

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

    flights.push({alt,vel,vert,call});

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