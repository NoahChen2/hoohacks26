import { completeProject, WORLDS, SCHOOLS } from '../progression.js';
import { rankProgress } from './communityPanel.js';
import { ITEM_BY_ID } from '../avatar/items.js';
import { THRESHOLDS,tierFor } from '../progression.js';
import { state, emit, TOOLS, GARMENT_TYPES, MATERIALS, selectedGarment } from '../state.js';
import { flatSVG } from '../flats.js';
import { suggest, buildSteps, afterGarment, fitSummary } from '../upcycle.js';
import { PATTERN_LABELS } from '../patterns.js';

export const previewEvents = new EventTarget();
export function setPreview(g, label) {
  previewEvents.dispatchEvent(new CustomEvent('preview', { detail: { g, label } }));
}

let lastResults = [];

export function renderUpcyclePanel(el) {
  const g = selectedGarment();
  el.innerHTML = `
    <div class="panel-head">
      <h2>Upcycle ideas</h2>
      <p>Pick a piece and tell us your tools. Each idea is worked out from that garment's measurements, fabric and pattern, and your body.</p>
    </div>
    <div class="pick-row">${state.garments
      .map(
        (x) => `<button class="g-mini ${x.id === g?.id ? 'active' : ''}" data-id="${x.id}" title="${x.name}">${flatSVG(x, { width: 44, pad: 5, flaws: false })}<span>${x.name}</span></button>`
      )
      .join('')}</div>
    <section class="sec">
      <h3>Tools you have</h3>
      <div class="tools">${Object.entries(TOOLS)
        .map(([k, t]) => `<label class="tool ${state.tools[k] ? 'on' : ''}"><input type="checkbox" data-tool="${k}" ${state.tools[k] ? 'checked' : ''}/><span>${t.icon}</span>${t.label}</label>`)
        .join('')}</div>
    </section>
    <div id="up-body"></div>
  `;
  el.querySelectorAll('.g-mini').forEach((b) =>
    b.addEventListener('click', () => {
      state.selected = b.dataset.id;
      setPreview(null);
      emit('select');
      renderUpcyclePanel(el);
    })
  );
  el.querySelectorAll('[data-tool]').forEach((cb) =>
    cb.addEventListener('change', () => {
      state.tools[cb.dataset.tool] = cb.checked;
      cb.parentElement.classList.toggle('on', cb.checked);
      emit('tools');
      renderResults(el.querySelector('#up-body'));
    })
  );
  renderResults(el.querySelector('#up-body'));
}

function renderResults(box) {
  const g = selectedGarment();
  if (!g) {
    box.innerHTML = '<p class="muted">Add something to your closet first.</p>';
    return;
  }
  const { ctx, list } = suggest(g, state.body, state.garments, state.tools);
  lastResults = list;
  const fit = fitSummary(ctx);
  const ready = list.filter((r) => !r.missing.length);
  const needs = list.filter((r) => r.missing.length);
  box.innerHTML = `
    <section class="sec fit">
      <h3>How “${g.name}” fits you</h3>
      <div class="fit-meta">${GARMENT_TYPES[g.type].label} · ${MATERIALS[g.material].label} · ${PATTERN_LABELS[g.pattern]}${g.stains ? ' · stain' : ''}${g.holes ? ' · hole' : ''}</div>
      ${fit
        .map(([label, ease, word, cls]) => {
          const pct = Math.max(0, Math.min(100, ((ease + 20) / 60) * 100));
          return `<div class="fit-row"><span class="fl">${label}</span>
          <span class="fbar"><i class="zero"></i><b class="${cls}" style="left:${pct}%"></b></span>
          <span class="fv ${cls}">${ease > 0 ? '+' : ''}${Math.round(ease)} cm · ${word}</span></div>`;
        })
        .join('')}
      <div class="fit-scale"><span>tighter</span><span>body</span><span>looser</span></div>
    </section>
    <section class="sec">
      <h3>${ready.length} idea${ready.length === 1 ? '' : 's'} with your tools</h3>
      <div class="cards">${ready.map((r, i) => card(r, list.indexOf(r))).join('') || '<p class="muted">No ideas fit your tools yet. Try ticking more tools above.</p>'}</div>
    </section>
    ${
      needs.length
        ? `<section class="sec"><h3>Unlock with more tools</h3><div class="cards dim">${needs.map((r) => card(r, list.indexOf(r))).join('')}</div></section>`
        : ''
    }
  `;
  box.querySelectorAll('[data-steps]').forEach((b) => b.addEventListener('click', () => openSheet(lastResults[+b.dataset.steps])));
  box.querySelectorAll('[data-preview]').forEach((b) =>
    b.addEventListener('click', () => {
      const r = lastResults[+b.dataset.preview];
      const after = afterGarment(r);
      if (after) setPreview(after, `${r.project.title} (preview)`);
    })
  );
}

function card(r, i) {
  const p = r.project;
  const hasAfter = !!p.after;
  return `
    <article class="card">
      <header>
        <span class="c-icon">${p.icon}</span>
        <div class="c-title"><h4>${p.title}</h4>
          <div class="c-meta"><span class="dots">${'●'.repeat(p.difficulty)}${'○'.repeat(3 - p.difficulty)}</span> ${['', 'Easy', 'Medium', 'Advanced'][p.difficulty]} · ${p.time}</div>
        </div>
        <span class="c-score" title="Match score"><b>${r.score}</b><small>match</small></span>
      </header>
      <ul class="why">${r.why.map((w) => `<li>${w}</li>`).join('')}</ul>
      ${r.missing.length ? `<div class="missing">Needs: ${r.missing.join(', ')}</div>` : ''}
      <footer>
        <button class="btn small" data-steps="${i}">Step-by-step</button>
        ${hasAfter ? `<button class="btn small ghost" data-preview="${i}">Preview in 3D</button>` : ''}
      </footer>
    </article>`;
}

// ---------------------------------------------------------------- instruction sheet

export function openSheet(r) {
  const overlay = document.getElementById('overlay');
  const sheet = document.getElementById('sheet');
  const p = r.project;
  const g = r.ctx.g;
  let steps;
  try {
    steps = buildSteps(r);
  } catch (e) {
    console.error(e);
    steps = [{ title: 'Oops', text: 'Could not build steps for this garment.', svg: '' }];
  }
  const toolsNeeded = p.needs.map((grp) => grp.map((t) => `${TOOLS[t].icon} ${TOOLS[t].label}`).join(' <i>or</i> ')).join(' · ');
  sheet.innerHTML = `
    <header class="sheet-head">
      <div>
        <div class="eyebrow">${p.icon} Custom plan for “${g.name}”</div>
        <h2>${p.title}</h2>
        <div class="c-meta">${['', 'Easy', 'Medium', 'Advanced'][p.difficulty]} · ${p.time} · ${toolsNeeded}</div>
      </div>
      <div class="sheet-actions">
        ${p.after ? '<button class="btn ghost" id="sh-prev">Preview in 3D</button>' : ''}
        <button class="btn ghost" id="sh-print">Print</button>
        <button class="btn" id="sh-close">Close</button>
      </div>
    </header>
    <ul class="why">${r.why.map((w) => `<li>${w}</li>`).join('')}</ul>
    <div class="legend">
      <span><i class="lg cut"></i>cut</span><span><i class="lg stitch"></i>stitch</span><span><i class="lg fold"></i>fold / guide</span>
      <span><i class="lg remove"></i>cut away</span><span><i class="lg add"></i>new fabric</span>
    </div>
    <ol class="steps">
      ${steps
        .map(
          (s, i) => `<li class="step ${s.svg ? '' : 'nosvg'}">
          ${s.svg ? `<div class="step-fig">${s.svg}</div>` : ''}
          <div class="step-txt"><span class="step-n">${i + 1}</span><h4>${s.title}</h4><p>${s.text}</p></div>
        </li>`
        )
        .join('')}
    </ol><section class="completion-result"><button class="btn" id="sh-complete" ${r.missing.length ? 'disabled' : ''}>${state.progression.completed.includes(g.id + ':' + p.id) ? 'Already completed' : 'I completed this project'}</button><div id="completion-feedback" role="status"></div></section>
  `;
  const completionButton = sheet.querySelector('#sh-complete');
  completionButton.disabled = r.missing.length > 0 || state.progression.completed.includes(g.id + ':' + p.id);
  completionButton.addEventListener('click', () => {
    const result = completeProject(state.progression, g.id + ':' + p.id, new Date(), p.title);
    if (!result) return;
    emit('reward');
    completionButton.disabled = true;
    completionButton.textContent = 'Completed';
    const progress = state.progression, world = WORLDS[progress.theme];
    const community = SCHOOLS.find(s => s.id === progress.communityId);
    const feedback = sheet.querySelector('#completion-feedback');
    feedback.innerHTML = `<h3>+100 XP · +40 ${world.currency}</h3>${progress.communityId ? `<p>+100 XP contributed to your <a href="#/community/schools/${progress.communityId}">${community.name} ${world.community}</a></p>` : '<p><a href="#/community">Join a school community (optional)</a></p>'}<div class="profile-rank ${result.rankUp?'rank-up':''}">${result.rankUp?'<strong>New rank reached!</strong>':''}${rankProgress(progress)}</div>`;
    feedback.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { overlay.hidden = true; }));
    feedback.querySelector('.profile-rank').classList.add('xp-stitch');
    feedback.querySelector('.xp-stitch').dataset.effects=progress.avatar.intensity;
    const nextTier=tierFor(progress.xp)+1;
    feedback.insertAdjacentHTML('beforeend',`<p class="cosmetic-next">${nextTier<8?`${THRESHOLDS[nextTier]-progress.xp} XP to your next free cosmetic: ${ITEM_BY_ID[`${progress.theme}-milestone-${nextTier}`].name}`:'All free rank cosmetics unlocked.'}</p>`);
    if(result.rankUp) import('../avatar/BreakthroughDialog.js').then(({showBreakthrough})=>{if(state.progression===progress)showBreakthrough(progress,result);});
  });
  overlay.hidden = false;
  const close = () => (overlay.hidden = true);
  sheet.querySelector('#sh-close').addEventListener('click', close);
  sheet.querySelector('#sh-print').addEventListener('click', () => window.print());
  sheet.querySelector('#sh-prev')?.addEventListener('click', () => {
    const after = afterGarment(r);
    if (after) setPreview(after, `${p.title} (preview)`);
    close();
  });
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };
}
