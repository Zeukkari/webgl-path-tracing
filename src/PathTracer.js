import Vector from "./Vector";
import Matrix from "./Matrix";
import Renderer from "./Renderer";

import { makeTracerFragmentSource } from "./index";

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

export default class PathTracer {
  constructor(state) {
    this.state = state;

    var vertices = [-1, -1, -1, +1, +1, -1, +1, +1];

    // create vertex buffer
    this.vertexBuffer = this.state.gl.createBuffer();
    this.state.gl.bindBuffer(this.state.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.state.gl.bufferData(
      this.state.gl.ARRAY_BUFFER,
      new Float32Array(vertices),
      this.state.gl.STATIC_DRAW
    );

    // create framebuffer
    this.state.framebuffer = this.state.gl.createFramebuffer();

    // create textures
    var type = this.state.gl.getExtension("OES_texture_float")
      ? this.state.gl.FLOAT
      : this.state.gl.UNSIGNED_BYTE;
    this.state.textures = [];
    for (var i = 0; i < 2; i++) {
      this.state.textures.push(this.state.gl.createTexture());
      this.state.gl.bindTexture(
        this.state.gl.TEXTURE_2D,
        this.state.textures[i]
      );
      this.state.gl.texParameteri(
        this.state.gl.TEXTURE_2D,
        this.state.gl.TEXTURE_MAG_FILTER,
        this.state.gl.NEAREST
      );
      this.state.gl.texParameteri(
        this.state.gl.TEXTURE_2D,
        this.state.gl.TEXTURE_MIN_FILTER,
        this.state.gl.NEAREST
      );
      this.state.gl.texImage2D(
        this.state.gl.TEXTURE_2D,
        0,
        this.state.gl.RGB,
        512,
        512,
        0,
        this.state.gl.RGB,
        type,
        null
      );
    }
    this.state.gl.bindTexture(this.state.gl.TEXTURE_2D, null);

    // create render shader
    this.state.renderProgram = this.state.renderer.compileShader(
      renderVertexSource,
      renderFragmentSource,
      this.state.gl
    );
    this.state.renderVertexAttribute = this.state.gl.getAttribLocation(
      this.state.renderProgram,
      "vertex"
    );
    this.state.gl.enableVertexAttribArray(this.state.renderVertexAttribute);

    // objects and shader will be filled in when setObjects() is called
    this.state.objects = [];
    this.state.sampleCount = 0;
    this.state.tracerProgram = null;
  }

  setObjects(objects) {
    this.state.uniforms = {};
    this.state.sampleCount = 0;
    this.state.objects = objects;

    // create tracer shader
    if (this.state.tracerProgram != null) {
      this.state.gl.deleteProgram(this.shaderProgram);
    }
    this.state.tracerProgram = this.state.renderer.compileShader(
      tracerVertexSource,
      makeTracerFragmentSource(objects),
      this.state.gl
    );
    this.state.tracerVertexAttribute = this.state.gl.getAttribLocation(
      this.state.tracerProgram,
      "vertex"
    );
    this.state.gl.enableVertexAttribArray(this.state.tracerVertexAttribute);
  }

  update(matrix, timeSinceStart) {
    if (!matrix) return;

    // calculate uniforms
    for (var i = 0; i < this.state.objects.length; i++) {
      this.state.objects[i].setUniforms(this.state);
    }
    this.state.uniforms.eye = this.state.eye;
    this.state.uniforms.glossiness = this.state.glossiness;

    this.state.uniforms.ray00 = Renderer.getEyeRay(
      matrix,
      -1,
      -1,
      this.state.eye
    );
    this.state.uniforms.ray01 = Renderer.getEyeRay(
      matrix,
      -1,
      +1,
      this.state.eye
    );
    this.state.uniforms.ray10 = Renderer.getEyeRay(
      matrix,
      +1,
      -1,
      this.state.eye
    );
    this.state.uniforms.ray11 = Renderer.getEyeRay(
      matrix,
      +1,
      +1,
      this.state.eye
    );

    this.state.uniforms.timeSinceStart = timeSinceStart;
    this.state.uniforms.textureWeight =
      this.state.sampleCount / (this.state.sampleCount + 1);

    // set uniforms
    this.state.gl.useProgram(this.state.tracerProgram);
    this.state.renderer.setUniforms(
      this.state.tracerProgram,
      this.state.uniforms
    );

    // render to texture
    this.state.gl.useProgram(this.state.tracerProgram);
    this.state.gl.bindTexture(this.state.gl.TEXTURE_2D, this.state.textures[0]);
    this.state.gl.bindBuffer(this.state.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.state.gl.bindFramebuffer(
      this.state.gl.FRAMEBUFFER,
      this.state.framebuffer
    );
    this.state.gl.framebufferTexture2D(
      this.state.gl.FRAMEBUFFER,
      this.state.gl.COLOR_ATTACHMENT0,
      this.state.gl.TEXTURE_2D,
      this.state.textures[1],
      0
    );
    this.state.gl.vertexAttribPointer(
      this.state.tracerVertexAttribute,
      2,
      this.state.gl.FLOAT,
      false,
      0,
      0
    );
    this.state.gl.drawArrays(this.state.gl.TRIANGLE_STRIP, 0, 4);
    this.state.gl.bindFramebuffer(this.state.gl.FRAMEBUFFER, null);

    // ping pong textures
    this.state.textures.reverse();
    this.state.sampleCount++;
  }

  render() {
    this.state.gl.useProgram(this.state.renderProgram);
    this.state.gl.bindTexture(this.state.gl.TEXTURE_2D, this.state.textures[0]);
    this.state.gl.bindBuffer(this.state.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.state.gl.vertexAttribPointer(
      this.state.renderVertexAttribute,
      2,
      this.state.gl.FLOAT,
      false,
      0,
      0
    );
    this.state.gl.drawArrays(this.state.gl.TRIANGLE_STRIP, 0, 4);
  }
}
