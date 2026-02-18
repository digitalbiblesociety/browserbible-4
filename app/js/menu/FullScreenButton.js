import fullscreenSvg from '../../css/images/fullscreen.svg?raw';

export class FullScreenButton {
  constructor(container) {
    const d = document;
    if (!d.fullscreenEnabled) return;

    d.documentElement.classList.add('supports-fullscreen');

    this.btn = d.createElement('div');
    this.btn.id = 'main-fullscreen-button';
    this.btn.innerHTML = fullscreenSvg;

    container.appendChild(this.btn);

    this.btn.addEventListener('click', () =>
      d.fullscreenElement ? d.exitFullscreen() : d.documentElement.requestFullscreen()
    );
  }
}

export default FullScreenButton;
