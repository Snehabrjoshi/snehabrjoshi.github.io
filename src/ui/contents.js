// The non-3D path to every section; without WebGL it is the page itself.
export function createContents({ sections, onSelect }) {
  const toggle = document.querySelector('#contents-toggle');
  const panel = document.querySelector('#contents');
  const list = document.querySelector('#contents-list');
  let staticMode = false;

  const buttons = sections.map((section) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'contents-item';
    const number = document.createElement('span');
    number.className = 'contents-item__number';
    number.textContent = section.number ?? '';
    const name = document.createElement('span');
    name.className = 'contents-item__name';
    name.textContent = section.name;
    const blurb = document.createElement('span');
    blurb.className = 'contents-item__blurb';
    blurb.textContent = section.blurb;
    button.append(number, name, blurb);
    button.addEventListener('click', () => {
      if (!staticMode) close(false);
      onSelect(section.id, staticMode ? button : toggle);
    });
    li.append(button);
    list.append(li);
    return button;
  });

  function open() {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    buttons[0].focus();
  }
  function close(restoreFocus = true) {
    if (staticMode || panel.hidden) return;
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus();
  }

  toggle.addEventListener('click', () => (panel.hidden ? open() : close()));
  panel.addEventListener('keydown', (event) => {
    const i = buttons.indexOf(document.activeElement);
    const move = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (move && i >= 0) buttons[(i + move + buttons.length) % buttons.length].focus();
    else if (event.key === 'Home') buttons[0].focus();
    else if (event.key === 'End') buttons[buttons.length - 1].focus();
    else if (event.key === 'Escape') close();
    else return;
    event.preventDefault();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!panel.hidden && !panel.contains(event.target) && !toggle.contains(event.target)) {
      close(false);
    }
  });

  return {
    close,
    showStatic() {
      staticMode = true;
      panel.hidden = false;
      toggle.hidden = true;
    },
  };
}
