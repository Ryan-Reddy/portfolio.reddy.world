for (const figure of document.querySelectorAll('.article-video[data-player]')) {
  const play = figure.querySelector('.video-play');
  play?.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.src = figure.dataset.player;
    frame.title = play.getAttribute('aria-label')?.replace(/^Play the /, '') ?? 'Video';
    frame.allow = 'autoplay; fullscreen; picture-in-picture';
    frame.allowFullscreen = true;
    figure.querySelector('.video-frame')?.replaceChildren(frame);
  }, {once:true});
}
