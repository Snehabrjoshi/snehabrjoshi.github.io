const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

function group({ heading, items, plain }) {
  const section = el('section', `skills-group${plain ? ' skills-group--plain' : ''}`);
  section.append(el('h3', 'skills-group__heading', heading));
  if (plain) {
    // Each item stays whole on its line.
    const line = el('p', 'skills-line');
    items.forEach((item, i) => {
      if (i) line.append(' · ');
      line.append(el('span', null, item));
    });
    section.append(line);
    return section;
  }
  const list = el('ul', 'skills-chips');
  for (const item of items) {
    if (typeof item === 'string') {
      list.append(el('li', 'skills-chip', item));
      continue;
    }
    const li = el('li', 'skills-chips__lead');
    li.append(
      el('span', 'skills-chip', item.name),
      el('span', 'skills-libs', item.libs.join(' · ')),
    );
    list.append(li);
  }
  section.append(list);
  return section;
}

export function createSkills(groups) {
  const wrap = el('div', 'skills');
  wrap.append(...groups.map(group));
  return wrap;
}
