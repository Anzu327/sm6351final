const footage = [...document.querySelectorAll('video[data-source]')];
const visibility = new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) {
    if (isIntersecting && !target.src) {
      target.src = target.dataset.source;
    } else if (!isIntersecting) {
      target.pause();
    }
  }
}, { threshold: .15 });

for (const video of footage) {
  visibility.observe(video);
  video.addEventListener('play', () => {
    for (const other of footage) {
      if (other !== video) other.pause();
    }
  });
  video.addEventListener('error', () => {
    if (!video.src || video.parentElement.querySelector('.footage-error')) return;
    const message = document.createElement('p');
    message.className = 'footage-error';
    message.textContent = 'Video unavailable. The source is linked below.';
    video.parentElement.append(message);
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) footage.forEach(video => video.pause());
});
