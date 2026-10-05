// AI Hub Model Overview — v4 recipe catalog renderer.
// Retains the contributor shell, fonts, styles, selectors, tabs and drawers.
// Contributor prose is text, never executable HTML. Preview requires HTTP.
let CATALOG = null;
let state = { modelId: null, entryId: null, tab: 'config', filters: {} };
const app = document.getElementById('app');

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}
function currentModel() { return CATALOG.models.find(model => model.id === state.modelId); }
function modelEntries() { return CATALOG.entries.filter(entry => entry.model_id === state.modelId); }
function currentView() { return modelEntries().find(entry => entry.id === state.entryId); }
function platformKey(entry) { return `${entry.platform.stack} ${entry.platform.version}`; }
function dimension(entry, key) {
  return key === 'platform' ? platformKey(entry) : key === 'hardware' ? entry.hardware.accelerator_key : entry[key];
}
function matchingEntries() {
  return modelEntries().filter(entry => Object.entries(state.filters).every(([key, value]) => !value || dimension(entry, key) === value));
}
function updateUrl() {
  const url = new URL(location.href);
  url.searchParams.set('model', state.modelId);
  if (state.entryId) url.searchParams.set('entry', state.entryId);
  else url.searchParams.delete('entry');
  history.replaceState(null, '', url);
}
function chooseModel(id, requestedEntry = null) {
  state.modelId = CATALOG.models.some(model => model.id === id) ? id : CATALOG.models[0]?.id;
  state.filters = {};
  const entries = modelEntries();
  state.entryId = entries.find(entry => entry.id === requestedEntry)?.id || entries.find(entry => !entry.blocked)?.id || entries[0]?.id || null;
  state.tab = 'config';
}
function selectFilter(key, value) {
  state.filters[key] = value;
  // Preserve the chosen dimension, relaxing other filters only if necessary.
  for (const other of ['platform', 'hardware', 'scope', 'workload_profile']) {
    if (matchingEntries().length) break;
    if (other !== key) state.filters[other] = '';
  }
  const matches = matchingEntries();
  if (!matches.some(entry => entry.id === state.entryId)) {
    state.entryId = matches.find(entry => !entry.blocked)?.id || matches[0]?.id || null;
  }
  updateUrl(); render();
}
function selector(label, options, selected, change) {
  const row = node('div', null, 'sel-row');
  const title = node('label', label, 'sel-label');
  const select = node('select');
  select.setAttribute('aria-label', label);
  select.dataset.focusKey = `selector:${label}`;
  for (const [value, text] of options) {
    const option = node('option', text);
    option.value = value;
    option.selected = value === selected;
    select.append(option);
  }
  select.addEventListener('change', () => change(select.value));
  row.append(title, select);
  return row;
}
function sourceLink(source, label = 'Source') {
  if (!source) return node('span', 'Source unavailable');
  try {
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsafe URL');
    const link = node('a', label);
    link.href = url.href; link.rel = 'noopener noreferrer';
    return link;
  } catch (_) { return node('span', `${source.path || label} (local preview)`); }
}
function table(headers, rows) {
  const result = node('table', null, 'rht');
  const head = node('thead'), heading = node('tr'), body = node('tbody');
  headers.forEach(text => heading.append(node('th', text)));
  head.append(heading); result.append(head, body);
  for (const row of rows) {
    const tr = node('tr');
    row.forEach(value => tr.append(node('td', value === null || value === undefined ? 'Unknown' : typeof value === 'object' ? JSON.stringify(value) : value)));
    body.append(tr);
  }
  return result;
}
async function copy(body, button, entryId) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(body);
    if (button.isConnected && state.entryId === entryId) button.textContent = 'Copied';
  } catch (_) {
    if (button.isConnected) button.textContent = 'Copy failed — use Download';
  }
}
function download(file) {
  const url = URL.createObjectURL(new Blob([file.body], { type: 'text/plain;charset=utf-8' }));
  const anchor = node('a'); anchor.href = url; anchor.download = file.name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function drawer(name, body, downloadable = true) {
  const details = node('details', null, 'drawer'); details.open = true;
  const summary = node('summary', null, 'drawer__summary'); summary.append(node('strong', name));
  const button = node('button', 'Copy'); button.type = 'button';
  const entryId = state.entryId;
  button.addEventListener('click', event => { event.preventDefault(); copy(body, button, entryId); });
  summary.append(button);
  if (downloadable) {
    const save = node('button', 'Download'); save.type = 'button';
    save.addEventListener('click', event => { event.preventDefault(); download({ name, body }); });
    summary.append(save);
  }
  const code = node('pre', body, 'drawer__code');
  details.append(summary, code); return details;
}
function renderModelCard(model, entry) {
  const card = node('div', null, 'model-card');
  const presentation = model.metadata.presentation || {};
  const icon = node('div', presentation.icon_letter || model.name[0] || '?');
  icon.style.backgroundColor = /^#[a-f0-9]{6}$/i.test(presentation.icon_bg || '') ? presentation.icon_bg : '#4B2E83';
  icon.style.color = '#fff'; icon.style.padding = '18px'; icon.style.borderRadius = '8px';
  const content = node('div'); content.append(node('h1', model.name));
  content.append(node('p', `Provider: ${presentation.provider || model.metadata.huggingface_id?.split('/')[0] || 'Unknown'}`));
  if (entry) {
    content.append(node('p', `Recipe maturity: ${entry.maturity}`));
    if (entry.validation.label) content.append(node('p', entry.validation.label, 'pill--validated'));
    content.append(node('p', `Engine: ${entry.engine.version || 'Unknown'} (${entry.engine.source || 'unresolved'})`));
    if (entry.validation.qualification) content.append(node('p', `${entry.validation.qualification} Tested on ${entry.validation.tested_platform.stack} ${entry.validation.tested_platform.version}.`));
  }
  card.append(icon, content); return card;
}
function renderSelectors() {
  const result = node('div', null, 'selectors');
  result.append(selector('Model', CATALOG.models.map(model => [model.id, model.name]), state.modelId, id => { chooseModel(id); updateUrl(); render(); }));
  const entries = modelEntries();
  for (const [key, label] of [['platform', 'Platform/version'], ['hardware', 'Accelerators'], ['scope', 'Scope'], ['workload_profile', 'Workload']]) {
    const values = [...new Set(entries.map(entry => dimension(entry, key)))].sort();
    if (values.length > 1 || key === 'platform') {
      result.append(selector(label, [['', 'All'], ...values.map(value => [value, value])], state.filters[key] || '', value => selectFilter(key, value)));
    }
  }
  const matches = matchingEntries();
  if (matches.length) result.append(selector('Recipe', matches.map(entry => [entry.id, `${entry.recipe_id} — ${platformKey(entry)}${entry.blocked ? ' (blocked)' : ''}`]), state.entryId, id => { state.entryId = id; updateUrl(); render(); }));
  return result;
}
function renderConfigure(entry) {
  const panel = node('div');
  const inventory = entry.hardware.data.accelerators.count_per_node;
  panel.append(table(['Property', 'Value'], [
    ['Recipe', entry.recipe_id], ['Platform', platformKey(entry)], ['Hardware profile', `${entry.hardware.path} revision ${entry.hardware.revision}`],
    ['Host inventory (per node)', `${inventory} accelerators`], ['Declared serving allocation (per replica)', `${entry.gpu_allocation.declared_gpus_per_replica} GPUs`],
    ['Scope', entry.scope], ['Workload', entry.workload_profile], ['Optimization intent', entry.optimization_intent], ['Image', entry.serving.image],
    ['Image kind', entry.serving.image_usage?.kind || 'Unclassified legacy image'], ['Custom image note', entry.serving.image_usage?.note || null]
  ]));
  panel.append(sourceLink(entry.source, 'Recipe source'), node('p', entry.command_note));
  for (const [role, args] of Object.entries(entry.roles)) {
    if (args.length) { panel.append(node('h2', `${role} arguments`)); panel.append(table(['Flag', 'Value', 'Why'], args.map(arg => [arg.flag, arg.value ?? null, arg.why]))); }
  }
  for (const spec of entry.specs) panel.append(node('p', `${spec.label}: ${spec.state === 'resolved' ? JSON.stringify(spec.value) : 'Unverified source note — inspect final artifacts'} (${spec.source})`));
  for (const artifact of entry.artifacts) {
    panel.append(node('h2', artifact.kinds.join(', ')), sourceLink(artifact.source, 'Artifact source'), drawer(artifact.name, artifact.body));
  }
  return panel;
}
function renderBenchmark(entry) {
  const panel = node('div');
  if (!entry.evidence.length) { panel.append(node('div', 'No committed benchmark evidence for this recipe', 'banner')); return panel; }
  for (const item of entry.evidence) {
    panel.append(node('h2', `Original run: ${item.run.run_id}`), sourceLink(item.source, 'Run source'), sourceLink(item.result_source, 'Result source'));
    const environment = item.run.environment || {};
    panel.append(table(['Original run attribution', 'Value'], [
      ['Platform', environment.platform ? `${environment.platform.stack} ${environment.platform.version}` : null],
      ['Engine', environment.vllm_version], ['Image', environment.image],
      ['Hardware profile', item.run.hardware_profile], ['Profile revision when tested', item.run.hardware_profile_revision],
      ['Scope', item.run.deployment_scope]
    ]));
    if (entry.validation.run_id !== item.run.run_id) panel.append(node('p', 'Historical evidence for this recipe; equivalence to the selected serving configuration has not been established.'));
    panel.append(table(['Metric', 'Value / explicit units and statistics'], Object.entries(item.result.metrics)));
    if (item.run.command) panel.append(drawer('benchmark-command.sh', item.run.command));
    panel.append(drawer('run.yaml', item.run_body), drawer('result.json', item.result_body));
  }
  return panel;
}
function renderNotes(entry, quickstart = false) {
  const panel = node('div');
  if (!entry.notes) return node('p', 'No optional notes supplied.');
  panel.append(sourceLink(entry.notes_source, 'Notes source'));
  panel.append(node('p', 'Contributor notes are source prose, not measured benchmark evidence; final deployment artifacts remain authoritative.'));
  if (quickstart) {
    for (const step of entry.notes.quickstart || []) panel.append(node('h2', step.step), node('p', step.detail));
  } else {
    panel.append(drawer('recipe-notes.json', JSON.stringify(entry.notes, null, 2)));
  }
  return panel;
}
function renderTabs(entry) {
  const tabs = [['config', 'Configure'], ['bench', 'Benchmark']];
  if (entry.notes?.quickstart?.length) tabs.unshift(['start', 'Quick start']);
  if (entry.notes) tabs.push(['notes', 'Notes']);
  if (!tabs.some(([id]) => id === state.tab)) state.tab = 'config';
  const result = node('div', null, 'tabs');
  for (const [id, label] of tabs) {
    const button = node('button', label, `tab${state.tab === id ? ' tab--active' : ''}`);
    button.dataset.focusKey = `tab:${id}`;
    button.addEventListener('click', () => { state.tab = id; render(); }); result.append(button);
  }
  return result;
}
function render() {
  const focusKey = app.contains(document.activeElement) ? document.activeElement.dataset.focusKey : null;
  function restoreFocus() {
    if (!focusKey) return;
    const controls = [...app.querySelectorAll('[data-focus-key]')];
    // A removed tab returns to Configure; a removed selector returns to Recipe
    // or Model. Do not steal focus on initial load or from outside the app.
    const target = controls.find(control => control.dataset.focusKey === focusKey)
      || (focusKey.startsWith('tab:') && controls.find(control => control.dataset.focusKey === 'tab:config'))
      || controls.find(control => control.dataset.focusKey === 'selector:Recipe')
      || controls.find(control => control.dataset.focusKey === 'selector:Model');
    if (target) target.focus({ preventScroll: true });
    else { app.tabIndex = -1; app.focus({ preventScroll: true }); }
  }
  app.replaceChildren();
  if (!CATALOG.models.length) { app.append(node('div', 'No models are available.', 'banner')); restoreFocus(); return; }
  const model = currentModel(), entry = currentView();
  const layout = node('div'); layout.style.cssText = 'padding:24px 40px;max-width:1100px;margin:0 auto;width:100%';
  layout.append(node('div', `AI Hub / Models / Catalog / ${model.name}`, 'crumb'), renderModelCard(model, entry), renderSelectors());
  if (!entry) layout.append(node('div', 'No recipes match this model and selection.', 'banner'));
  else if (entry.blocked) layout.append(node('div', entry.reason || 'This platform entry is blocked.', 'banner--pending'));
  else {
    layout.append(renderTabs(entry));
    const panel = node('div', null, 'panel');
    panel.append(state.tab === 'bench' ? renderBenchmark(entry) : state.tab === 'notes' ? renderNotes(entry) : state.tab === 'start' ? renderNotes(entry, true) : renderConfigure(entry));
    layout.append(panel);
  }
  layout.append(node('p', `Build: ${CATALOG.build.source_sha || 'local'}${CATALOG.build.dirty ? ' — uncommitted local preview' : ''}`));
  app.append(layout);
  restoreFocus();
}
async function boot() {
  try {
    const response = await fetch('./catalog.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    CATALOG = await response.json();
    if (CATALOG.schema_version !== 2 || !Array.isArray(CATALOG.models) || !Array.isArray(CATALOG.entries)) throw new Error('Unsupported catalog contract');
    const query = new URLSearchParams(location.search);
    chooseModel(query.get('model'), query.get('entry')); render();
    window.addEventListener('popstate', () => { const params = new URLSearchParams(location.search); chooseModel(params.get('model'), params.get('entry')); render(); });
  } catch (error) { app.replaceChildren(node('div', `Failed to load catalog: ${error.message}. Preview the generated site over HTTP, not file://.`, 'banner')); }
}
document.addEventListener('DOMContentLoaded', boot);
