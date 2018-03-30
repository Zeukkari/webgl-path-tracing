import Vector from "./Vector";

var light = new Vector([0.4, 0.5, -0.6]);

// constants for the shaders
const bounces = "5";
const lightSize = 0.1;
const lightVal = 0.5;
const epsilon = "0.0001";
const infinity = "10000.0";

export default class Light {
  constructor() {
    this.temporaryTranslation = new Vector([0, 0, 0]);
  }

  getGlobalCode() {
    return "uniform vec3 light;";
  }

  getIntersectCode() {
    return "";
  }

  getShadowTestCode() {
    return "";
  }

  getMinimumIntersectCode() {
    return "";
  }

  getNormalCalculationCode() {
    return "";
  }

  setUniforms(renderer) {
    renderer.uniforms.light = light.add(this.temporaryTranslation);
  }

  clampPosition(position) {
    for (var i = 0; i < position.elements.length; i++) {
      position.elements[i] = Math.max(
        lightSize - 1,
        Math.min(1 - lightSize, position.elements[i])
      );
    }
  }

  temporaryTranslate(translation) {
    var tempLight = light.add(translation);
    Light.clampPosition(tempLight);
    this.temporaryTranslation = tempLight.subtract(light);
  }

  translate(translation) {
    light = light.add(translation);
    Light.clampPosition(light);
  }

  getMinCorner() {
    return light
      .add(this.temporaryTranslation)
      .subtract(new Vector([lightSize, lightSize, lightSize]));
  }

  getMaxCorner() {
    return light
      .add(this.temporaryTranslation)
      .add(new Vector([lightSize, lightSize, lightSize]));
  }

  intersect(origin, ray) {
    return Number.MAX_VALUE;
  }
}
