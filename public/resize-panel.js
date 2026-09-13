// The preference belongs to this browser, never to the read-only project data.
export function installPanelResize() {
  const handle = document.getElementById('detail-resizer');
  const storageKey = 'delivery-board.detail-width';
  let preferred = 360, drag = null;
  try { const saved = Number(localStorage.getItem(storageKey)); if (Number.isFinite(saved) && saved >= 280) preferred = Math.min(saved, 900); } catch {}
  const maximum = () => Math.max(280, Math.min(900, innerWidth - 186 - 320 - 8));
  const width = () => Math.max(280, Math.min(preferred, maximum()));
  const apply = () => {
    const current = width();
    document.documentElement.style.setProperty('--detail-width', `${current}px`);
    handle.setAttribute('aria-valuemin', '280');
    handle.setAttribute('aria-valuemax', String(maximum()));
    handle.setAttribute('aria-valuenow', String(Math.round(current)));
    handle.setAttribute('aria-valuetext', `详情栏宽度 ${Math.round(current)} 像素`);
  };
  const save = () => { try { localStorage.setItem(storageKey, String(preferred)); } catch {} };
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0 || innerWidth <= 850) return;
    drag = {id:e.pointerId, x:e.clientX, width:width()};
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing-detail');
    e.preventDefault();
  });
  handle.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    preferred = Math.max(280, Math.min(maximum(), drag.width + drag.x - e.clientX));
    apply();
  });
  const finish = () => { if (!drag) return; drag = null; document.body.classList.remove('resizing-detail'); save(); };
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
  handle.addEventListener('lostpointercapture', finish);
  handle.addEventListener('keydown', e => {
    const changes = {ArrowLeft:32, ArrowRight:-32};
    if (e.key in changes) preferred = Math.max(280, Math.min(maximum(), width() + changes[e.key]));
    else if (e.key === 'Home') preferred = 280;
    else if (e.key === 'End') preferred = maximum();
    else return;
    e.preventDefault(); apply(); save();
  });
  handle.addEventListener('dblclick', () => { preferred = 360; apply(); save(); });
  window.addEventListener('resize', () => { if (innerWidth <= 850) finish(); apply(); });
  apply();
}
