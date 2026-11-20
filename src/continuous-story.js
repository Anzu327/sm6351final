import visitorsStyles from './visitors.css?inline';
import specimenStyles from './style.css?inline';
import { storySection, storyStage, visitorsRoot } from './visitors-dom.js';
import { resizeStory } from './visitors-timeline.js';

const style = document.createElement('style');
style.textContent = visitorsStyles + specimenStyles + '#scroll-story { height: 0; }';
visitorsRoot.prepend(style);
resizeStory();
addEventListener('resize', resizeStory);

const visibility = new IntersectionObserver(([entry]) => {
  const inView = entry.isIntersecting;
  storyStage.inert = !inView;
  document.body.classList.toggle('visitors-in-view', inView);
});
visibility.observe(storyStage);

// Get the models and first frame ready while the preceding chapters are still visible.
const preload = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  preload.disconnect();
  import('./visitors.js').catch(error => {
    visitorsRoot.getElementById('fallback').hidden = false;
    console.error('Could not initialize VISITORS', error);
  });
}, { rootMargin: `0px 0px ${innerHeight * 8}px 0px` });
preload.observe(storySection);
