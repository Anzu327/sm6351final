const fullTurn = 2 * Math.PI;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const radians = degrees => degrees * Math.PI / 180;
const clamp = value => Math.max(0, Math.min(1, value));
const ease = progress => progress * progress * (3 - 2 * progress);

export function createStoryClock(camera, model) {
  const section = document.querySelector('.scene-tunnel');
  const hour = model.getObjectByName('Hour_hand');
  const minute = model.getObjectByName('Minute_hand');
  const distance = 3.8;
  model.visible = false;
  model.position.set(0, 0, -distance);
  camera.add(model);

  return {
    update() {
      const { top, bottom, height } = section.getBoundingClientRect();
      const viewport = window.innerHeight;
      model.visible = top < viewport * .61 && bottom > viewport * .82;
      if (!model.visible) return;

      const progress = clamp(-top / Math.max(1, height - viewport));
      const reveal = ease(clamp((viewport * .61 - top) / (viewport * .53)));
      const exit = ease(clamp((bottom - viewport * .82) / (viewport * .43)));
      const rewind = reducedMotion.matches ? 0 : ease(progress);
      const tilt = Math.sin(rewind * Math.PI);

      // The case rolls about the dial's center. Tilt shows its thickness
      // while leaving the hands readable as the viewer enters and exits.
      model.rotation.set(.20 * tilt, -.47 * tilt, fullTurn * rewind);
      minute.rotation.z = radians(-132) + fullTurn * rewind * 3;
      hour.rotation.z = radians(-281) + fullTurn * rewind * .25;

      const verticalField = Math.tan(radians(camera.getEffectiveFOV()) * .5);
      const diameter = Math.max(112, Math.min(206, viewport * .195));
      const size = diameter / viewport * distance * verticalField;
      model.scale.setScalar(size * Math.max(.002, reveal * exit));
    }
  };
}
