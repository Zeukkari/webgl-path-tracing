/*
 WebGL Path Tracing (http://madebyevan.com/webgl-path-tracing/)
 License: MIT License (see below)

 Copyright (c) 2010 Evan Wallace

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 OTHER DEALINGS IN THE SOFTWARE.
*/

import Vector from "./Vector";
import Matrix from "./Matrix";
import Line from "./Line";
import Plane from "./Plane";
import Sphere from "./Sphere";
import Cube from "./Cube";
import UI from "./UI";
import Renderer from "./Renderer";
import PathTracer from "./PathTracer";
import glUtils from "./glUtils";
import config from "./config";

import {
  renderVertexSource,
  renderFragmentSource,
  lineVertexSource,
  lineFragmentSource,
  tracerVertexSource,
  tracerFragmentSourceHeader,
  intersectCubeSource,
  normalForCubeSource,
  intersectSphereSource,
  normalForSphereSource,
  randomSource,
  cosineWeightedDirectionSource,
  uniformlyRandomDirectionSource,
  uniformlyRandomVectorSource,
  specularReflection,
  newDiffuseRay,
  newReflectiveRay,
  newGlossyRay,
  yellowBlueCornellBox,
  redGreenCornellBox,
  bounces,
  lightSize,
  lightVal,
  epsilon,
  infinity
} from "./shaders";

const MATERIAL_DIFFUSE = 0;
const MATERIAL_MIRROR = 1;
const MATERIAL_GLOSSY = 2;

const YELLOW_BLUE_CORNELL_BOX = 0;
const RED_GREEN_CORNELL_BOX = 1;

let environment = YELLOW_BLUE_CORNELL_BOX;
let material = MATERIAL_DIFFUSE;
let glossiness = 0.6;

const state = {
  nextObjectId: 0,
  eye: new Vector([0,0,0]),
  light: new Vector([0.4, 0.5, -0.6]),
  angleX: 0,
  angleY: 0,
  zoomZ: 2.5,
  inputFocusCount: 0,
  error: {},
  ui: undefined,
  canvas: undefined,
  oldX: 0,
  oldY: 0,
  mouseDown: false,
  gl: undefined,
  material: undefined,
  objects: [],
  uniforms: [],
  renderer: undefined,
  projection: undefined,
  modelview: undefined,
  modelviewProjection: undefined,
  vertexBuffer: undefined,
  vertexAttribute: undefined,
  indexBuffer: undefined,
  lineProgram: undefined,
  selectedObject: null,
  pathTracer: null,
  sampleCount: 0,
  glossiness: 0.6
};

window.state = state;

const concat = function(objects, func) {
  var text = "";
  for (var i = 0; i < objects.length; i++) {
    text += func(objects[i]);
  }
  return text;
};

function makeShadow(objects) {
  return (
    "" +
    " float shadow(vec3 origin, vec3 ray) {" +
    concat(objects, function(o) {
      return o.getShadowTestCode();
    }) +
    "   return 1.0;" +
    " }"
  );
}

function makeCalculateColor(objects) {
  return (
    "" +
    " vec3 calculateColor(vec3 origin, vec3 ray, vec3 light) {" +
    "   vec3 colorMask = vec3(1.0);" +
    "   vec3 accumulatedColor = vec3(0.0);" +
    // main raytracing loop
    "   for(int bounce = 0; bounce < " +
    bounces +
    "; bounce++) {" +
    // compute the intersection with everything
    "     vec2 tRoom = intersectCube(origin, ray, roomCubeMin, roomCubeMax);" +
    concat(objects, function(o) {
      return o.getIntersectCode();
    }) +
    // find the closest intersection
    "     float t = " +
    infinity +
    ";" +
    "     if(tRoom.x < tRoom.y) t = tRoom.y;" +
    concat(objects, function(o) {
      return o.getMinimumIntersectCode();
    }) +
    // info about hit
    "     vec3 hit = origin + ray * t;" +
    "     vec3 surfaceColor = vec3(0.75);" +
    "     float specularHighlight = 0.0;" +
    "     vec3 normal;" +
    // calculate the normal (and change wall color)
    "     if(t == tRoom.y) {" +
    "       normal = -normalForCube(hit, roomCubeMin, roomCubeMax);" +
    [yellowBlueCornellBox, redGreenCornellBox][state.environment] +
    newDiffuseRay +
    "     } else if(t == " +
    infinity +
    ") {" +
    "       break;" +
    "     } else {" +
    "       if(false) ;" + // hack to discard the first 'else' in 'else if'
    concat(objects, function(o) {
      return o.getNormalCalculationCode();
    }) +
    [newDiffuseRay, newReflectiveRay, newGlossyRay][state.material] +
    "     }" +
    // compute diffuse lighting contribution
    "     vec3 toLight = light - hit;" +
    "     float diffuse = max(0.0, dot(normalize(toLight), normal));" +
    // trace a shadow ray to the light
    "     float shadowIntensity = shadow(hit + normal * " +
    epsilon +
    ", toLight);" +
    // do light bounce
    "     colorMask *= surfaceColor;" +
    "     accumulatedColor += colorMask * (" +
    lightVal +
    " * diffuse * shadowIntensity);" +
    "     accumulatedColor += colorMask * specularHighlight * shadowIntensity;" +
    // calculate next origin
    "     origin = hit;" +
    "   }" +
    "   return accumulatedColor;" +
    " }"
  );
}

function makeMain() {
  return (
    "" +
    " void main() {" +
    "   vec3 newLight = light + uniformlyRandomVector(timeSinceStart - 53.0) * " +
    lightSize +
    ";" +
    "   vec3 texture = texture2D(texture, gl_FragCoord.xy / " + config.resolution +").rgb;" +
    "   gl_FragColor = vec4(mix(calculateColor(eye, initialRay, newLight), texture, textureWeight), 1.0);" +
    " }"
  );
}

export const makeTracerFragmentSource = function(objects) {
  return (
    tracerFragmentSourceHeader +
    concat(objects, function(o) {
      return o.getGlobalCode();
    }) +
    intersectCubeSource +
    normalForCubeSource +
    intersectSphereSource +
    normalForSphereSource +
    randomSource +
    cosineWeightedDirectionSource +
    uniformlyRandomDirectionSource +
    uniformlyRandomVectorSource +
    makeShadow(objects) +
    makeCalculateColor(objects) +
    makeMain()
  );
};

function tick(timeSinceStart) {
  state.eye.elements[0] =
    state.zoomZ * Math.sin(state.angleY) * Math.cos(state.angleX);
  state.eye.elements[1] = state.zoomZ * Math.sin(state.angleX);
  state.eye.elements[2] =
    state.zoomZ * Math.cos(state.angleY) * Math.cos(state.angleX);

  document.getElementById("glossiness-factor").style.display =
    state.material == MATERIAL_GLOSSY ? "inline" : "none";

  state.ui.updateMaterial();
  state.ui.updateGlossiness();
  state.ui.updateEnvironment();

  state.ui.render();
  state.ui.update(timeSinceStart);
}

function makeStacks() {
  var objects = [];

  // lower level
  objects.push(
    new Cube(
      new Vector([-0.5, -0.75, -0.5]),
      new Vector([0.5, -0.7, 0.5]),
      state.nextObjectId++
    )
  );

  // further poles
  objects.push(
    new Cube(
      new Vector([-0.45, -1, -0.45]),
      new Vector([-0.4, -0.45, -0.4]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([0.4, -1, -0.45]),
      new Vector([0.45, -0.45, -0.4]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([-0.45, -1, 0.4]),
      new Vector([-0.4, -0.45, 0.45]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([0.4, -1, 0.4]),
      new Vector([0.45, -0.45, 0.45]),
      state.nextObjectId++
    )
  );

  // upper level
  objects.push(
    new Cube(
      new Vector([-0.3, -0.5, -0.3]),
      new Vector([0.3, -0.45, 0.3]),
      state.nextObjectId++
    )
  );

  // closer poles
  objects.push(
    new Cube(
      new Vector([-0.25, -0.7, -0.25]),
      new Vector([-0.2, -0.25, -0.2]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([0.2, -0.7, -0.25]),
      new Vector([0.25, -0.25, -0.2]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([-0.25, -0.7, 0.2]),
      new Vector([-0.2, -0.25, 0.25]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([0.2, -0.7, 0.2]),
      new Vector([0.25, -0.25, 0.25]),
      state.nextObjectId++
    )
  );

  // upper level
  objects.push(
    new Cube(
      new Vector([-0.25, -0.25, -0.25]),
      new Vector([0.25, -0.2, 0.25]),
      state.nextObjectId++
    )
  );

  // state.ui.setObjects(objects);
  return objects;
}

function makeTableAndChair() {
  var objects = [];

  // table top
  objects.push(
    new Cube(
      new Vector([-0.5, -0.35, -0.5]),
      new Vector([0.3, -0.3, 0.5]),
      state.nextObjectId++
    )
  );

  // table legs
  objects.push(
    new Cube(
      new Vector([-0.45, -1, -0.45]),
      new Vector([-0.4, -0.35, -0.4]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([0.2, -1, -0.45]),
      new Vector([0.25, -0.35, -0.4]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([-0.45, -1, 0.4]),
      new Vector([-0.4, -0.35, 0.45]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([0.2, -1, 0.4]),
      new Vector([0.25, -0.35, 0.45]),
      state.nextObjectId++
    )
  );

  // chair seat
  objects.push(
    new Cube(
      new Vector([0.3, -0.6, -0.2]),
      new Vector([0.7, -0.55, 0.2]),
      state.nextObjectId++
    )
  );

  // chair legs
  objects.push(
    new Cube(
      new Vector([0.3, -1, -0.2]),
      new Vector([0.35, -0.6, -0.15]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([0.3, -1, 0.15]),
      new Vector([0.35, -0.6, 0.2]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([0.65, -1, -0.2]),
      new Vector([0.7, 0.1, -0.15]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([0.65, -1, 0.15]),
      new Vector([0.7, 0.1, 0.2]),
      state.nextObjectId++
    )
  );

  // chair back
  objects.push(
    new Cube(
      new Vector([0.65, 0.05, -0.15]),
      new Vector([0.7, 0.1, 0.15]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([0.65, -0.55, -0.09]),
      new Vector([0.7, 0.1, -0.03]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Cube(
      new Vector([0.65, -0.55, 0.03]),
      new Vector([0.7, 0.1, 0.09]),
      state.nextObjectId++
    )
  );

  // sphere on table
  objects.push(
    new Sphere(new Vector([-0.1, -0.05, 0]), 0.25, state.nextObjectId++)
  );

  // state.ui.setObjects(objects);
  return objects;
}

function makeSphereAndCube() {
  var objects = [];

  objects.push(
    new Cube(
      new Vector([-0.25, -1, -0.25]),
      new Vector([0.25, -0.75, 0.25]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Sphere(new Vector([0, -0.75, 0]), 0.25, state.nextObjectId++)
  );
  // state.ui.setObjects(objects);
  return objects;
}

function makeSphereColumn() {
  var objects = [];
  objects.push(
    new Sphere(new Vector([0, 0.75, 0]), 0.25, state.nextObjectId++)
  );
  objects.push(
    new Sphere(new Vector([0, 0.25, 0]), 0.25, state.nextObjectId++)
  );
  objects.push(
    new Sphere(new Vector([0, -0.25, 0]), 0.25, state.nextObjectId++)
  );
  objects.push(
    new Sphere(new Vector([0, -0.75, 0]), 0.25, state.nextObjectId++)
  );
  // state.ui.setObjects(objects);
  return objects;
}

function makeCubeAndSpheres() {
  var objects = [];
  objects.push(
    new Cube(
      new Vector([-0.25, -0.25, -0.25]),
      new Vector([0.25, 0.25, 0.25]),
      state.nextObjectId++
    )
  );
  objects.push(
    new Sphere(new Vector([-0.25, 0, 0]), 0.25, state.nextObjectId++)
  );
  objects.push(
    new Sphere(new Vector([+0.25, 0, 0]), 0.25, state.nextObjectId++)
  );
  objects.push(
    new Sphere(new Vector([0, -0.25, 0]), 0.25, state.nextObjectId++)
  );
  objects.push(
    new Sphere(new Vector([0, +0.25, 0]), 0.25, state.nextObjectId++)
  );
  objects.push(
    new Sphere(new Vector([0, 0, -0.25]), 0.25, state.nextObjectId++)
  );
  objects.push(
    new Sphere(new Vector([0, 0, +0.25]), 0.25, state.nextObjectId++)
  );
  // state.ui.setObjects(objects);
  return objects;
}

function makeSpherePyramid() {
  var root3_over4 = 0.433012701892219;
  var root3_over6 = 0.288675134594813;
  var root6_over6 = 0.408248290463863;
  var objects = [];

  // first level
  objects.push(
    new Sphere(
      new Vector([-0.5, -0.75, -root3_over6]),
      0.25,
      state.nextObjectId++
    )
  );
  objects.push(
    new Sphere(
      new Vector([0.0, -0.75, -root3_over6]),
      0.25,
      state.nextObjectId++
    )
  );
  objects.push(
    new Sphere(
      new Vector([0.5, -0.75, -root3_over6]),
      0.25,
      state.nextObjectId++
    )
  );
  objects.push(
    new Sphere(
      new Vector([-0.25, -0.75, root3_over4 - root3_over6]),
      0.25,
      state.nextObjectId++
    )
  );
  objects.push(
    new Sphere(
      new Vector([0.25, -0.75, root3_over4 - root3_over6]),
      0.25,
      state.nextObjectId++
    )
  );
  objects.push(
    new Sphere(
      new Vector([0.0, -0.75, 2.0 * root3_over4 - root3_over6]),
      0.25,
      state.nextObjectId++
    )
  );

  // second level
  objects.push(
    new Sphere(
      new Vector([0.0, -0.75 + root6_over6, root3_over6]),
      0.25,
      state.nextObjectId++
    )
  );
  objects.push(
    new Sphere(
      new Vector([-0.25, -0.75 + root6_over6, -0.5 * root3_over6]),
      0.25,
      state.nextObjectId++
    )
  );
  objects.push(
    new Sphere(
      new Vector([0.25, -0.75 + root6_over6, -0.5 * root3_over6]),
      0.25,
      state.nextObjectId++
    )
  );

  // third level
  objects.push(
    new Sphere(
      new Vector([0.0, -0.75 + 2.0 * root6_over6, 0.0]),
      0.25,
      state.nextObjectId++
    )
  );

  // state.ui.setObjects(objects);
  return objects;
}

var XNEG = 0,
  XPOS = 1,
  YNEG = 2,
  YPOS = 3,
  ZNEG = 4,
  ZPOS = 5;

function addRecursiveSpheresBranch(objects, center, radius, depth, dir) {
  objects.push(new Sphere(center, radius, state.nextObjectId++));
  if (depth--) {
    if (dir != XNEG)
      addRecursiveSpheresBranch(
        objects,
        center.subtract(new Vector([radius * 1.5, 0, 0])),
        radius / 2,
        depth,
        XPOS
      );
    if (dir != XPOS)
      addRecursiveSpheresBranch(
        objects,
        center.add(new Vector([radius * 1.5, 0, 0])),
        radius / 2,
        depth,
        XNEG
      );

    if (dir != YNEG)
      addRecursiveSpheresBranch(
        objects,
        center.subtract(new Vector([0, radius * 1.5, 0])),
        radius / 2,
        depth,
        YPOS
      );
    if (dir != YPOS)
      addRecursiveSpheresBranch(
        objects,
        center.add(new Vector([0, radius * 1.5, 0])),
        radius / 2,
        depth,
        YNEG
      );

    if (dir != ZNEG)
      addRecursiveSpheresBranch(
        objects,
        center.subtract(new Vector([0, 0, radius * 1.5])),
        radius / 2,
        depth,
        ZPOS
      );
    if (dir != ZPOS)
      addRecursiveSpheresBranch(
        objects,
        center.add(new Vector([0, 0, radius * 1.5])),
        radius / 2,
        depth,
        ZNEG
      );
  }
}

function makeRecursiveSpheres() {
  var objects = [];
  addRecursiveSpheresBranch(objects, new Vector([0, 0, 0]), 0.3, 2, -1);
  // state.ui.setObjects(objects);
  return objects;
}

function elementPos(element) {
  var x = 0;
  var y = 0;
  while (element.offsetParent) {
    x += element.offsetLeft;
    y += element.offsetTop;
    element = element.offsetParent;
  }
  return { x: x, y: y };
}

function eventPos(event) {
  return {
    x:
      event.clientX +
      document.body.scrollLeft +
      document.documentElement.scrollLeft,
    y:
      event.clientY +
      document.body.scrollTop +
      document.documentElement.scrollTop
  };
}

function canvasMousePos(event) {
  var mousePos = eventPos(event);
  var canvasPos = elementPos(canvas);
  return {
    x: mousePos.x - canvasPos.x,
    y: mousePos.y - canvasPos.y
  };
}

window.onload = function() {
  let mouseDown = false;

  state.gl = null;
  state.error = document.getElementById("error");
  state.canvas = document.getElementById("canvas");
  state.canvas.setAttribute("width", config.resolution);
  state.canvas.setAttribute("height", config.resolution);

  try {
    state.gl = canvas.getContext("experimental-webgl");
  } catch (e) {
    throw `exception ${e}`;
  }

  if (state.gl) {
    error.innerHTML = "Loading...";

    // keep track of whether an <input> is focused or not (will be no only if state.inputFocusCount == 0)
    var inputs = document.getElementsByTagName("input");
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].onfocus = function() {
        state.inputFocusCount++;
      };
      inputs[i].onblur = function() {
        state.inputFocusCount--;
      };
    }

    state.material = parseInt(document.getElementById("material").value, 10);
    state.environment = parseInt(
      document.getElementById("environment").value,
      10
    );
    state.ui = new UI(state);
    state.ui.setObjects(makeTableAndChair());
    var start = new Date();
    error.style.zIndex = -1;
    setInterval(function() {
      tick((new Date() - start) * 0.001);
    }, 1000 / 60);
  } else {
    error.innerHTML =
      'Your browser does not support Webthis.gl.<br>Please see <a href="http://www.khronos.org/webgl/wiki/Getting_a_WebGL_Implementation">Getting a WebGL Implementation</a>.';
  }

  document.onmousedown = function(event) {
    console.log("mousedown", event);
    var mouse = canvasMousePos(event);
    state.oldX = mouse.x;
    state.oldY = mouse.y;

    if (mouse.x >= 0 && mouse.x < config.resolution && mouse.y >= 0 && mouse.y < config.resolution) {
      state.mouseDown = !state.ui.mouseDown(mouse.x, mouse.y);

      // disable selection because dragging is used for rotating the camera and moving objects
      return false;
    }

    return true;
  };

  document.onmousemove = function(event) {
    var mouse = canvasMousePos(event);

    if (state.mouseDown) {
      // update the angles based on how far we moved since last time
      state.angleY -= (mouse.x - state.oldX) * 0.01;
      state.angleX += (mouse.y - state.oldY) * 0.01;

      // don't go upside down
      state.angleX = Math.max(state.angleX, -Math.PI / 2 + 0.01);
      state.angleX = Math.min(state.angleX, Math.PI / 2 - 0.01);

      // clear the sample buffer
      state.sampleCount = 0;

      // remember this coordinate
      state.oldX = mouse.x;
      state.oldY = mouse.y;
    } else {
      var canvasPos = elementPos(state.canvas);
      state.ui.mouseMove(mouse.x, mouse.y);
    }
  };

  document.onmouseup = function(event) {
    state.mouseDown = false;
    var mouse = canvasMousePos(event);
    state.ui.mouseUp(mouse.x, mouse.y);
  };

  document.onkeydown = function(event) {
    // if there are no <input> elements focused
    if (state.inputFocusCount == 0) {
      // if backspace or delete was pressed
      if (event.keyCode == 8 || event.keyCode == 46) {
        state.ui.deleteSelection();

        // don't let the backspace key go back a page
        return false;
      }
    }
  };

  document.getElementById("makeSphereColumn").onclick = e => state.ui.setObjects(makeSphereColumn());
  document.getElementById("makeSpherePyramid").onclick = e => state.ui.setObjects(makeSpherePyramid());
  document.getElementById("makeSphereAndCube").onclick = e => state.ui.setObjects(makeSphereAndCube());
  document.getElementById("makeCubeAndSpheres").onclick = e => state.ui.setObjects(makeCubeAndSpheres());
  document.getElementById("makeTableAndChair").onclick = e =>state.ui.setObjects(makeTableAndChair());
  document.getElementById("makeStacks").onclick = e => state.ui.setObjects(makeStacks());

  document.getElementById("selectLightButton").onclick = e => state.ui.selectLight();
  document.getElementById("addSphereButton").onclick = e => state.ui.addSphere();
  document.getElementById("addCubeButton").onclick = e => state.ui.addCube();
};
