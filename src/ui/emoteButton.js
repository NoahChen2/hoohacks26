// An emote button for a 3D view: each press plays a random dance and shows its
// name until it ends. `scene.emote()` returns the dance, or null when the body
// cannot dance (still loading, or an imported model without the rig).
export function wireEmoteButton(button, scene) {
  if (!button) return;
  const idle = button.innerHTML;
  let timer;
  button.addEventListener('click', () => {
    const dance = scene.emote();
    clearTimeout(timer);
    button.innerHTML = dance ? `<span aria-hidden="true">${dance.emoji}</span> ${dance.name}` : 'Body still loading';
    button.classList.toggle('is-dancing', !!dance);
    timer = setTimeout(() => {
      button.innerHTML = idle;
      button.classList.remove('is-dancing');
    }, dance ? dance.seconds * 1000 : 1500);
  });
}
