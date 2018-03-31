import Vector from "./Vector";
import Matrix from "./Matrix";
import PathTracer from "./PathTracer";

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
  redGreenCornellBox
} from "./shaders";

export default class Renderer {
  constructor(state) {
    this.state = state;
    state.renderer = this;

    const vertices = [
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      1,
      0,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1
    ];
    const indices = [
      0,
      1,
      1,
      3,
      3,
      2,
      2,
      0,
      4,
      5,
      5,
      7,
      7,
      6,
      6,
      4,
      0,
      4,
      1,
      5,
      2,
      6,
      3,
      7
    ];

    // create vertex buffer
    this.state.vertexBuffer = this.state.gl.createBuffer();
    this.state.gl.bindBuffer(
      this.state.gl.ARRAY_BUFFER,
      this.state.vertexBuffer
    );
    this.state.gl.bufferData(
      this.state.gl.ARRAY_BUFFER,
      new Float32Array(vertices),
      this.state.gl.STATIC_DRAW
    );

    // create index buffer
    this.state.indexBuffer = this.state.gl.createBuffer();
    this.state.gl.bindBuffer(
      this.state.gl.ELEMENT_ARRAY_BUFFER,
      this.state.indexBuffer
    );
    this.state.gl.bufferData(
      this.state.gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      this.state.gl.STATIC_DRAW
    );

    // create line shader
    this.state.lineProgram = this.compileShader(
      lineVertexSource,
      lineFragmentSource,
      this.state.gl
    );
    this.state.vertexAttribute = this.state.gl.getAttribLocation(
      this.state.lineProgram,
      "vertex"
    );
    this.state.gl.enableVertexAttribArray(this.state.vertexAttribute);

    this.state.objects = [];
    this.state.selectedObject = null;
    this.state.pathTracer = new PathTracer(state);
  }

  static getEyeRay(matrix, x, y, eye) {
    if (!matrix) return;
    return matrix
      .multiply(new Vector([x, y, 0, 1]))
      .divideByW()
      .ensure3()
      .subtract(eye);
  }

  setUniforms(program, uniforms) {
    for (var name in uniforms) {
      var value = uniforms[name];
      var location = this.state.gl.getUniformLocation(program, name);
      if (location == null) continue;
      if (value instanceof Vector) {
        this.state.gl.uniform3fv(
          location,
          new Float32Array([
            value.elements[0],
            value.elements[1],
            value.elements[2]
          ])
        );
      } else if (value instanceof Matrix) {
        this.state.gl.uniformMatrix4fv(
          location,
          false,
          new Float32Array(value.flatten())
        );
      } else {
        this.state.gl.uniform1f(location, value);
      }
    }
  }

  compileSource(source, type) {
    var shader = this.state.gl.createShader(type);
    this.state.gl.shaderSource(shader, source);
    this.state.gl.compileShader(shader);
    if (
      !this.state.gl.getShaderParameter(shader, this.state.gl.COMPILE_STATUS)
    ) {
      throw "compile error: " + this.state.gl.getShaderInfoLog(shader);
    }
    return shader;
  }

  compileShader(vertexSource, fragmentSource) {
    var shaderProgram = this.state.gl.createProgram();
    this.state.gl.attachShader(
      shaderProgram,
      this.compileSource(vertexSource, this.state.gl.VERTEX_SHADER)
    );
    this.state.gl.attachShader(
      shaderProgram,
      this.compileSource(fragmentSource, this.state.gl.FRAGMENT_SHADER)
    );
    this.state.gl.linkProgram(shaderProgram);
    if (
      !this.state.gl.getProgramParameter(
        shaderProgram,
        this.state.gl.LINK_STATUS
      )
    ) {
      throw "link error: " + this.state.gl.getProgramInfoLog(shaderProgram);
    }
    return shaderProgram;
  }

  setObjects(objects) {
    this.state.objects = objects;
    this.state.selectedObject = null;
    this.state.pathTracer.setObjects(objects);
  }

  update(modelviewProjection, timeSinceStart) {
    if (!modelviewProjection) {
      throw "Error: modelviewProjection missing";
      return;
    }
    const jitter = Matrix.Translation(
      new Vector([Math.random() * 2 - 1, Math.random() * 2 - 1, 0]).multiply(
        1 / 512
      )
    );
    const inverse = jitter.multiply(modelviewProjection).inverse();
    this.state.modelviewProjection = modelviewProjection;
    this.state.pathTracer.update(inverse, timeSinceStart);
  }

  render() {
    this.state.pathTracer.render();

    if (this.state.selectedObject != null) {
      this.state.gl.useProgram(this.state.lineProgram);
      this.state.gl.bindTexture(this.state.gl.TEXTURE_2D, null);
      this.state.gl.bindBuffer(
        this.state.gl.ARRAY_BUFFER,
        this.state.vertexBuffer
      );
      this.state.gl.bindBuffer(
        this.state.gl.ELEMENT_ARRAY_BUFFER,
        this.state.indexBuffer
      );
      this.state.gl.vertexAttribPointer(
        this.state.vertexAttribute,
        3,
        this.state.gl.FLOAT,
        false,
        0,
        0
      );
      this.setUniforms(this.state.lineProgram, {
        cubeMin: this.state.selectedObject.getMinCorner(),
        cubeMax: this.state.selectedObject.getMaxCorner(),
        modelviewProjection: this.state.modelviewProjection
      });
      this.state.gl.drawElements(
        this.state.gl.LINES,
        24,
        this.state.gl.UNSIGNED_SHORT,
        0
      );
    }
  }
}
