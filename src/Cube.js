import Vector from "./Vector";

console.log("Vector: ", Vector);

export default class Cube {
  constructor(minCorner, maxCorner, id) {
    this.minCorner = minCorner;
    this.maxCorner = maxCorner;
    this.minStr = "cubeMin" + id;
    this.maxStr = "cubeMax" + id;
    this.intersectStr = "tCube" + id;
    this.temporaryTranslation = new Vector([0, 0, 0]);
  }

  getGlobalCode() {
    return (
      "" +
      " uniform vec3 " +
      this.minStr +
      ";" +
      " uniform vec3 " +
      this.maxStr +
      ";"
    );
  }

  getIntersectCode() {
    return (
      "" +
      " vec2 " +
      this.intersectStr +
      " = intersectCube(origin, ray, " +
      this.minStr +
      ", " +
      this.maxStr +
      ");"
    );
  }

  getShadowTestCode() {
    return (
      "" +
      this.getIntersectCode() +
      " if(" +
      this.intersectStr +
      ".x > 0.0 && " +
      this.intersectStr +
      ".x < 1.0 && " +
      this.intersectStr +
      ".x < " +
      this.intersectStr +
      ".y) return 0.0;"
    );
  }

  getMinimumIntersectCode() {
    return (
      "" +
      " if(" +
      this.intersectStr +
      ".x > 0.0 && " +
      this.intersectStr +
      ".x < " +
      this.intersectStr +
      ".y && " +
      this.intersectStr +
      ".x < t) t = " +
      this.intersectStr +
      ".x;"
    );
  }

  getNormalCalculationCode() {
    return (
      "" +
      // have to compare intersectStr.x < intersectStr.y otherwise two coplanar
      // cubes will look wrong (one cube will "steal" the hit from the other)
      " else if(t == " +
      this.intersectStr +
      ".x && " +
      this.intersectStr +
      ".x < " +
      this.intersectStr +
      ".y) normal = normalForCube(hit, " +
      this.minStr +
      ", " +
      this.maxStr +
      ");"
    );
  }

  setUniforms(renderer) {
    renderer.uniforms[this.minStr] = this.getMinCorner();
    renderer.uniforms[this.maxStr] = this.getMaxCorner();
  }

  temporaryTranslate(translation) {
    this.temporaryTranslation = translation;
  }

  translate(translation) {
    this.minCorner = this.minCorner.add(translation);
    this.maxCorner = this.maxCorner.add(translation);
  }

  getMinCorner() {
    return this.minCorner.add(this.temporaryTranslation);
  }

  getMaxCorner() {
    return this.maxCorner.add(this.temporaryTranslation);
  }

  intersect(origin, ray) {
    return this.intersectCube(
      origin,
      ray,
      this.getMinCorner(),
      this.getMaxCorner()
    );
  }

  intersectCube(origin, ray, cubeMin, cubeMax) {
    var tMin = cubeMin.subtract(origin).componentDivide(ray);
    var tMax = cubeMax.subtract(origin).componentDivide(ray);
    console.log("tMin, tMax: ", tMin, tMax);
    var t1 = Vector.min(tMin, tMax);
    var t2 = Vector.max(tMin, tMax);
    var tNear = t1.maxComponent();
    var tFar = t2.minComponent();
    if (tNear > 0 && tNear < tFar) {
      return tNear;
    }
    return Number.MAX_VALUE;
  }
}
