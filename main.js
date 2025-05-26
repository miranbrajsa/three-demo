import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Splatter } from 'splatter-three';
import { initWebGL, renderWebGLCube } from './cube.js';

// create WebGL2 context -- required for Splatter
const options = {
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance',
}
const canvas = document.createElement('canvas');
const context = canvas.getContext('webgl2', options);
if (!context) {
    alert('WebGL2 not supported in this browser');
    throw new Error('WebGL2 not supported');
}
document.body.appendChild(canvas);

// set up Three.js renderer
const renderer = new THREE.WebGLRenderer({ canvas, context });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x102030);

// set up Splatter
const splatter = new Splatter(context, {splatId: 'fmd-iuw'});
splatter.setTransform(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

// set up scene
const scene = new THREE.Scene();

const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff));

// set up camera and controls
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(-4, 4, 2);
const controls = new OrbitControls(camera, renderer.domElement);

// Initialize WebGL cube with custom shader code
const shaderCustomizations = {
    additionalUniforms: `
        uniform float uBrightness;
        uniform float uContrast;
        uniform float uSaturation;
        uniform float uTemperature;
        uniform float uLowTonePosition;
        uniform float uMidTonePosition;
        uniform float uHighTonePosition;
        uniform bool uApplyColorLevels;
    `,
    additionalFunctions: `
        vec3 temperatureToRGB(float kelvin) {
            kelvin = clamp(kelvin, 1000.0, 40000.0) / 100.0;
            float red = kelvin <= 66.0 ? 1.0 : clamp(1.292936186062745 * pow(kelvin - 60.0, -0.1332047592), 0.0, 1.0);
            float green = kelvin <= 66.0
                ? clamp(0.39008157876901960784 * log(kelvin) - 0.63184144378862745098, 0.0, 1.0)
                : clamp(1.129890860895294 * pow(kelvin - 60.0, -0.0755148492), 0.0, 1.0);
            float blue = kelvin >= 66.0 ? 1.0 : (kelvin <= 19.0 ? 0.0 : clamp(0.54320678911019607843 * log(kelvin - 10.0) - 1.19625408914, 0.0, 1.0));
            return vec3(red, green, blue);
        }

        vec3 applyLevels(vec3 color, float low, float mid, float high) {
            low = clamp(low, 0.0, 1.0);
            high = clamp(high, low + 0.01, 1.0);
            mid = clamp(mid, 0.01, 1.0);

            color = clamp((color - low) / (high - low), 0.0, 1.0);
            color = pow(color, vec3(1.0 - mid));

            return color;
        }
    `,
    colorCorrectionFunction: `
        vec4 applyColorCorrection(vec4 inputColor) {
            vec4 modifiedInputColor = inputColor;

            modifiedInputColor.rgb += uBrightness;
            modifiedInputColor.rgb = (modifiedInputColor.rgb - 0.5) * uContrast + 0.5;

            float luminance = 0.2126 * modifiedInputColor.r + 0.7152 * modifiedInputColor.g + 0.0722 * modifiedInputColor.b;
            modifiedInputColor.rgb = mix(vec3(luminance), modifiedInputColor.rgb, uSaturation);

            vec3 tempRGB = temperatureToRGB(uTemperature);
            modifiedInputColor.rgb *= tempRGB;

            if (uApplyColorLevels) {
                modifiedInputColor.rgb = applyLevels(modifiedInputColor.rgb, uLowTonePosition, uMidTonePosition, uHighTonePosition);
            }

            return modifiedInputColor;
        }
    `
};

// Initialize WebGL cube with custom shader code
const cubeState = initWebGL(context, camera, shaderCustomizations);
if (!cubeState) {
    console.error('Failed to initialize WebGL cube');
}

// Add uniforms to cube state
if (cubeState) {
    // Get uniform locations
    const uniforms = {
        brightness: context.getUniformLocation(cubeState.program, 'uBrightness'),
        contrast: context.getUniformLocation(cubeState.program, 'uContrast'),
        saturation: context.getUniformLocation(cubeState.program, 'uSaturation'),
        temperature: context.getUniformLocation(cubeState.program, 'uTemperature'),
        lowTone: context.getUniformLocation(cubeState.program, 'uLowTonePosition'),
        midTone: context.getUniformLocation(cubeState.program, 'uMidTonePosition'),
        highTone: context.getUniformLocation(cubeState.program, 'uHighTonePosition'),
        applyLevels: context.getUniformLocation(cubeState.program, 'uApplyColorLevels')
    };

    // Set initial uniform values
    context.useProgram(cubeState.program);
    context.uniform1f(uniforms.brightness, 0.0);
    context.uniform1f(uniforms.contrast, 1.0);
    context.uniform1f(uniforms.saturation, 1.13);
    context.uniform1f(uniforms.temperature, 6500.0);
    context.uniform1f(uniforms.lowTone, 0.016);
    context.uniform1f(uniforms.midTone, 0.418);
    context.uniform1f(uniforms.highTone, 0.984);
    context.uniform1i(uniforms.applyLevels, true);

    // Store uniforms in cube state
    cubeState.uniforms = uniforms;
}

// animation loop
function animate() {
    renderer.render(scene, camera);
    if (cubeState) {
        // Update time uniform
        context.useProgram(cubeState.program);
        context.uniform1f(cubeState.timeLocation, performance.now());
        renderWebGLCube(cubeState, camera);
    }
    splatter.render(camera);
    requestAnimationFrame(animate);
}

function resize() {
    let [width, height] = [window.innerWidth, window.innerHeight];
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (cubeState) {
        // Update WebGL viewport for the cube
        context.viewport(0, 0, width, height);
    }
}

resize();
animate();

window.addEventListener('resize', () => resize());
