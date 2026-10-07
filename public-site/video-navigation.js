// Native details/summary provides mouse, touch, Enter, and Space behavior without JS.
// Enhance it with synchronized ARIA state and conventional dismissal behavior.
document.querySelectorAll('.video-dropdown').forEach(dropdown => {
  const summary = dropdown.querySelector('summary');
  const sync = () => summary.setAttribute('aria-expanded', String(dropdown.open));
  const close = () => { dropdown.open = false; sync(); };
  sync();
  dropdown.addEventListener('toggle', sync);
  dropdown.addEventListener('keydown', event => {
    if (event.key === 'Escape' && dropdown.open) {
      event.preventDefault();
      close();
      summary.focus();
    }
  });
  dropdown.addEventListener('focusout', event => {
    if (!dropdown.contains(event.relatedTarget)) close();
  });
  document.addEventListener('click', event => {
    if (!dropdown.contains(event.target)) close();
  });
});
