import * as THREE from 'three';
import { assetBase } from './asset-base.js';
import { clamp, ease, mix, outroFlightEnd, outroFlightPoint, outroFlightProgress, outroFlightStart } from './motion.js';
import { loadSpecimen } from './specimen.js';
import './chelyabinsk-outro.css';

const museumAnchor = { x: .493, y: .49, diameter: .24 };
const displayRotation = new THREE.Euler(-.06, .42, .04);

export function mountChelyabinskOutro() {
  const section = document.getElementById('chelyabinsk-outro');
  const stage = section.querySelector('.outro-stage');
  const museum = section.querySelector('.outro-museum');
  const wake = section.querySelector('.outro-wake');
  const wakePath = wake.querySelector('path');
  const wakeInk = wake.querySelector('linearGradient');
  const canvas = section.querySelector('.outro-canvas');
  const specimenPhoto = section.querySelector('.outro-specimen');
  const birthday = section.querySelector('.outro-birthday');
  museum.src = assetBase + 'visitors/outro-museum.webp';
  specimenPhoto.src = assetBase + 'visitors/featured/57165.webp';
  museum.addEventListener('load', () => {
    section.style.setProperty('--museum-aspect', museum.naturalWidth / museum.naturalHeight);
    if (section.hasAttribute('data-motion')) schedule();
  });

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  section.dataset.motion = '';

  const rockScene = new THREE.Scene();
  const rockCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 20);
  rockCamera.position.z = 5;
  let renderer;
  let rock;
  let rockRadius = 1;
  let loading = false;
  let width = 0;
  let height = 0;
  let pending = false;

  async function prepareScenes() {
    loading = true;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
      const specimen = await loadSpecimen(renderer, true);
      const model = specimen.rock;
      rockRadius = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere()).radius;
      rockScene.add(model);
      rock = model;
    } catch (error) {
      console.warn('The Chelyabinsk closing scene is using its photograph.', error);
      renderer?.dispose();
      section.removeAttribute('data-motion');
    }
    schedule();
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(draw);
  }

  function draw() {
    pending = false;
    const frame = section.getBoundingClientRect();
    if (!section.hasAttribute('data-motion')) return;
    const scroll = -frame.top / innerHeight;
    if (!loading && scroll > outroFlightStart - .85) prepareScenes();
    const active = frame.bottom > 0 && scroll >= outroFlightStart;
    stage.classList.toggle('is-visible', active);
    if (!active) return;
    stage.style.transform = `translateY(${Math.min(0, frame.bottom - stage.offsetHeight)}px)`;
    const stageRect = stage.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) return;
    const p = clamp(-frame.top / Math.max(1, frame.height - stageRect.height));
    const flight = outroFlightProgress(scroll);
    const rockAlpha = ease(0, .10, flight);
    const museumReveal = rock ? ease(outroFlightEnd + .18, outroFlightEnd + .70, scroll) : 0;
    const party = ease(.54, .83, p) * museumReveal;

    stage.style.setProperty('--outro-room', ease(-1.20, -.89, scroll));
    museum.style.opacity = museumReveal;
    museum.style.setProperty('--museum-reveal', `${35 * (1 - museumReveal)}%`);
    museum.style.filter = `brightness(${mix(.77, 1, party)})`;
    birthday.style.opacity = party;

    const caseRect = museum.getBoundingClientRect();
    birthday.style.top = `${(caseRect.bottom - stageRect.top + stageRect.height) / 2}px`;
    const restDiameter = caseRect.width * museumAnchor.diameter;
    const landingX = (caseRect.left - stageRect.left + caseRect.width * museumAnchor.x) / stageRect.width;
    const landingY = (caseRect.top - stageRect.top + caseRect.height * museumAnchor.y) / stageRect.height;
    const [x, y] = outroFlightPoint(flight, landingX, landingY);
    const settle = ease(.57, 1, flight);
    const flyDiameter = Math.min(stageRect.width, stageRect.height) * mix(.18, .65, ease(.04, .56, flight));
    const rockPixels = mix(flyDiameter, restDiameter, settle);
    const wakeAlpha = ease(.08, .22, flight) * (1 - ease(-1.15, -.58, scroll));
    wake.style.opacity = wakeAlpha;
    if (wakeAlpha > 0) {
      const point = t => outroFlightPoint(clamp(t), landingX, landingY)
        .map((value, index) => value * (index === 0 ? stageRect.width : stageRect.height));
      const start = point(flight - .18);
      const middle = point(flight - .10);
      const end = point(flight - .028);
      wake.setAttribute('viewBox', `0 0 ${stageRect.width} ${stageRect.height}`);
      wakePath.setAttribute('d', `M ${start.join(' ')} Q ${middle.join(' ')} ${end.join(' ')}`);
      wakeInk.setAttribute('x1', start[0]);
      wakeInk.setAttribute('y1', start[1]);
      wakeInk.setAttribute('x2', end[0]);
      wakeInk.setAttribute('y2', end[1]);
    }

    if (!rock) {
      specimenPhoto.style.left = `${x * 100}%`;
      specimenPhoto.style.top = `${y * 100}%`;
      specimenPhoto.style.width = `${rockPixels}px`;
      specimenPhoto.style.opacity = rockAlpha;
      return;
    }
    specimenPhoto.style.opacity = 0;
    if (width !== stageRect.width || height !== stageRect.height) {
      ({ width, height } = stageRect);
      renderer.setSize(width, height, false);
      rockCamera.left = -width / height;
      rockCamera.right = width / height;
      rockCamera.updateProjectionMatrix();
    }

    rock.position.set((2 * x - 1) * width / height, 1 - 2 * y, 0);
    rock.scale.setScalar(rockPixels / (height * rockRadius));
    const land = ease(outroFlightEnd - .47, outroFlightEnd, scroll);
    rock.rotation.set(mix(.24, displayRotation.x, land),
      mix(-.72 + 1.87 * flight, displayRotation.y, land),
      mix(-.28 + .40 * flight, displayRotation.z, land));
    canvas.style.opacity = rockAlpha;
    canvas.classList.toggle('is-hovering', flight === 1);
    renderer.render(rockScene, rockCamera);
  }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  schedule();
}
