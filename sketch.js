let city;

let dofLayer;
let dofShader;
let post1Shader;

let cam;
const samplePoints = [];

function setup() {
  width = windowWidth;
  height = windowHeight;
  createCanvas(width, height, WEBGL);
  dofLayer = createFramebuffer({
    width: width / 2,
    height: height / 2,
  });

  noStroke();
  city = buildGeometry(() => {
    grid(0)
  })

  dofShader = createFilterShader(`precision highp float;
  varying vec2 vTexCoord;
  uniform sampler2D tex0;
  uniform sampler2D doftex;
  uniform float uMix;
  void main() {
    vec2 uv = vTexCoord;
    vec4 accumColor = texture2D(tex0, uv);
    vec4 dofColor = texture2D(doftex, uv);
    vec4 color = vec4(accumColor.rgb + dofColor.rgb * uMix, 1.0);
    gl_FragColor = color;
  }`);
  
  post1Shader = createFilterShader(`precision highp float;
  varying vec2 vTexCoord;
  uniform sampler2D tex0;
  uniform sampler2D uDepth;
  void main() {
    vec2 uv = vTexCoord;

    // Fog
    float depth = texture2D(uDepth, uv).r;
    float fog = pow(depth, 100.0);

    vec2 toCenter = vec2(0.5) - uv;
    vec2 toCenterNorm = normalize(toCenter);
    float dist = length(toCenter);
    
    // Chromatic aberration
    vec2 offset = toCenterNorm * 0.005 * dist;
    vec2 redUv = uv + offset;
    vec2 greenUv = uv;
    vec2 blueUv = uv - offset;
    vec4 red = texture2D(tex0, redUv);
    vec4 green = texture2D(tex0, greenUv);
    vec4 blue = texture2D(tex0, blueUv);
    vec4 color = vec4(red.r, green.g, blue.b, 1.0);

    // Mix fog
    // color.rgb = mix(color.rgb, vec3(1.0), fog);

    // Vignette
    float vignette = pow(dist, 2.0);
    // color.rgb *= 1.0 - vignette * 1.0;

    gl_FragColor = color;
  }`);

  loadFont('Raleway-Regular.ttf', (font) => {
    textFont(font);
    textSize(40);
  });

  // Poisson disk sampling
  const sampleCount = 10;
  const diskRadius = 5;
  for (let i = 0; i < sampleCount; i++) {
    let angle = random(TWO_PI);
    let radius = random(diskRadius);
    let sample = createVector(radius * cos(angle), radius * sin(angle));
    while (samplePoints.some(p => p.dist(sample) < 2.6)) {
      angle = random(TWO_PI);
      radius = random(diskRadius);
      sample = createVector(radius * cos(angle), radius * sin(angle));
    }
    samplePoints.push(sample);
  }
}

function draw() {
  push();

  perspective(PI/3, width/height, 1, 30_000);
  background(0);

  for (let i = 0; i < samplePoints.length; i++) {
    dofLayer.begin();

    let angle = millis() / 10000;

    const cameraPosition = createVector(
      1500 * cos(angle), 
      -300, 
      1500 * sin(angle),
    );

    const cameraTarget = cameraPosition.copy().div(2);
    
    // Jitter
    const xz = createVector(sin(angle) * samplePoints[i].x, cos(angle) * samplePoints[i].x);
    cameraPosition.add(xz.x, samplePoints[i].y, xz.y);

    camera(cameraPosition.x, cameraPosition.y, cameraPosition.z, cameraTarget.x, cameraTarget.y, cameraTarget.z, 0, 1, 0);

    scene();

    dofLayer.end();

    dofShader.setUniform('doftex', dofLayer.color);
    dofShader.setUniform('uMix', 1 / samplePoints.length);

    filter(dofShader);
  }
  pop();

  stroke(255);
  text(frameRate(), width / 4 + 10, height / 4 + 10);
  text("Rich man's stupid DOF using accumulation buffer", -width / 3, -height / 3);
  noStroke();

  post1Shader.setUniform('uDepth', dofLayer.depth);
  filter(post1Shader);
}

function scene() {
  background(0);
    
  directionalLight(205, 205, 180, 1, 1, -1);
  directionalLight(120, 120, 130, -1, 1, 1);
  ambientLight(100, 130, 160);

  
  push();

  translate(0, 10, 0);
  box(10, 10, 10);
  ground();
  translate(-2000, 0, -2000);
  model(city);

  pop();
}

function ground() {
  push();
  rotateX(PI/2);
  // fill(50, 50, 50);
  plane(20000, 20000);
  pop();
}

function grid(depth, blockW = 4000, seedX = 0, seedZ = 0) {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {

      push();

      const blockOffset = blockW / 2;
      const x = blockOffset * i;
      const z = blockOffset * j;

      const nextBlockWidth = blockOffset * 0.9;

      translate(x + blockOffset * 0.05, 0, z + blockOffset * 0.05);

      if (noise(x + seedX, z + seedZ) > 1.0 - depth * 0.2) {
        const buildingHeight = 0.1 * nextBlockWidth + nextBlockWidth * noise(x + 10 * seedX, z + 10 * seedZ);
        const buildingWidth = 0.9 - noise(x + 100 * seedX, z + 100 * seedZ) * 0.3;
        translate(nextBlockWidth / 2, -buildingHeight, nextBlockWidth / 2);
        box(buildingWidth * nextBlockWidth, 2 * buildingHeight, buildingWidth * nextBlockWidth);
      } else {
        const rot = PI / 2 * (noise(x + 100 * seedX, z + 100 * seedZ) - 0.5) * 0.2;
        rotateY(rot);
        grid(depth + 1, nextBlockWidth, seedX + x, seedZ + z);
      }

      pop();
    }
  }
}