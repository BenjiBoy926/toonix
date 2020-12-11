/* 
 * Initializing GL object
 */
var gl;
function initGL(canvas) {
    try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if ( !gl ) alert("Could not initialise WebGL, sorry :-(");

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
        new OBJ.Mesh(dragon_mesh_str)
    ];
    OBJ.initMeshBuffers(gl, meshes[0]);
    OBJ.initMeshBuffers(gl, meshes[1]);
    OBJ.initMeshBuffers(gl, meshes[2]);

    currentMesh = meshes[0];

    meshTransforms = [mat4.create(), mat4.create(), mat4.create()];

    // Set per-object transforms to make them better fitting the viewport
    mat4.identity(meshTransforms[0]);
    mat4.rotateX(meshTransforms[0], -1.5708);
    mat4.scale(meshTransforms[0], [0.15, 0.15, 0.15]);        

    mat4.identity(meshTransforms[1]);
    mat4.translate(meshTransforms[1], [0.5, 0, 0]);

    mat4.identity(meshTransforms[2]);
    mat4.scale(meshTransforms[2], [0.25, 0.25, 0.25]);   

    currentTransform = meshTransforms[0];
}


/*
 * Initializing shaders 
 */
var shaderPrograms;
var currentProgram;
var edgeProgram;
var lightProgram;
function createShader(vs_id, fs_id) {
    var shaderProg = createShaderProg(vs_id, fs_id);

    shaderProg.vertexPositionAttribute = gl.getAttribLocation(shaderProg, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProg.vertexPositionAttribute);
    shaderProg.vertexNormalAttribute = gl.getAttribLocation(shaderProg, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProg.vertexNormalAttribute);        

    shaderProg.pMatrixUniform = gl.getUniformLocation(shaderProg, "uPMatrix");
    shaderProg.mvMatrixUniform = gl.getUniformLocation(shaderProg, "uMVMatrix");
    shaderProg.nMatrixUniform = gl.getUniformLocation(shaderProg, "uNMatrix");
    shaderProg.lightPosUniform = gl.getUniformLocation(shaderProg, "uLightPos");
    shaderProg.lightPowerUniform = gl.getUniformLocation(shaderProg, "uLightPower");
    shaderProg.kdUniform = gl.getUniformLocation(shaderProg, "uDiffuseColor");
    shaderProg.ksUniform = gl.getUniformLocation(shaderProg, "uSpecularColor");
    shaderProg.ambientUniform = gl.getUniformLocation(shaderProg, "uAmbient");    

    return shaderProg;
}


function initShaders() {
    shaderPrograms = [
        createShader("shader-vs", "shader-fs-toon")
    ];
    currentProgram = shaderPrograms[0];

    //
    // Declaring shading model specific uniform variables
    //

    // Phong shading
    // shaderPrograms[5].exponentUniform = gl.getUniformLocation(shaderPrograms[5], "uExponent");
    // gl.useProgram(shaderPrograms[5]);
    // gl.uniform1f(shaderPrograms[5].exponentUniform, 50.0);    

    // // Blinn-Phong shading
    // shaderPrograms[6].exponentUniform = gl.getUniformLocation(shaderPrograms[6], "uExponent");
    // gl.useProgram(shaderPrograms[6]);
    // gl.uniform1f(shaderPrograms[6].exponentUniform, 50.0);

    // // Microfacet shading
    // shaderPrograms[7].iorUniform = gl.getUniformLocation(shaderPrograms[7], "uIOR");
    // shaderPrograms[7].betaUniform = gl.getUniformLocation(shaderPrograms[7], "uBeta");
    // gl.useProgram(shaderPrograms[7]);
    // gl.uniform1f(shaderPrograms[7].iorUniform, 5.0);
    // gl.uniform1f(shaderPrograms[7].betaUniform, 0.2);

    edgeProgram = createShader("shader-vs", "shader-fs-edge-detect");

    // Initializing light source drawing shader
    lightProgram = createShaderProg("shader-vs-light", "shader-fs-light");
    lightProgram.vertexPositionAttribute = gl.getAttribLocation(lightProgram, "aVertexPosition");
    gl.enableVertexAttribArray(lightProgram.vertexPositionAttribute);
    lightProgram.pMatrixUniform = gl.getUniformLocation(lightProgram, "uPMatrix");
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

// Lighting control
var lightMatrix = mat4.create();                // Model-view matrix for the point light source
var lightPos = vec3.create();                   // Camera-space position of the light source
var lightPower = 5.0;                           // "Power" of the light source

// Common parameters for shading models
var diffuseColor = [0.2392, 0.5216, 0.7765];    // Diffuse color
var specularColor = [1.0, 1.0, 1.0];            // Specular color
var ambientIntensity = 0.1;                     // Ambient

// Animation related variables
var rotY = 0.0;                                 // object rotation
var rotY_light = 0.0;                           // light position rotation

//Set the shader variables from pMat (projection matrix) and
//    from mMat which is the model and view transforms
function setUniforms(prog,pMat,mMat) {
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
    mat4.translate(lightMatrix, [0.0, -1.0, -7.0]);
    mat4.rotateX(lightMatrix, 0.3);
    mat4.rotateY(lightMatrix, rotY_light);

    lightPos.set([0.0, 2.5, 3.0]);
    mat4.multiplyVec3(lightMatrix, lightPos); 
}

var draw_edge = true;
var draw_light = false;


//will need to be updated to allow for multiple meshes
function renderSceneToTexture(shaderProg,mesh,color,mMat,width,height)
{
    var textOuput = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,textOuput);
    var format; var internalFormat;
    if(color)
    {
        internalFormat= gl.RGBA;
        format = gl.RGBA;
    }
    else
    {
        internalFormat= gl.LUMINANCE_ALPHA;
        format = gl.LUMINANCE_ALPHA;
    }
    gl.texImage2D(gl.TEXTURE_2D,0,internalFormat,width,height,0,format,gl.UNSIGNED_BYTE,null);

    //set out of bounds accesses to clamp and set sub pixel accesses to lerp
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);

    //set frame buffer to first attacthment position
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D,textOuput,0);

    var pMat = mat4.create(); 
    mat4.perspective(35, width/height, 0.1, 1000.0, pMat);
 
 
    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, width, height);

    // Clear the attachment(s).
    gl.clearColor(0, 0, 1, 1);   // clear to blue
    gl.clear(gl.COLOR_BUFFER_BIT| gl.DEPTH_BUFFER_BIT);

    gl.useProgram(shaderProg);
    setUniforms(shaderProg,pMat,mMat);
  

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertexBuffer);
    gl.vertexAttribPointer(shaderProg.vertexPositionAttribute, mesh.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
    gl.vertexAttribPointer(shaderProg.vertexNormalAttribute, mesh.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
    gl.drawElements(gl.TRIANGLES, mesh.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

    //should I unbind texture?
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
     // render to the canvas
    //gl.useProgram(null);

    return textOuput;
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

function drawScene() {

    mat4.identity(mvMatrix);
    mat4.translate(mvMatrix, [0.0, -1.0, -7.0]);
    mat4.rotateX(mvMatrix, 0.3);
    mat4.rotateY(mvMatrix, rotY);
    mat4.multiply(mvMatrix, currentTransform);
    var cpy = mat4.create();
    copy(cpy,mvMatrix);

    //consumes cpy matrix
    var normSceneMap =  renderSceneToTexture(edgeProgram,currentMesh,true,cpy,gl.viewportWidth,gl.viewportHeight);
    gl.deleteTexture(normSceneMap);
    gl.bindTexture(gl.TEXTURE_2D,null);

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    mat4.perspective(35, gl.viewportWidth/gl.viewportHeight, 0.1, 1000.0, pMatrix);

    setLightPosition();

    gl.useProgram(currentProgram);
    setUniforms(currentProgram,pMatrix,mvMatrix);  

    gl.bindBuffer(gl.ARRAY_BUFFER, currentMesh.vertexBuffer);
    gl.vertexAttribPointer(currentProgram.vertexPositionAttribute, currentMesh.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, currentMesh.normalBuffer);
    gl.vertexAttribPointer(currentProgram.vertexNormalAttribute, currentMesh.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, currentMesh.indexBuffer);
    gl.drawElements(gl.TRIANGLES, currentMesh.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);



    if ( draw_light ) {
        gl.useProgram(lightProgram);
        gl.uniformMatrix4fv(lightProgram.pMatrixUniform, false, pMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, lightPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(lightPos), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(lightProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.POINTS, 0, 1);
    }
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

    initGL(canvas);
    initMesh();
    initShaders();
    initBuffers();

    gl.clearColor(0.3, 0.3, 0.3, 1.0);
    gl.enable(gl.DEPTH_TEST);

    tick();
}
