////////////////////////////////////////////////////////////////////////////////
// shader strings
////////////////////////////////////////////////////////////////////////////////

// constants for the shaders
const bounces = "5";
const lightSize = 0.1;
const lightVal = 0.5;
const epsilon = "0.0001";
const infinity = "10000.0";

// vertex shader for drawing a textured quad
const renderVertexSource =
  " attribute vec3 vertex;" +
  " varying vec2 texCoord;" +
  " void main() {" +
  "   texCoord = vertex.xy * 0.5 + 0.5;" +
  "   gl_Position = vec4(vertex, 1.0);" +
  " }";
// fragment shader for drawing a textured quad
const renderFragmentSource =
  " precision highp float;" +
  " varying vec2 texCoord;" +
  " uniform sampler2D texture;" +
  " void main() {" +
  "   gl_FragColor = texture2D(texture, texCoord);" +
  " }";

// vertex shader for drawing a line
const lineVertexSource =
  " attribute vec3 vertex;" +
  " uniform vec3 cubeMin;" +
  " uniform vec3 cubeMax;" +
  " uniform mat4 modelviewProjection;" +
  " void main() {" +
  "   gl_Position = modelviewProjection * vec4(mix(cubeMin, cubeMax, vertex), 1.0);" +
  " }";

// fragment shader for drawing a line
const lineFragmentSource =
  " precision highp float;" +
  " void main() {" +
  "   gl_FragColor = vec4(1.0);" +
  " }";

// vertex shader, interpolate ray per-pixel
const tracerVertexSource =
  " attribute vec3 vertex;" +
  " uniform vec3 eye, ray00, ray01, ray10, ray11;" +
  " varying vec3 initialRay;" +
  " void main() {" +
  "   vec2 percent = vertex.xy * 0.5 + 0.5;" +
  "   initialRay = mix(mix(ray00, ray01, percent.y), mix(ray10, ray11, percent.y), percent.x);" +
  "   gl_Position = vec4(vertex, 1.0);" +
  " }";

// start of fragment shader
const tracerFragmentSourceHeader =
  " precision highp float;" +
  " uniform vec3 eye;" +
  " varying vec3 initialRay;" +
  " uniform float textureWeight;" +
  " uniform float timeSinceStart;" +
  " uniform sampler2D texture;" +
  " uniform float glossiness;" +
  " vec3 roomCubeMin = vec3(-1.0, -1.0, -1.0);" +
  " vec3 roomCubeMax = vec3(1.0, 1.0, 1.0);";

// compute the near and far intersections of the cube (stored in the x and y components) using the slab method
// no intersection means vec.x > vec.y (really tNear > tFar)
const intersectCubeSource =
  " vec2 intersectCube(vec3 origin, vec3 ray, vec3 cubeMin, vec3 cubeMax) {" +
  "   vec3 tMin = (cubeMin - origin) / ray;" +
  "   vec3 tMax = (cubeMax - origin) / ray;" +
  "   vec3 t1 = min(tMin, tMax);" +
  "   vec3 t2 = max(tMin, tMax);" +
  "   float tNear = max(max(t1.x, t1.y), t1.z);" +
  "   float tFar = min(min(t2.x, t2.y), t2.z);" +
  "   return vec2(tNear, tFar);" +
  " }";

// given that hit is a point on the cube, what is the surface normal?
// TODO: do this with fewer branches
const normalForCubeSource =
  " vec3 normalForCube(vec3 hit, vec3 cubeMin, vec3 cubeMax)" +
  " {" +
  "   if(hit.x < cubeMin.x + " +
  epsilon +
  ") return vec3(-1.0, 0.0, 0.0);" +
  "   else if(hit.x > cubeMax.x - " +
  epsilon +
  ") return vec3(1.0, 0.0, 0.0);" +
  "   else if(hit.y < cubeMin.y + " +
  epsilon +
  ") return vec3(0.0, -1.0, 0.0);" +
  "   else if(hit.y > cubeMax.y - " +
  epsilon +
  ") return vec3(0.0, 1.0, 0.0);" +
  "   else if(hit.z < cubeMin.z + " +
  epsilon +
  ") return vec3(0.0, 0.0, -1.0);" +
  "   else return vec3(0.0, 0.0, 1.0);" +
  " }";

// compute the near intersection of a sphere
// no intersection returns a value of +infinity
const intersectSphereSource =
  " float intersectSphere(vec3 origin, vec3 ray, vec3 sphereCenter, float sphereRadius) {" +
  "   vec3 toSphere = origin - sphereCenter;" +
  "   float a = dot(ray, ray);" +
  "   float b = 2.0 * dot(toSphere, ray);" +
  "   float c = dot(toSphere, toSphere) - sphereRadius*sphereRadius;" +
  "   float discriminant = b*b - 4.0*a*c;" +
  "   if(discriminant > 0.0) {" +
  "     float t = (-b - sqrt(discriminant)) / (2.0 * a);" +
  "     if(t > 0.0) return t;" +
  "   }" +
  "   return " +
  infinity +
  ";" +
  " }";

// given that hit is a point on the sphere, what is the surface normal?
const normalForSphereSource =
  " vec3 normalForSphere(vec3 hit, vec3 sphereCenter, float sphereRadius) {" +
  "   return (hit - sphereCenter) / sphereRadius;" +
  " }";

// use the fragment position for randomness
const randomSource =
  " float random(vec3 scale, float seed) {" +
  "   return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);" +
  " }";

// random cosine-weighted distributed vector
// from http://www.rorydriscoll.com/2009/01/07/better-sampling/
const cosineWeightedDirectionSource =
  " vec3 cosineWeightedDirection(float seed, vec3 normal) {" +
  "   float u = random(vec3(12.9898, 78.233, 151.7182), seed);" +
  "   float v = random(vec3(63.7264, 10.873, 623.6736), seed);" +
  "   float r = sqrt(u);" +
  "   float angle = 6.283185307179586 * v;" +
  // compute basis from normal
  "   vec3 sdir, tdir;" +
  "   if (abs(normal.x)<.5) {" +
  "     sdir = cross(normal, vec3(1,0,0));" +
  "   } else {" +
  "     sdir = cross(normal, vec3(0,1,0));" +
  "   }" +
  "   tdir = cross(normal, sdir);" +
  "   return r*cos(angle)*sdir + r*sin(angle)*tdir + sqrt(1.-u)*normal;" +
  " }";

// random normalized vector
const uniformlyRandomDirectionSource =
  " vec3 uniformlyRandomDirection(float seed) {" +
  "   float u = random(vec3(12.9898, 78.233, 151.7182), seed);" +
  "   float v = random(vec3(63.7264, 10.873, 623.6736), seed);" +
  "   float z = 1.0 - 2.0 * u;" +
  "   float r = sqrt(1.0 - z * z);" +
  "   float angle = 6.283185307179586 * v;" +
  "   return vec3(r * cos(angle), r * sin(angle), z);" +
  " }";

// random vector in the unit sphere
// note: this is probably not statistically uniform, saw raising to 1/3 power somewhere but that looks wrong?
const uniformlyRandomVectorSource =
  " vec3 uniformlyRandomVector(float seed) {" +
  "   return uniformlyRandomDirection(seed) * sqrt(random(vec3(36.7539, 50.3658, 306.2759), seed));" +
  " }";

// compute specular lighting contribution
const specularReflection =
  " vec3 reflectedLight = normalize(reflect(light - hit, normal));" +
  " specularHighlight = max(0.0, dot(reflectedLight, normalize(hit - origin)));";

// update ray using normal and bounce according to a diffuse reflection
const newDiffuseRay =
  " ray = cosineWeightedDirection(timeSinceStart + float(bounce), normal);";

// update ray using normal according to a specular reflection
const newReflectiveRay =
  " ray = reflect(ray, normal);" +
  specularReflection +
  " specularHighlight = 2.0 * pow(specularHighlight, 20.0);";

// update ray using normal and bounce according to a glossy reflection
const newGlossyRay =
  " ray = normalize(reflect(ray, normal)) + uniformlyRandomVector(timeSinceStart + float(bounce)) * glossiness;" +
  specularReflection +
  " specularHighlight = pow(specularHighlight, 3.0);";

const yellowBlueCornellBox =
  " if(hit.x < -0.9999) surfaceColor = vec3(0.1, 0.5, 1.0);" + // blue
  " else if(hit.x > 0.9999) surfaceColor = vec3(1.0, 0.9, 0.1);"; // yellow

const redGreenCornellBox =
  " if(hit.x < -0.9999) surfaceColor = vec3(1.0, 0.3, 0.1);" + // red
  " else if(hit.x > 0.9999) surfaceColor = vec3(0.3, 1.0, 0.1);"; // green

export {
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
};
