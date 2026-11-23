export function renderProfile(profile, links) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  document.querySelector('#hero-name').textContent = name;
  const role = typeof profile.role === 'string' ? profile.role.trim() : '';
  const roleLine = document.querySelector('#hero-role');
  if (role) roleLine.textContent = role;
  else roleLine.remove();
  document.querySelector('#hero-statement').textContent = profile.statement ?? '';
  document.title = role ? `${name} — ${role}` : name;
  const resume = document.querySelector('#link-resume');
  const resumeReady =
    /^https?:\/\//.test(links.resume ?? '') || (links.resume && __HAS_RESUME_PDF__);
  // Starts hidden in index.html, so a missing file never flashes a dead link.
  if (resumeReady) {
    resume.href = links.resume;
    resume.hidden = false;
  } else resume.remove();
  document.querySelector('#link-github').href = links.github;
}
