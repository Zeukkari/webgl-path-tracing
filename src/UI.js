import Vector from "./Vector";
import Matrix from "./Matrix";
import Cube from "./Cube";
import Sphere from "./Sphere";
import Renderer from "./Renderer";
import Light from "./Light";
import { makeLookAt, makePerspective } from "./glUtils";
import config from "./config";

const MATERIAL_DIFFUSE = 0;
const MATERIAL_MIRROR = 1;
const MATERIAL_GLOSSY = 2;
let material = MATERIAL_DIFFUSE;

const YELLOW_BLUE_CORNELL_BOX = 0;
const RED_GREEN_CORNELL_BOX = 1;
let environment = YELLOW_BLUE_CORNELL_BOX;

var angleX = 0;
var angleY = 0;
var zoomZ = 2.5;

export default class UI {
  constructor(state) {
    state.renderer = new Renderer(state);
    // this.state.renderer = new Renderer(state);
    this.state = state;
  }

  setObjects(objects) {
    //this.state.objects = objects;
    objects.splice(0, 0, new Light(this.state));
    this.state.renderer.setObjects(objects);
  }

  update(timeSinceStart) {
    this.state.modelview = makeLookAt(
      this.state.eye.elements[0],
      this.state.eye.elements[1],
      this.state.eye.elements[2],
      0,
      0,
      0,
      0,
      1,
      0
    );
    this.state.projection = makePerspective(55, 1, 0.1, 100);
    this.state.modelviewProjection = this.state.projection.multiply(
      this.state.modelview
    );

    this.state.renderer.update(this.state.modelviewProjection, timeSinceStart);
  }

  mouseDown(x, y) {
    var t;
    var origin = this.state.eye;
    var ray = Renderer.getEyeRay(
      this.state.modelviewProjection.inverse(),
      x / config.resolution * 2 - 1,
      1 - y / config.resolution * 2,
      origin
    );

    // test the selection box first
    if (this.state.selectedObject != null) {
      var selectedObject = this.state.selectedObject;
      var minBounds = selectedObject.getMinCorner();
      var maxBounds = selectedObject.getMaxCorner();

      if (selectedObject.intersect) {
        t = selectedObject.intersect(origin, ray, minBounds, maxBounds);
      } else {
        t = 0;
      }

      if (t < Number.MAX_VALUE) {
        var hit = origin.add(ray.multiply(t));

        if (Math.abs(hit.elements[0] - minBounds.elements[0]) < 0.001)
          this.movementNormal = new Vector([-1, 0, 0]);
        else if (Math.abs(hit.elements[0] - maxBounds.elements[0]) < 0.001)
          this.movementNormal = new Vector([+1, 0, 0]);
        else if (Math.abs(hit.elements[1] - minBounds.elements[1]) < 0.001)
          this.movementNormal = new Vector([0, -1, 0]);
        else if (Math.abs(hit.elements[1] - maxBounds.elements[1]) < 0.001)
          this.movementNormal = new Vector([0, +1, 0]);
        else if (Math.abs(hit.elements[2] - minBounds.elements[2]) < 0.001)
          this.movementNormal = new Vector([0, 0, -1]);
        else this.movementNormal = new Vector([0, 0, +1]);

        this.movementDistance = this.movementNormal.dot(hit);
        this.originalHit = hit;
        this.moving = true;

        return true;
      }
    }

    t = Number.MAX_VALUE;
    this.state.selectedObject = null;

    for (var i = 0; i < this.state.objects.length; i++) {
      var objectT = this.state.objects[i].intersect(origin, ray);
      if (objectT < t) {
        t = objectT;
        this.state.selectedObject = this.state.objects[i];
      }
    }

    return t < Number.MAX_VALUE;
  }

  mouseMove(x, y) {
    if (this.moving) {
      var origin = this.state.eye;
      var ray = Renderer.getEyeRay(
        this.state.modelviewProjection.inverse(),
        x / config.resolution * 2 - 1,
        1 - y / config.resolution * 2,
        origin
      );

      var t =
        (this.movementDistance - this.movementNormal.dot(origin)) /
        this.movementNormal.dot(ray);
      var hit = origin.add(ray.multiply(t));
      this.state.selectedObject.temporaryTranslate(
        hit.subtract(this.originalHit)
      );

      // clear the sample buffer
      this.state.sampleCount = 0;
    }
  }

  mouseUp(x, y) {
    if (this.moving) {
      var origin = this.state.eye;
      var ray = Renderer.getEyeRay(
        this.state.modelviewProjection.inverse(),
        x / config.resolution * 2 - 1,
        1 - y / config.resolution * 2,
        origin
      );

      var t =
        (this.movementDistance - this.movementNormal.dot(origin)) /
        this.movementNormal.dot(ray);
      var hit = origin.add(ray.multiply(t));
      this.state.selectedObject.temporaryTranslate(new Vector([0, 0, 0]));
      this.state.selectedObject.translate(hit.subtract(this.originalHit));
      this.moving = false;
    }
  }

  render() {
    this.state.renderer.render();
  }

  selectLight() {
    this.state.selectedObject = this.state.objects[0];
  }

  addSphere() {
    this.state.objects.push(
      new Sphere(new Vector([0, 0, 0]), 0.25, this.state.nextObjectId++)
    );
    this.state.renderer.setObjects(this.state.objects);
  }

  addCube() {
    this.state.objects.push(
      new Cube(
        new Vector([-0.25, -0.25, -0.25]),
        new Vector([0.25, 0.25, 0.25]),
        this.state.nextObjectId++
      )
    );
    this.state.renderer.setObjects(this.state.objects);
  }

  deleteSelection() {
    for (var i = 0; i < this.state.objects.length; i++) {
      if (this.state.selectedObject == this.state.objects[i]) {
        this.state.objects.splice(i, 1);
        this.state.selectedObject = null;
        this.state.renderer.setObjects(this.state.objects);
        break;
      }
    }
  }

  updateMaterial() {
    var newMaterial = parseInt(document.getElementById("material").value, 10);
    if (this.state.material != newMaterial) {
      this.state.material = newMaterial;
      this.state.renderer.setObjects(this.state.objects);
    }
  }

  updateEnvironment() {
    var newEnvironment = parseInt(
      document.getElementById("environment").value,
      10
    );
    if (this.state.environment != newEnvironment) {
      this.state.environment = newEnvironment;
      this.state.renderer.setObjects(this.state.objects);
    }
  }

  updateGlossiness() {
    var newGlossiness = parseFloat(document.getElementById("glossiness").value);
    if (isNaN(newGlossiness)) newGlossiness = 0;
    newGlossiness = Math.max(0, Math.min(1, newGlossiness));
    if (
      this.state.material == MATERIAL_GLOSSY &&
      this.state.glossiness != newGlossiness
    ) {
      this.state.sampleCount = 0;
    }
    this.state.glossiness = newGlossiness;
  }
}
