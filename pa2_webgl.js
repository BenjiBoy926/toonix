/* 
 * Initializing GL object
 */
var gl;
function initGL(canvas) {
    try {
        gl = canvas.getContext("webgl") || 
                         canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if ( !gl ) alert("Could not initialise WebGL, sorry :-(");

    const ext = gl.getExtension('WEBGL_depth_texture');
    if (!ext) {
        return alert('need WEBGL_depth_texture');  // eslint-disable-line
    }

    gl = WebGLDebugUtils.makeDebugContext(gl, throwOnGLError, validateNoneOfTheArgsAreUndefined);
}


/*
 * Initializing object geometries
 */
var meshes, meshTransforms;
var currentMesh, currentTransform;
function initMesh() {
    // Load object meshes
    meshes = [
        new OBJ.Mesh(teapot_mesh_str),
        new OBJ.Mesh(bunny_mesh_str),
        new OBJ.Mesh(dragon_mesh_str),
        new OBJ.Mesh(plane_mesh_str)
    ];
    OBJ.initMeshBuffers(gl, meshes[0]);
    OBJ.initMeshBuffers(gl, meshes[1]);
    OBJ.initMeshBuffers(gl, meshes[2]);
    OBJ.initMeshBuffers(gl, meshes[3]);

    currentMesh = meshes[0];

    meshTransforms = [mat4.create(), mat4.create(), mat4.create(), mat4.create()];

    // Set per-object transforms to make them better fitting the viewport
    mat4.identity(meshTransforms[0]);
    mat4.rotateX(meshTransforms[0], -1.5708);
    mat4.scale(meshTransforms[0], [0.15, 0.15, 0.15]);        

    mat4.identity(meshTransforms[1]);
    mat4.translate(meshTransforms[1], [5, 0, 0]);

    mat4.identity(meshTransforms[2]);
    mat4.scale(meshTransforms[2], [0.25, 0.25, 0.25]);
    mat4.translate(meshTransforms[2], [-20, 0, 0]);
    
    mat4.identity(meshTransforms[3]);
    mat4.translate(meshTransforms[3], [0, -1, -1]);
    mat4.scale(meshTransforms[3], [1.2, 0.5, 1]);

    currentTransform = meshTransforms[0];
}


/*
 * Initializing shaders 
 */
var shaderPrograms;
var currentProgram;
var postProcessProgram;
var normalPassProgram;
var lightProgram;
var shadowProgram;
function createShader(vs_id, fs_id) {
    var shaderProg = createShaderProg(vs_id, fs_id);

    shaderProg.vertexPositionAttribute = gl.getAttribLocation(shaderProg, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProg.vertexPositionAttribute);
    shaderProg.vertexNormalAttribute = gl.getAttribLocation(shaderProg, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProg.vertexNormalAttribute);        

    shaderProg.pMatrixUniform = gl.getUniformLocation(shaderProg, "uPMatrix");
    shaderProg.mvMatrixUniform = gl.getUniformLocation(shaderProg, "uMVMatrix");
    shaderProg.nMatrixUniform = gl.getUniformLocation(shaderProg, "uNMatrix");
    shaderProg.inverseViewUniform = gl.getUniformLocation(shaderProg, "inverseViewMatrix");
    shaderProg.textureMatrixUniform = gl.getUniformLocation(shaderProg, "u_textureMatrix");
    shaderProg.lightPosUniform = gl.getUniformLocation(shaderProg, "uLightPos");
    shaderProg.lightPowerUniform = gl.getUniformLocation(shaderProg, "uLightPower");
    shaderProg.kdUniform = gl.getUniformLocation(shaderProg, "uDiffuseColor");
    shaderProg.ksUniform = gl.getUniformLocation(shaderProg, "uSpecularColor");
    shaderProg.ambientUniform = gl.getUniformLocation(shaderProg, "uAmbient");   

    return shaderProg;
}

function createPostProcessShader(vs_id, fs_id) {
    var shaderProg = createShaderProg(vs_id, fs_id);

    shaderProg.texturePositionAttribute = gl.getAttribLocation(shaderProg, "a_textcoord");
    gl.enableVertexAttribArray(shaderProg.texturePositionAttribute);
    shaderProg.vertexPositionAttribute = gl.getAttribLocation(shaderProg, "a_position");
    gl.enableVertexAttribArray(shaderProg.vertexPositionAttribute);      

    shaderProg.uResolutionUniform = gl.getUniformLocation(shaderProg, "u_resolution");
    shaderProg.uTextureUniform = gl.getUniformLocation(shaderProg, "u_texture");
    shaderProg.normImageTextureUniform = gl.getUniformLocation(shaderProg, "normalImageTexture");
    shaderProg.uTextureSizeUniform = gl.getUniformLocation(shaderProg, "u_textureSize");
    shaderProg.kdUniform = gl.getUniformLocation(shaderProg, "uDiffuseColor");
    shaderProg.ambientUniform = gl.getUniformLocation(shaderProg, "uAmbient");
    
    return shaderProg;
}

var ditherTexture;
var frameBuffers;

var useShadow = false;
function initShaders() {
    shaderPrograms = [
        createShader("shader-vs-shading", "shader-fs-toon")
    ];
    currentProgram = shaderPrograms[0];

    currentProgram.ditherTextureUniform = gl.getUniformLocation(currentProgram, "ditherTexture");
    currentProgram.dtDimUniform = gl.getUniformLocation(currentProgram, "ditherTextDim");
    currentProgram.dtCellDimUniform = gl.getUniformLocation(currentProgram, "ditherTextCellDim");
    currentProgram.numTUniform = gl.getUniformLocation(currentProgram, "numberOfTextures");
    currentProgram.uResolutionUniform = gl.getUniformLocation(currentProgram, "u_resolution");
    currentProgram.shadowMapUniform = gl.getUniformLocation(currentProgram, "shadowMap"); 
    currentProgram.useShadowUniform = gl.getUniformLocation(currentProgram, "useShadow");   

    shadowProgram = createShader("shader-vs", "shader-fs-normal");

    gl.useProgram(currentProgram);
    gl.uniform1f(currentProgram.useShadowUniform, useShadow);
    var img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = 'ditherPattern.png';

    gl.activeTexture(gl.TEXTURE2);
    ditherTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, ditherTexture);
    // Fill the texture with a 1x1 blue pixel.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                new Uint8Array([0, 0, 255, 255]));
    gl.uniform1f(currentProgram.numTUniform, 1.0);
    gl.uniform1i(currentProgram.ditherTextureUniform, 2);
    gl.uniform2fv(currentProgram.dtDimUniform, [1.0,1.0]);
    gl.uniform2fv(currentProgram.dtCellDimUniform, [1.0,1.0]);
    gl.uniform2fv(currentProgram.uResolutionUniform, [gl.viewportWidth,gl.viewportHeight]);

    img.onload = function () {
        gl.useProgram(currentProgram);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D,ditherTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,gl.UNSIGNED_BYTE, img);
        //set out of bounds accesses to clamp and set sub pixel accesses to lerp
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.uniform1i(currentProgram.ditherTextureUniform, 2);
        var numOfCells = 8.0;
        gl.uniform1f(currentProgram.numTUniform, numOfCells);
        gl.uniform2fv(currentProgram.dtDimUniform, [img.width,img.height]);
        gl.uniform2fv(currentProgram.dtCellDimUniform, [img.width/numOfCells,img.height]);
    };



    postProcessProgram = createPostProcessShader("shader-vs-post", "shader-fs-post");
    normalPassProgram = createShader("shader-vs", "shader-fs-normal");



    // Initializing light source drawing shader
    lightProgram = createShaderProg("shader-vs-light", "shader-fs-light");
    lightProgram.vertexPositionAttribute = gl.getAttribLocation(lightProgram, "aVertexPosition");
    gl.enableVertexAttribArray(lightProgram.vertexPositionAttribute);
    lightProgram.pMatrixUniform = gl.getUniformLocation(lightProgram, "uPMatrix");


    //for resolution changes reinit framebuffers, also reinit all resolution uniforms
    frameBuffers = [initFramebuffer(true,gl.viewportWidth,gl.viewportHeight,0),initFramebuffer(true,gl.viewportWidth,gl.viewportHeight,1),initDepthMapFramebuffer(gl.viewportWidth,gl.viewportHeight,3)];
}


/*
 * Initializing buffers
 */
var lightPositionBuffer;
function initBuffers() {
    lightPositionBuffer = gl.createBuffer();
}


/*
 * Main rendering code 
 */

// Basic rendering parameters
var mvMatrix = mat4.create();                   // Model-view matrix for the main object
var pMatrix = mat4.create();                    // Projection matrix
var lightView = mat4.create();

// Lighting control
var lightMatrix = mat4.create();                // Model-view matrix for the point light source
var lightPos = vec3.create();                   // Camera-space position of the light source
var lightPower = 5.0;                           // "Power" of the light source

// Common parameters for shading models
var diffuseColor = [0.2392, 0.5216, 0.7765];    // Diffuse color
var specularColor = [1.0, 1.0, 1.0];            // Specular color
var ambientIntensity = 0.7;                     // Ambient

// Animation related variables
var rotY = 0.0;                                 // object rotation
var rotY_light = 0.0;                           // light position rotation

//Set the shader variables from pMat (projection matrix) and
//    from mMat which is the model and view transforms
function setUniforms(prog,hasShadowMap,shadowmap,pMat,mMat,model) {
    gl.uniformMatrix4fv(prog.pMatrixUniform, false, pMat);
    gl.uniformMatrix4fv(prog.mvMatrixUniform, false, mMat);

    var nMatrix = mat4.transpose(mat4.inverse(mMat));
    gl.uniformMatrix4fv(prog.nMatrixUniform, false, nMatrix);

    gl.uniform3fv(prog.lightPosUniform, lightPos);
    gl.uniform1f(prog.lightPowerUniform, lightPower);
    gl.uniform3fv(prog.kdUniform, diffuseColor);
    gl.uniform3fv(prog.ksUniform, specularColor);
    gl.uniform1f(prog.ambientUniform, ambientIntensity);

    if(hasShadowMap)
    {
        gl.uniformMatrix4fv(prog.inverseViewUniform, false, model);

        var textureMatrix = mat4.create();
        mat4.identity(textureMatrix);
        textureMatrix = mat4.translate(textureMatrix, [0.5, 0.5, 0.5]);
        textureMatrix = mat4.scale(textureMatrix, [0.5, 0.5, 0.5]);
        textureMatrix = mat4.multiply(textureMatrix, pMat);
        var invLight = mat4.create();
        copy(invLight,lightView);
        textureMatrix = mat4.multiply(
            textureMatrix,
            mat4.inverse(invLight));

        gl.uniformMatrix4fv(prog.textureMatrixUniform, false, textureMatrix);


        gl.activeTexture(gl.TEXTURE3); 
        gl.bindTexture(gl.TEXTURE_2D, shadowmap);
        gl.uniform1i(prog.shadowMapUniform, 3);
    }
}


//Set the shader variables from pMat (projection matrix) and
//    from mMat which is the model and view transforms
function setShadowUniforms(prog,pMat,mMat) {
    gl.uniformMatrix4fv(prog.pMatrixUniform, false, pMat);
    gl.uniformMatrix4fv(prog.mvMatrixUniform, false, mMat);

    var nMatrix = mat4.transpose(mat4.inverse(mMat));
    gl.uniformMatrix4fv(prog.nMatrixUniform, false, nMatrix);

    gl.uniform3fv(prog.lightPosUniform, lightPos);
    gl.uniform1f(prog.lightPowerUniform, lightPower);
    gl.uniform3fv(prog.kdUniform, diffuseColor);
    gl.uniform3fv(prog.ksUniform, specularColor);
    gl.uniform1f(prog.ambientUniform, ambientIntensity);
}

function setLightPosition()
{
    mat4.identity(lightMatrix);
    mat4.rotateY(lightMatrix, rotY_light);

    //lightPos.set([0.0, 10.0, 13.0]);
    lightPos.set([0.0, 6.0, 9.0]);
    mat4.multiplyVec3(lightMatrix, lightPos); 
}

var draw_edge = true;
var draw_light = false;

function initFramebuffer(depth,width,height,num)
{
    gl.activeTexture(gl.TEXTURE0+num);
    var textOuput = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,textOuput);
    var format = gl.RGBA; var internalFormat= gl.RGBA;
    gl.texImage2D(gl.TEXTURE_2D,0,internalFormat,width,height,0,format,gl.UNSIGNED_BYTE,null);

    //set out of bounds accesses to clamp and set sub pixel accesses to lerp
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);

    //set frame buffer to first attacthment position
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,textOuput,0);


    var depthBuffer;
    if(depth)
    {
        depthBuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return [fb,textOuput];
}

function initDepthMapFramebuffer(width,height,num)
{
    gl.activeTexture(gl.TEXTURE4);
    var textOuput = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,textOuput);
    var format = gl.RGBA; var internalFormat= gl.RGBA;
    gl.texImage2D(gl.TEXTURE_2D,0,internalFormat,width,height,0,format,gl.UNSIGNED_BYTE,null);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);

    //set frame buffer to first attacthment position
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,textOuput,0);
    gl.activeTexture(gl.TEXTURE3);
    const depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texImage2D( gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT,null); 
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);        


    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return [fb,depthTexture,textOuput];
}

let xAxis;
let yAxis;
let zAxis;

//better look at then mat4
//https://github.com/greggman/twgl.js/tree/master/src
function lookAt(eye, target, up, dst) {
  dst = dst || mat4.create();

  xAxis = xAxis || vec3.create();
  yAxis = yAxis || vec3.create();
  zAxis = zAxis || vec3.create();

  vec3.normalize(
      vec3.subtract(eye, target, zAxis), zAxis);
  vec3.normalize(vec3.cross(up, zAxis, xAxis), xAxis);
  vec3.normalize(vec3.cross(zAxis, xAxis, yAxis), yAxis);

  dst[ 0] = xAxis[0];
  dst[ 1] = xAxis[1];
  dst[ 2] = xAxis[2];
  dst[ 3] = 0;
  dst[ 4] = yAxis[0];
  dst[ 5] = yAxis[1];
  dst[ 6] = yAxis[2];
  dst[ 7] = 0;
  dst[ 8] = zAxis[0];
  dst[ 9] = zAxis[1];
  dst[10] = zAxis[2];
  dst[11] = 0;
  dst[12] = eye[0];
  dst[13] = eye[1];
  dst[14] = eye[2];
  dst[15] = 1;

  return dst;
}



//Does the toon rendering of the scene to a texture so that we can post process on it
function renderLightSourceDepthMapToTexture(shaderProg,mesh,mMat,width,height,num)
{

    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffers[2][0]);

    var pMat = mat4.create(); 
    mat4.perspective(38, width/height, 0.1, 1000.0, pMat);
 
 
    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, width, height);

    // Clear the attachment(s).
    gl.clearColor(0.0, 0.0, 0.0, 1.0);   // clear to black
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT| gl.DEPTH_BUFFER_BIT);



    gl.useProgram(shaderProg);
    var look = mat4.create();
    var lookAtTarget = [0,-2,0];
    copy(lightView,lookAt(lightPos,lookAtTarget,[0,1,0],look));

    var i = 0;
    meshes.forEach(m =>{
        look = mat4.create();
        look = mat4.inverse(lookAt(lightPos,lookAtTarget,[0,1,0],look));
        var spinObject = mat4.create();
        //spinObject = mat4.identity(spinObject);
        copy(spinObject,mMat);
        mat4.multiply(look,mat4.multiply(spinObject,meshTransforms[i]));
        setShadowUniforms(shaderProg,pMat,look);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.vertexBuffer);
        gl.vertexAttribPointer(shaderProg.vertexPositionAttribute, m.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, m.normalBuffer);
        gl.vertexAttribPointer(shaderProg.vertexNormalAttribute, m.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.indexBuffer);
        gl.drawElements(gl.TRIANGLES, m.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
        i = i+1;

    })

    //gl.bindTexture(gl.TEXTURE_2D,null);

    //should I unbind texture?
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
     // render to the canvas
    //gl.useProgram(null);
    return frameBuffers[2][1];
}




//will need to be updated to allow for multiple meshes
//Does the toon rendering of the scene to a texture so that we can post process on it
function renderSceneToTexture(shaderProg,hasShadowMap,shadowmap,mMat,width,height,num)
{

    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffers[num][0]);

    var pMat = mat4.create(); 
    mat4.perspective(38, width/height, 0.1, 1000.0, pMat);
 
 
    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, width, height);

    // Clear the attachment(s).
    gl.clearColor(0.3, 0.3, 0.3, 1.0);   // clear to black
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT| gl.DEPTH_BUFFER_BIT);


    gl.useProgram(shaderProg);
  
    var i = 0;
    meshes.forEach(m =>{
        var cpy = mat4.create();
        copy(cpy,mMat) ;
        mat4.multiply(cpy, meshTransforms[i]);
        setUniforms(shaderProg,hasShadowMap,shadowmap,pMat,cpy,meshTransforms[i]);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.vertexBuffer);
        gl.vertexAttribPointer(shaderProg.vertexPositionAttribute, m.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, m.normalBuffer);
        gl.vertexAttribPointer(shaderProg.vertexNormalAttribute, m.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.indexBuffer);
        gl.drawElements(gl.TRIANGLES, m.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
        i = i+1;

    })

    if ( draw_light && num != 1) {
        gl.useProgram(lightProgram);
        gl.uniformMatrix4fv(lightProgram.pMatrixUniform, false, pMat);

        gl.bindBuffer(gl.ARRAY_BUFFER, lightPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(lightPos), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(lightProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.POINTS, 0, 1);
    }
    //gl.bindTexture(gl.TEXTURE_2D,null);

    //should I unbind texture?
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
     // render to the canvas
    //gl.useProgram(null);
    return frameBuffers[num][1];
}

//mat4.copy was giving me errors, so I just copied the source code in here lol
function copy(out, a)
{
    out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  out[4] = a[4];
  out[5] = a[5];
  out[6] = a[6];
  out[7] = a[7];
  out[8] = a[8];
  out[9] = a[9];
  out[10] = a[10];
  out[11] = a[11];
  out[12] = a[12];
  out[13] = a[13];
  out[14] = a[14];
  out[15] = a[15];
}

//Set the shader variables from pMat (projection matrix) and
//    from mMat which is the model and view transforms
function setPostprocessingUniforms(prog,texture,normalTexture, width, height) {
    gl.activeTexture(gl.TEXTURE0); 
    gl.bindTexture(gl.TEXTURE_2D, texture); 
    gl.uniform1i(prog.uTextureUniform, 0);

    gl.activeTexture(gl.TEXTURE1); 
    gl.bindTexture(gl.TEXTURE_2D, normalTexture);
    gl.uniform1i(prog.normImageTextureUniform, 1);

    gl.uniform2fv(prog.uTextureSizeUniform, [width,height]);
    gl.uniform2fv(prog.uResolutionUniform, [width,height]);

    gl.uniform3fv(prog.kdUniform, diffuseColor);
    gl.uniform1f(prog.ambientUniform, ambientIntensity);
}

function setRectangle(gl, x, y, width, height) {
  var x1 = x;
  var x2 = x + width;
  var y1 = y;
  var y2 = y + height;
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
     x1, y1,
     x2, y1,
     x1, y2,
     x1, y2,
     x2, y1,
     x2, y2,
  ]), gl.STATIC_DRAW);
}

function drawScene() {

    mat4.identity(mvMatrix);
    mat4.translate(mvMatrix, [0.0, -1.0, -7.0]);
    mat4.rotateX(mvMatrix, 0.3);
    mat4.rotateY(mvMatrix, rotY);
    mat4.scale(mvMatrix, [0.5, 0.5, 0.5]);

    var cpy = mat4.create();
    var cpy2 = mat4.create();
    copy(cpy,mvMatrix);
    copy(cpy2,mvMatrix);

    setLightPosition();
    //consumes cpy matrix
    //actual shader but writes to a texture
    var shadowMap = renderLightSourceDepthMapToTexture(shadowProgram,currentMesh,cpy2,gl.viewportWidth,gl.viewportHeight,3)
    var sceneAsTexture =  renderSceneToTexture(currentProgram,true,shadowMap,cpy,gl.viewportWidth,gl.viewportHeight,0);
    var normalsAsTexture =  renderSceneToTexture(normalPassProgram,false,shadowMap,mvMatrix,gl.viewportWidth,gl.viewportHeight,1);


    // Create a buffer to put three 2d clip space points in
    var positionBuffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // Set a rectangle the same size as the image.
    setRectangle(gl, 0, 0, gl.viewportWidth, gl.viewportHeight);
        //screen is just 2 triangles, so we will post process on that
    var texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);

    //bug is probably here and in set rectangle
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0.0,  0.0,
      1.0,  0.0,
      0.0,  1.0,
      0.0,  1.0,
      1.0,  0.0,
      1.0,  1.0,
    ]), gl.STATIC_DRAW);


    //Post-process shader
    gl.useProgram(postProcessProgram);
    setPostprocessingUniforms(postProcessProgram,sceneAsTexture,normalsAsTexture, gl.viewportWidth, gl.viewportHeight);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
      postProcessProgram.vertexPositionAttribute, size, type, normalize, stride, offset);


    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.vertexAttribPointer(
      postProcessProgram.texturePositionAttribute, size, type, normalize, stride, offset);


    // Draw the rectangle.
    var count = 6;
    gl.drawArrays(gl.TRIANGLES, offset, count);

    //gl.deleteTexture(sceneAsTexture);
    //gl.deleteTexture(normalsAsTexture);

}

var lastTime = 0;
var rotSpeed = 60, rotSpeed_light = 60;
var animated = false, animated_light = false;
function tick() {
    requestAnimationFrame(tick);

    var timeNow = new Date().getTime();
    if ( lastTime != 0 ) {
      var elapsed = timeNow - lastTime;
      if ( animated )
        rotY += rotSpeed*0.0175*elapsed/1000.0;
      if ( animated_light )
        rotY_light += rotSpeed_light*0.0175*elapsed/1000.0;
    }
    lastTime = timeNow;        

    drawScene();
}

function webGLStart() {
    var canvas = $("#canvas0")[0];
    canvas.addEventListener("webglcontextlost", function(event) {
            event.preventDefault();
    }, false);
    canvas.addEventListener(
        "webglcontextrestored", setupWebGLStateAndResources, false);
    initGL(canvas);
    initMesh();
    initShaders();
    initBuffers();

    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.enable(gl.DEPTH_TEST);

    tick();
}

function setupWebGLStateAndResources()
{
    var canvas = $("#canvas0")[0];

    console.log("Context restored!");
    initGL(canvas);
    initMesh();
    initShaders();
    initBuffers();

    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.enable(gl.DEPTH_TEST);

    tick();
}
