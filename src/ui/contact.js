// Posts to Web3Forms (VITE_WEB3FORMS_KEY); failure offers a prefilled mailto link.

const ENDPOINT = 'https://api.web3forms.com/submit';
const KEY = import.meta.env.VITE_WEB3FORMS_KEY ?? '';
const MIN_FILL_MS = 3000; // faster than this is a bot
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (value === true) node.setAttribute(key, '');
    else if (value !== false && value != null) node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
};
const display = (url) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

function linkList(links) {
  const list = el('dl', { class: 'contact-links' });
  const row = (label, ...value) => list.append(el('dt', { text: label }), el('dd', {}, ...value));

  if (links.email) {
    const status = el('span', { class: 'contact-copied', role: 'status' });
    const copy = el('button', { type: 'button', class: 'contact-copy', text: 'Copy' });
    copy.setAttribute('aria-label', `Copy email address ${links.email}`);
    copy.addEventListener('click', async () => {
      let ok = false;
      try {
        await navigator.clipboard.writeText(links.email);
        ok = true;
      } catch {
        ok = false;
      }
      status.textContent = ok ? 'Copied' : 'Select and copy the address';
      clearTimeout(copy.timer);
      copy.timer = setTimeout(() => (status.textContent = ''), 2400);
    });
    row('Email', el('a', { href: `mailto:${links.email}`, text: links.email }), ' ', copy, status);
  }
  for (const [label, url] of [
    ['GitHub', links.github],
    ['LinkedIn', links.linkedin],
    ['Goodreads', links.goodreads],
  ]) {
    if (url)
      row(label, el('a', { href: url, target: '_blank', rel: 'noopener', text: display(url) }));
  }
  return list;
}

function field(id, label, control, hint) {
  const error = el('p', { class: 'note-error', id: `${id}-error`, hidden: true });
  control.id = id;
  control.setAttribute('aria-describedby', `${id}-error`);
  const wrap = el('div', { class: 'note-field' }, el('label', { for: id, text: label }), control);
  if (hint) wrap.append(el('p', { class: 'note-hint', text: hint }));
  wrap.append(error);
  return { wrap, control, error };
}

function noteForm(links) {
  const card = el('section', { class: 'note-card', 'aria-labelledby': 'note-title' });
  const title = el('h3', { id: 'note-title', class: 'note-title', text: 'Leave a note' });
  const form = el('form', { class: 'note-form', novalidate: true });
  const name = field('note-name', 'Your name', el('input', { name: 'name', autocomplete: 'name' }));
  const email = field(
    'note-email',
    'Your email',
    el('input', { name: 'email', type: 'email', autocomplete: 'email', inputmode: 'email' }),
  );
  const message = field('note-message', 'Message', el('textarea', { name: 'message', rows: '4' }));
  // Honeypot: invisible to people and screen readers; bots fill it in.
  const trap = el('input', {
    type: 'checkbox',
    name: 'botcheck',
    class: 'note-trap',
    tabindex: '-1',
    'aria-hidden': 'true',
    autocomplete: 'off',
  });
  const send = el('button', { type: 'submit', class: 'note-send', text: 'Send' });
  const status = el('p', { class: 'note-status', role: 'status' });
  form.append(name.wrap, email.wrap, message.wrap, trap, send, status);
  card.append(title, form);
  const opened = Date.now();

  const rules = [
    [name, (v) => (v.trim() ? '' : 'Please add your name.')],
    [
      email,
      (v) =>
        !v.trim()
          ? 'Please add your email, so I can reply.'
          : EMAIL.test(v.trim())
            ? ''
            : 'That email address doesn’t look complete.',
    ],
    [
      message,
      (v) => (v.trim().length >= 10 ? '' : 'A few more words, please (10 characters or more).'),
    ],
  ];
  const check = (f, rule) => {
    const problem = rule(f.control.value);
    f.error.textContent = problem;
    f.error.hidden = !problem;
    if (!problem) f.control.removeAttribute('aria-invalid');
    else f.control.setAttribute('aria-invalid', 'true');
    return !problem;
  };
  // Errors appear on submit, then clear as each field is fixed.
  for (const [f, rule] of rules) {
    f.control.addEventListener('input', () => {
      if (f.control.getAttribute('aria-invalid')) check(f, rule);
    });
  }

  const mailto = () => {
    const subject = encodeURIComponent(`A note from ${name.control.value.trim() || 'your site'}`);
    const body = encodeURIComponent(message.control.value.trim());
    return `mailto:${links.email}?subject=${subject}&body=${body}`;
  };

  function fail(text) {
    status.replaceChildren(
      el('span', { text: `${text} ` }),
      el('a', { href: mailto(), text: 'Send it by email instead' }),
      '.',
    );
    status.className = 'note-status is-error';
    send.disabled = false;
    send.textContent = 'Try again';
    form.removeAttribute('aria-busy');
  }

  let sending = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;
    const results = rules.map(([f, rule]) => check(f, rule));
    const firstBad = results.indexOf(false);
    if (firstBad >= 0) {
      rules[firstBad][0].control.focus();
      status.textContent = '';
      return;
    }
    const tooFast = Date.now() - opened < MIN_FILL_MS;
    if (trap.checked || tooFast) {
      // Looks automated: behave as if sent, send nothing.
      done();
      return;
    }
    if (!KEY) {
      fail('The form isn’t connected yet.');
      return;
    }
    sending = true;
    send.disabled = true;
    send.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    status.className = 'note-status';
    status.textContent = 'Sending your note…';
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: KEY,
          subject: `Portfolio note from ${name.control.value.trim()}`,
          from_name: name.control.value.trim(),
          name: name.control.value.trim(),
          email: email.control.value.trim(),
          message: message.control.value.trim(),
          botcheck: false,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.message || `HTTP ${res.status}`);
      done();
    } catch {
      fail('Sorry, the note didn’t send.');
    } finally {
      sending = false;
    }
  });

  function done() {
    const who = name.control.value.trim();
    const thanks = el(
      'div',
      { class: 'note-sent', tabindex: '-1', role: 'status' },
      el('p', { class: 'note-sent__title', text: `Thank you${who ? `, ${who}` : ''}.` }),
      el('p', {
        text: `Your note is on its way. I’ll reply to ${email.control.value.trim()}.`,
      }),
    );
    form.replaceWith(thanks);
    thanks.focus({ preventScroll: true });
  }

  return card;
}

export function createContactPage(links) {
  return [linkList(links), noteForm(links)];
}
