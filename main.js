import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Splatter } from 'splatter-three';
import { initWebGL, renderWebGLCube } from './cube.js';

// set world up direction
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

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
splatter.setPixelRatio(1); // render splats at CSS pixels for better performance
//splatter.setPixelRatio(window.devicePixelRatio); // render at device pixels for highest quality

// set up scene
const scene = new THREE.Scene();

const gridHelper = new THREE.GridHelper(10, 10);
gridHelper.rotation.x = Math.PI / 2;
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
        uniform float uTime;
        uniform vec3 uColorModifier;
    `,
    additionalFunctions: `
        float wave(float x) {
            return sin(x * 3.14159) * 0.5 + 0.5;
        }
    `,
    colorCorrectionFunction: `
        vec4 applyColorCorrection(vec4 inputColor) {
            float t = uTime * 0.001; // Convert to seconds
            float waveValue = wave(t + inputColor.r * 2.0);
            vec3 modifiedColor = inputColor.rgb * uColorModifier;
            return vec4(modifiedColor * waveValue, inputColor.a);
        }
    `
};

// const cubeState = initWebGL(context, camera);
const cubeState = initWebGL(context, camera, shaderCustomizations);
if (!cubeState) {
    console.error('Failed to initialize WebGL cube');
}

// Add time uniform to cube state
if (cubeState) {
    cubeState.timeLocation = context.getUniformLocation(cubeState.program, 'uTime');
    cubeState.colorModifierLocation = context.getUniformLocation(cubeState.program, 'uColorModifier');
    // Set initial color modifier
    context.useProgram(cubeState.program);
    context.uniform3f(cubeState.colorModifierLocation, 1.2, 0.8, 1.0);
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
