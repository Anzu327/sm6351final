import { ease } from './motion.js';
import './chelyabinsk-outro.css';

export function mountChelyabinskOutro() {
  const section = document.getElementById('chelyabinsk-outro');
  const stage = section.querySelector('.outro-stage');
  const quote = stage.querySelector('blockquote');
  const author = stage.querySelector('figcaption');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let pending = false;

  function draw() {
    pending = false;
    if (reducedMotion.matches) return;

    const frame = section.getBoundingClientRect();
    const progress = -frame.top / innerHeight;
    const active = progress >= -.75 && frame.bottom > 0;
    stage.classList.toggle('is-visible', active);
    if (!active) return;

    stage.style.transform = `translateY(${Math.min(0, frame.bottom - stage.offsetHeight)}px)`;
    quote.style.opacity = ease(-.70, -.30, progress);
    author.style.opacity = ease(-.57, -.17, progress);
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(draw);
  }

  function updateMotion() {
    section.toggleAttribute('data-motion', !reducedMotion.matches);
    if (reducedMotion.matches) {
      stage.style.removeProperty('transform');
      quote.style.removeProperty('opacity');
      author.style.removeProperty('opacity');
    } else {
      schedule();
    }
  }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  reducedMotion.addEventListener('change', updateMotion);
  updateMotion();
}
