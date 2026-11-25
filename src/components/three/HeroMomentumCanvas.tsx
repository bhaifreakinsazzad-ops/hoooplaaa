'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { HeroSceneLoader } from '@/components/three/HeroSceneLoader';

// Module-scope scratch objects to guarantee zero GC allocations inside the render loop
const _dummy = new THREE.Object3D();
const _targetCamera = new THREE.Vector3();
const _lookTarget = new THREE.Vector3(0.42, 0.55, 0);
const _color = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoft = /SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(renderer);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return isSoft;
  } catch {
    return true;
  }
}

/**
 * Procedural fine brushed-gold roughness map for realistic anisotropic specular streaks.
 */
function createBrushedMetalRoughnessTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y++) {
      const n = Math.sin(y * 12.9898) * 43758.5453;
      const frac = n - Math.floor(n);
      const shade = Math.round(42 + frac * 34);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(0, y, 256, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural soft radial contact shadow to ground the architectural plinth on the obsidian horizon.
 */
function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 126);
    grad.addColorStop(0, 'rgba(1, 10, 8, 0.85)');
    grad.addColorStop(0.55, 'rgba(1, 14, 11, 0.42)');
    grad.addColorStop(1, 'rgba(1, 14, 11, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Procedural Dark-Luxury Three.js Backdrop for HOOOPLAAA INCORPORATED v3.0 Hero.
 * Sculptural composition directly inspired by the Brand Book v3.0 emblem:
 * - Four ascending beveled emerald-glass momentum bars with brushed anisotropic champagne-gold crowns
 * - Sweeping metallic champagne-gold growth trajectory arc with sculpted arrowhead & apex glint
 * - Dual counter-drifting luminous architectural orbital halos
 * - 64 instanced champagne-gold & emerald atmospheric motes over a Midnight Forest obsidian plane
 * - Choreographed smooth 3D arrival sweep synchronized with the hero entrance timeline
 */
interface HeroMomentumCanvasProps {
  onSceneReady?: () => void;
}

export function HeroMomentumCanvas({ onSceneReady }: HeroMomentumCanvasProps = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSceneReadyRef = useRef(onSceneReady);
  onSceneReadyRef.current = onSceneReady;

  const [fallbackActive, setFallbackActive] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [loaderMounted, setLoaderMounted] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Respect user reduced-motion preference gracefully
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setFallbackActive(true);
      setSceneReady(true);
      setLoaderMounted(false);
      onSceneReadyRef.current?.();
      return;
    }

    const isSoftware = detectSoftwareWebGL();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftware,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setFallbackActive(true);
      setSceneReady(true);
      setLoaderMounted(false);
      onSceneReadyRef.current?.();
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 680;

    renderer.setPixelRatio(isSoftware ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x021b16); // Midnight Forest
    scene.fog = new THREE.FogExp2(0x021b16, 0.048);

    // Start slightly elevated & pulled back for a smooth executive arrival sweep
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 60);
    camera.position.set(0.65, 2.15, 11.2);
    camera.lookAt(_lookTarget);

    // Studio PMREM reflections for brushed champagne gold & emerald glass
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.62;

    // Lighting rig: Champagne Gold Key + Deep Teal Fill + Emerald Rim + Studio Softboxes
    const hemiLight = new THREE.HemisphereLight(0x217a65, 0x021b16, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffe2a8, 2.35);
    keyLight.position.set(5.6, 7.6, 6.2);
    scene.add(keyLight);

    const emeraldRim = new THREE.PointLight(0x0aa672, 10.5, 24, 1.55);
    emeraldRim.position.set(-3.8, 3.4, -3.6);
    scene.add(emeraldRim);

    const goldAccentLight = new THREE.PointLight(0xd4af37, 7.2, 18, 1.65);
    goldAccentLight.position.set(3.9, 2.5, 3.5);
    scene.add(goldAccentLight);

    // Hardware-GPU studio softboxes (RectAreaLight skipped on software WebGL for steady frame times)
    if (!isSoftware) {
      RectAreaLightUniformsLib.init();

      const overheadSoftbox = new THREE.RectAreaLight(0xffe1a4, 3.4, 6.5, 1.6);
      overheadSoftbox.position.set(2.2, 5.4, 2.8);
      overheadSoftbox.lookAt(1.8, 0.6, -0.2);
      scene.add(overheadSoftbox);

      const emeraldKicker = new THREE.RectAreaLight(0x10b981, 2.6, 3.2, 5.4);
      emeraldKicker.position.set(-2.4, 2.2, -3.2);
      emeraldKicker.lookAt(1.6, 0.5, -0.2);
      scene.add(emeraldKicker);
    }

    // Shared tracked GPU resources for deterministic disposal
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];

    const brushedRoughnessMap = createBrushedMetalRoughnessTexture(maxAnisotropy);
    textures.push(brushedRoughnessMap);

    const contactShadowTex = createContactShadowTexture();
    textures.push(contactShadowTex);

    // Luxury PBR Materials aligned to Brand Book v3.0
    const brushedGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4af37,
      metalness: 0.94,
      roughness: 0.24,
      roughnessMap: brushedRoughnessMap,
      anisotropy: 0.85,
      anisotropyRotation: Math.PI / 4,
      clearcoat: 0.35,
      clearcoatRoughness: 0.18,
      emissive: 0x3b2806,
      emissiveIntensity: 0.24,
    });
    materials.push(brushedGoldMat);

    const softGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6be73,
      metalness: 0.88,
      roughness: 0.18,
      clearcoat: 0.45,
      clearcoatRoughness: 0.14,
      emissive: 0x52390b,
      emissiveIntensity: 0.34,
    });
    materials.push(softGoldMat);

    const emeraldGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a7f5a,
      metalness: 0.2,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      ior: 1.52,
      reflectivity: 0.92,
      emissive: 0x043d2b,
      emissiveIntensity: 0.48,
    });
    materials.push(emeraldGlassMat);

    const emeraldRimMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      metalness: 0.65,
      roughness: 0.24,
      emissive: 0x0a7f5a,
      emissiveIntensity: 0.65,
    });
    materials.push(emeraldRimMat);

    const obsidianFloorMat = new THREE.MeshStandardMaterial({
      color: 0x03221c,
      metalness: 0.74,
      roughness: 0.32,
    });
    materials.push(obsidianFloorMat);

    const darkTealTrimMat = new THREE.MeshStandardMaterial({
      color: 0x003d3a,
      metalness: 0.58,
      roughness: 0.34,
    });
    materials.push(darkTealTrimMat);

    // Composite Architectural Hero Sculpture (framed right-of-center to balance typography)
    const sculpture = new THREE.Group();
    sculpture.position.set(1.85, -0.56, -0.35);
    sculpture.rotation.y = -0.24;
    scene.add(sculpture);

    // 1. Two-tier stepped architectural obsidian plinth with brushed-gold chamfer rings
    const plinthLowerGeo = new THREE.CylinderGeometry(3.85, 4.15, 0.14, 56);
    geometries.push(plinthLowerGeo);
    const plinthLower = new THREE.Mesh(plinthLowerGeo, obsidianFloorMat);
    plinthLower.position.y = -0.96;
    sculpture.add(plinthLower);

    const plinthUpperGeo = new THREE.CylinderGeometry(3.38, 3.55, 0.12, 56);
    geometries.push(plinthUpperGeo);
    const plinthUpper = new THREE.Mesh(plinthUpperGeo, darkTealTrimMat);
    plinthUpper.position.y = -0.84;
    sculpture.add(plinthUpper);

    const plinthGoldRimGeo = new THREE.TorusGeometry(3.4, 0.02, 12, 84);
    geometries.push(plinthGoldRimGeo);
    const plinthGoldRim = new THREE.Mesh(plinthGoldRimGeo, brushedGoldMat);
    plinthGoldRim.rotation.x = Math.PI / 2;
    plinthGoldRim.position.y = -0.78;
    sculpture.add(plinthGoldRim);

    const plinthOuterRingGeo = new THREE.TorusGeometry(3.88, 0.012, 10, 96);
    geometries.push(plinthOuterRingGeo);
    const plinthOuterRing = new THREE.Mesh(plinthOuterRingGeo, softGoldMat);
    plinthOuterRing.rotation.x = Math.PI / 2;
    plinthOuterRing.position.y = -0.89;
    sculpture.add(plinthOuterRing);

    // 2. Four Ascending Beveled Emerald-Glass Momentum Bars with Brushed Gold Crowns
    const barSpecs = [
      { x: -1.45, h: 1.18, revealDelay: 0.08 },
      { x: -0.5, h: 1.78, revealDelay: 0.2 },
      { x: 0.45, h: 2.42, revealDelay: 0.32 },
      { x: 1.4, h: 3.1, revealDelay: 0.44 },
    ];

    const barMeshes: Array<{ group: THREE.Group; revealDelay: number }> = [];
    for (const spec of barSpecs) {
      const barGroup = new THREE.Group();
      barGroup.position.set(spec.x, -0.78, 0);
      barGroup.scale.set(1, 0.08, 1); // Rises cleanly on entrance

      // Extruded chamfered rectangular profile
      const w = 0.62;
      const d = 0.46;
      const shape = new THREE.Shape();
      const r = 0.06;
      shape.moveTo(-w / 2 + r, -d / 2);
      shape.lineTo(w / 2 - r, -d / 2);
      shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
      shape.lineTo(w / 2, d / 2 - r);
      shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
      shape.lineTo(-w / 2 + r, d / 2);
      shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
      shape.lineTo(-w / 2, -d / 2 + r);
      shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);

      const barGeo = new THREE.ExtrudeGeometry(shape, {
        depth: spec.h,
        bevelEnabled: true,
        bevelThickness: 0.036,
        bevelSize: 0.028,
        bevelSegments: 3,
      });
      barGeo.rotateX(-Math.PI / 2);
      geometries.push(barGeo);

      const barBody = new THREE.Mesh(barGeo, emeraldGlassMat);
      barGroup.add(barBody);

      // Brushed champagne-gold top crown plate
      const crownGeo = new THREE.BoxGeometry(w + 0.07, 0.08, d + 0.07);
      geometries.push(crownGeo);
      const crown = new THREE.Mesh(crownGeo, brushedGoldMat);
      crown.position.y = spec.h + 0.042;
      barGroup.add(crown);

      // Subtle hairline gold inlay band below crown
      const trimGeo = new THREE.BoxGeometry(w + 0.09, 0.02, d + 0.09);
      geometries.push(trimGeo);
      const trim = new THREE.Mesh(trimGeo, softGoldMat);
      trim.position.y = spec.h - 0.14;
      barGroup.add(trim);

      // Dark teal pedestal collar
      const collarGeo = new THREE.BoxGeometry(w + 0.13, 0.1, d + 0.13);
      geometries.push(collarGeo);
      const collar = new THREE.Mesh(collarGeo, darkTealTrimMat);
      collar.position.y = 0.05;
      barGroup.add(collar);

      sculpture.add(barGroup);
      barMeshes.push({ group: barGroup, revealDelay: spec.revealDelay });
    }

    // 3. Sweeping Champagne-Gold Growth Trajectory Arc + Sculpted Faceted Arrowhead
    const arcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.65, 0.08, 0.72),
      new THREE.Vector3(-1.12, 0.38, 0.94),
      new THREE.Vector3(0.45, 0.96, 0.85),
      new THREE.Vector3(1.66, 1.94, 0.62),
      new THREE.Vector3(2.48, 2.82, 0.36),
    ]);
    const arcGeo = new THREE.TubeGeometry(arcCurve, 80, 0.082, 16, false);
    geometries.push(arcGeo);
    const arcMesh = new THREE.Mesh(arcGeo, softGoldMat);
    sculpture.add(arcMesh);

    // Sculpted arrowhead aligned cleanly to curve end tangent
    const tipPoint = arcCurve.getPoint(1);
    const tipTangent = arcCurve.getTangent(1).normalize();
    const arrowGeo = new THREE.ConeGeometry(0.25, 0.58, 4);
    geometries.push(arrowGeo);
    const arrowMesh = new THREE.Mesh(arrowGeo, brushedGoldMat);
    arrowMesh.position.copy(tipPoint).addScaledVector(tipTangent, 0.15);
    arrowMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipTangent);
    sculpture.add(arrowMesh);

    // Warm golden apex highlight near the arrowhead tip
    const apexLight = new THREE.PointLight(0xffdf8e, 4.2, 6.5, 1.8);
    apexLight.position.copy(tipPoint).addScaledVector(tipTangent, 0.45);
    sculpture.add(apexLight);

    // 4. Dual Concentric Architectural Orbital Halos behind the momentum sculpture
    const haloGeo = new THREE.TorusGeometry(2.68, 0.024, 12, 96, Math.PI * 1.18);
    geometries.push(haloGeo);
    const haloMesh = new THREE.Mesh(haloGeo, softGoldMat);
    haloMesh.position.set(0.15, 0.56, -0.78);
    haloMesh.rotation.z = -0.18;
    sculpture.add(haloMesh);

    const outerHaloGeo = new THREE.TorusGeometry(3.12, 0.012, 10, 96, Math.PI * 0.92);
    geometries.push(outerHaloGeo);
    const outerHaloMesh = new THREE.Mesh(outerHaloGeo, emeraldRimMat);
    outerHaloMesh.position.set(0.15, 0.56, -0.96);
    outerHaloMesh.rotation.z = 0.24;
    sculpture.add(outerHaloMesh);

    // 5. Sweeping Deep Horizon Plane + Grounded Contact Shadow + Architectural Ring
    const floorGeo = new THREE.PlaneGeometry(46, 46);
    geometries.push(floorGeo);
    const floorMesh = new THREE.Mesh(floorGeo, obsidianFloorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -1.55;
    scene.add(floorMesh);

    const shadowPlaneGeo = new THREE.PlaneGeometry(11.5, 11.5);
    geometries.push(shadowPlaneGeo);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    materials.push(shadowPlaneMat);
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(1.85, -1.52, -0.35);
    scene.add(shadowPlane);

    const floorAccentGeo = new THREE.RingGeometry(4.35, 4.385, 84);
    geometries.push(floorAccentGeo);
    const floorAccentMat = new THREE.MeshBasicMaterial({
      color: 0xd4af37,
      transparent: true,
      opacity: 0.26,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      depthWrite: false,
    });
    materials.push(floorAccentMat);
    const floorAccent = new THREE.Mesh(floorAccentGeo, floorAccentMat);
    floorAccent.rotation.x = -Math.PI / 2;
    floorAccent.position.set(1.85, -1.525, -0.35);
    scene.add(floorAccent);

    // 6. Instanced Champagne-Gold & Emerald Atmospheric Motes (uniform count across all GPUs)
    const moteCount = 64;
    const moteGeo = new THREE.OctahedronGeometry(0.036, 0);
    geometries.push(moteGeo);
    const moteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.82,
      roughness: 0.22,
      emissive: 0x3b2a07,
      emissiveIntensity: 0.45,
    });
    materials.push(moteMat);

    const motes = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
    motes.frustumCulled = false;

    const paletteHex = [0xd4af37, 0xe6be73, 0x10b981];
    const moteData: Array<{ x: number; y: number; z: number; speed: number; phase: number; scale: number }> = [];
    for (let i = 0; i < moteCount; i++) {
      const s1 = Math.sin(i * 12.9898) * 43758.5453;
      const r1 = s1 - Math.floor(s1);
      const s2 = Math.sin(i * 78.233 + 1.7) * 43758.5453;
      const r2 = s2 - Math.floor(s2);
      const s3 = Math.sin(i * 39.425 + 4.2) * 43758.5453;
      const r3 = s3 - Math.floor(s3);
      moteData.push({
        x: (r1 - 0.36) * 14.2,
        y: (r2 - 0.24) * 6.4,
        z: (r3 - 0.5) * 8.2 - 1.4,
        speed: 0.16 + r1 * 0.26,
        phase: r2 * Math.PI * 2,
        scale: 0.55 + r3 * 1.05,
      });

      _color.setHex(paletteHex[i % paletteHex.length]);
      motes.setColorAt(i, _color);
    }
    if (motes.instanceColor) {
      motes.instanceColor.needsUpdate = true;
    }
    scene.add(motes);

    // Pre-compile shaders on hardware GPUs so the first animated frame never stutters
    if (!isSoftware) {
      renderer.compile(scene, camera);
    }

    // Pointer parallax state
    const pointer = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    // ResizeObserver for crisp container fitting
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width === 0 || rect.height === 0) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height);
    });
    ro.observe(container);

    // Visibility & off-screen pause discipline
    let inViewport = true;
    const io = new IntersectionObserver(
      (entries) => {
        inViewport = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.02 }
    );
    io.observe(container);

    let disposed = false;
    let rafId = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let unmountLoaderTimer: ReturnType<typeof setTimeout> | null = null;
    let activeSync: WebGLSync | null = null;
    let firstFramePainted = false;
    let lastTime = performance.now();
    let elapsed = 0;

    const signalFirstFrameReady = () => {
      if (firstFramePainted || disposed) return;
      firstFramePainted = true;
      setSceneReady(true);
      onSceneReadyRef.current?.();
      unmountLoaderTimer = setTimeout(() => {
        if (!disposed) {
          setLoaderMounted(false);
        }
      }, 750);
    };

    // Software WebGL fence-sync pacing helper: yields to main thread after GPU work completes
    const glCtx = renderer.getContext() as WebGL2RenderingContext;
    const afterDraw = (next: () => void) => {
      if (disposed) return;
      if (!isSoftware || typeof glCtx.fenceSync !== 'function') {
        rafId = requestAnimationFrame(next);
        return;
      }
      activeSync = glCtx.fenceSync(glCtx.SYNC_GPU_COMMANDS_COMPLETE, 0);
      glCtx.flush();
      const poll = () => {
        if (disposed) {
          if (activeSync) {
            glCtx.deleteSync(activeSync);
            activeSync = null;
          }
          return;
        }
        if (activeSync && glCtx.getSyncParameter(activeSync, glCtx.SYNC_STATUS) === glCtx.UNSIGNALED) {
          timerId = setTimeout(poll, 5);
        } else {
          if (activeSync) {
            glCtx.deleteSync(activeSync);
            activeSync = null;
          }
          timerId = setTimeout(next, 80);
        }
      };
      timerId = setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (!document.hidden && inViewport) {
        elapsed += dt;

        // Smooth executive camera arrival sweep + subtle pointer parallax
        _targetCamera.set(0.42 + pointer.x * 0.44, 1.45 - pointer.y * 0.24, 9.45);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamera.x, 2.8, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamera.y, 2.8, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamera.z, 2.2, dt);
        camera.lookAt(_lookTarget);

        // Gentle architectural breathing on sculpture & counter-drifting halos
        const targetRotY = -0.24 + Math.sin(elapsed * 0.3) * 0.075 + pointer.x * 0.055;
        sculpture.rotation.y = THREE.MathUtils.damp(sculpture.rotation.y, targetRotY, 3.0, dt);
        haloMesh.rotation.z = -0.18 + Math.sin(elapsed * 0.42) * 0.045;
        outerHaloMesh.rotation.z = 0.24 - Math.sin(elapsed * 0.36) * 0.05;

        // Staggered architectural entrance rise + phased ambient float on momentum bars
        for (let i = 0; i < barMeshes.length; i++) {
          const item = barMeshes[i];
          if (elapsed >= item.revealDelay) {
            item.group.scale.y = THREE.MathUtils.damp(item.group.scale.y, 1, 4.2, dt);
          }
          item.group.position.y = -0.78 + Math.sin(elapsed * 0.82 + i * 0.65) * 0.03;
        }

        // Subtle warm shimmer on the golden apex glint
        apexLight.intensity = 3.8 + Math.sin(elapsed * 1.9) * 0.65;

        // Update instanced atmospheric motes with zero allocations
        for (let i = 0; i < moteCount; i++) {
          const m = moteData[i];
          const yOffset = Math.sin(elapsed * m.speed + m.phase) * 0.42;
          _dummy.position.set(m.x, m.y + yOffset, m.z);
          _dummy.rotation.set(elapsed * 0.38 + m.phase, elapsed * 0.28, 0);
          _dummy.scale.setScalar(m.scale);
          _dummy.updateMatrix();
          motes.setMatrixAt(i, _dummy.matrix);
        }
        motes.instanceMatrix.needsUpdate = true;

        renderer.render(scene, camera);
        signalFirstFrameReady();
      } else if (!firstFramePainted) {
        // Render one initial frame even if offscreen/hidden so loader never stalls
        renderer.render(scene, camera);
        signalFirstFrameReady();
      }

      afterDraw(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (unmountLoaderTimer !== null) {
        clearTimeout(unmountLoaderTimer);
        unmountLoaderTimer = null;
      }
      if (activeSync && typeof glCtx.deleteSync === 'function') {
        glCtx.deleteSync(activeSync);
        activeSync = null;
      }
      window.removeEventListener('pointermove', onPointerMove);
      ro.disconnect();
      io.disconnect();

      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (fallbackActive) {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 75% 32%, rgba(10, 127, 90, 0.30) 0%, rgba(0, 61, 58, 0.24) 38%, rgba(2, 27, 22, 0.98) 78%)',
        }}
      />
    );
  }

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        ref={containerRef}
        className={`h-full w-full transition-opacity duration-700 ease-out ${
          sceneReady ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {loaderMounted && <HeroSceneLoader visible={!sceneReady} />}
    </div>
  );
}
