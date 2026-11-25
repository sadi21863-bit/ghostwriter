/**
 * PLAN-v5 step 2 — the THIN SHELL. Three static assets served by the loopback
 * host at `/`, `/app.js`, `/app.css`: Write (manuscript editor), Bible
 * (characters + locations), Settings (provider picker). No framework, no new
 * dependencies, no build step — the plan's "three views only" cut, verbatim.
 *
 * Auth model: the assets themselves are static and unauthenticated (a browser
 * must be able to load them); EVERY data route they call stays behind the
 * per-launch owner bearer. The shell asks for the token at boot and keeps it
 * in sessionStorage only.
 *
 * Deliberate omissions (the v5 cut): no generation UI yet (the provider
 * reality check is step 3), no shell-side canon mutation (step 4's accept/
 * reject loop), no graph/timeline/plan/Doctor views (Doctor lands in step 5
 * as its own surface only if the story needs it).
 */

export interface LocalShellAsset {
  readonly contentType: string;
  readonly body: string;
}

const SHELL_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ghostwriter — local</title>
<link rel="stylesheet" href="/app.css">
</head>
<body>
<div id="gate" class="gate" hidden>
  <form id="gate-form" class="gate-card">
    <h1>Ghostwriter</h1>
    <p class="muted">Paste the owner token printed by the local host at launch.</p>
    <input id="gate-token" type="password" autocomplete="off" spellcheck="false" placeholder="owner token" required>
    <button type="submit">Connect</button>
    <p id="gate-error" class="error" hidden></p>
  </form>
</div>

<div id="app" hidden>
  <header>
    <div class="brand">Ghostwriter <span class="muted" id="host-label"></span></div>
    <nav>
      <button data-view="write" class="tab active">Write</button>
      <button data-view="bible" class="tab">Bible</button>
      <button data-view="settings" class="tab">Settings</button>
    </nav>
    <div class="right">
      <span id="status" class="status"></span>
      <button id="disconnect" class="link">Disconnect</button>
    </div>
  </header>

  <main>
    <!-- ── Write ─────────────────────────────────────────────── -->
    <section id="view-write" class="view">
      <aside class="sidebar">
        <div class="row">
          <h2>Projects</h2>
          <button id="new-project" class="small">+ New</button>
        </div>
        <ul id="project-list" class="list"></ul>
      </aside>
      <section class="pane">
        <div id="write-empty" class="empty">Pick a project to start writing.</div>
        <div id="write-pane" hidden>
          <div class="row">
            <h2 id="write-title"></h2>
            <span id="save-state" class="muted"></span>
          </div>
          <div id="chapter-tabs" class="chapter-tabs"></div>
          <textarea id="editor" spellcheck="false" placeholder="Start writing…"></textarea>
          <div class="row footer">
            <span id="word-count" class="muted"></span>
            <span class="muted">Ctrl+S saves now · auto-save after 1.2s idle</span>
          </div>
        </div>
      </section>
    </section>

    <!-- ── Bible ─────────────────────────────────────────────── -->
    <section id="view-bible" class="view" hidden>
      <aside class="sidebar">
        <div class="row">
          <h2>Bible</h2>
        </div>
        <label class="field">
          <span>Project</span>
          <select id="bible-project"></select>
        </label>
        <div class="row section-head"><h3>Characters</h3><button id="new-character" class="small">+ Add</button></div>
        <ul id="character-list" class="list"></ul>
        <div class="row section-head"><h3>Locations</h3><button id="new-location" class="small">+ Add</button></div>
        <ul id="location-list" class="list"></ul>
      </aside>
      <section class="pane">
        <div id="bible-empty" class="empty">Pick a character or location to edit its entry.</div>
        <form id="bible-form" class="entity-form" hidden>
          <div class="row">
            <h2 id="entity-title"></h2>
            <button type="button" id="delete-entity" class="danger small">Delete</button>
          </div>
          <div id="entity-fields"></div>
          <div class="row">
            <button type="submit">Propose changes</button>
            <span id="entity-state" class="muted"></span>
          </div>
          <div id="proposal" class="proposal" hidden>
            <h3>Pending changes — nothing is saved until you accept</h3>
            <div id="proposal-rows"></div>
            <p id="proposal-excluded" class="muted" hidden></p>
            <div class="row">
              <button type="button" id="accept-proposal">Accept</button>
              <button type="button" id="reject-proposal">Reject</button>
            </div>
          </div>
        </form>
      </section>
    </section>

    <!-- ── Settings ──────────────────────────────────────────── -->
    <section id="view-settings" class="view" hidden>
      <section class="pane wide">
        <h2>Provider</h2>
        <p class="muted">Saved to <code>local-settings.json</code> next to the database. Restart the host to apply — the generation bundle is composed at boot.</p>
        <form id="settings-form" class="settings-form">
          <label class="field">
            <span>Provider</span>
            <select id="settings-provider">
              <option value="off">Off — no generation</option>
              <option value="auto">Auto — detected localhost (Ollama / LM Studio)</option>
              <option value="generic">Generic — OpenAI-compatible endpoint</option>
              <option value="anthropic">Anthropic — Claude API key</option>
            </select>
          </label>
          <label class="field">
            <span>Model</span>
            <input id="settings-model" type="text" spellcheck="false" placeholder="e.g. llama3.2:3b or claude-sonnet-4-5">
          </label>
          <label class="field">
            <span>Endpoint URL (generic only)</span>
            <input id="settings-endpoint" type="text" spellcheck="false" placeholder="http://127.0.0.1:8080/v1">
          </label>
          <div class="row">
            <button type="submit">Save settings</button>
            <span id="settings-state" class="muted"></span>
          </div>
        </form>
        <h2>This host</h2>
        <div id="settings-info" class="info"></div>
      </section>
    </section>
  </main>
</div>
<script src="/app.js"></script>
</body>
</html>`;

const SHELL_CSS = `:root {
  color-scheme: dark;
  --bg: #14161a;
  --panel: #1b1e24;
  --panel-2: #22262e;
  --line: #2e333d;
  --text: #e6e9ef;
  --muted: #8b93a1;
  --accent: #7aa2f7;
  --danger: #f7768e;
  --ok: #9ece6a;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.5 "Segoe UI", system-ui, -apple-system, sans-serif;
}
h1, h2, h3 { margin: 0; font-weight: 600; }
h1 { font-size: 20px; }
h2 { font-size: 16px; }
h3 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
button {
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px 12px;
  font: inherit;
  cursor: pointer;
}
button:hover { border-color: var(--accent); }
button.small { padding: 3px 9px; font-size: 13px; }
button.link { background: none; border: none; color: var(--muted); cursor: pointer; }
button.link:hover { color: var(--text); }
button.danger { color: var(--danger); }
input, select, textarea {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px 10px;
  font: inherit;
  width: 100%;
}
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); }
.muted { color: var(--muted); font-size: 13px; }
.error { color: var(--danger); font-size: 13px; }
.gate {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}
.gate-card {
  width: 380px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 26px;
}
#app { display: flex; flex-direction: column; height: 100%; }
header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 18px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
}
.brand { font-weight: 700; letter-spacing: .01em; }
nav { display: flex; gap: 4px; }
.tab {
  background: none;
  border: 1px solid transparent;
  color: var(--muted);
  padding: 5px 12px;
}
.tab.active { color: var(--text); border-color: var(--line); background: var(--panel-2); }
.right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.status { font-size: 13px; color: var(--muted); }
main { flex: 1; min-height: 0; }
.view { display: flex; height: 100%; min-height: 0; }
.sidebar {
  width: 290px;
  border-right: 1px solid var(--line);
  padding: 14px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pane { flex: 1; padding: 18px 22px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; min-height: 0; }
.pane.wide { max-width: 720px; margin: 0 auto; width: 100%; }
.row { display: flex; align-items: center; gap: 10px; }
.row.footer { justify-content: space-between; }
.section-head { margin-top: 10px; }
.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.list li {
  padding: 7px 9px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.list li:hover { background: var(--panel-2); }
.list li.active { background: var(--panel-2); border: 1px solid var(--line); }
.list li .meta { color: var(--muted); font-size: 12px; }
.empty { color: var(--muted); margin: auto; }
.chapter-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.chapter-tabs button { padding: 4px 10px; font-size: 13px; }
.chapter-tabs button.active { border-color: var(--accent); color: var(--accent); }
#editor {
  flex: 1;
  min-height: 300px;
  resize: none;
  font: 16px/1.7 Georgia, "Times New Roman", serif;
  background: var(--panel);
}
.field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.field > span { font-size: 13px; color: var(--muted); }
.entity-form { max-width: 640px; display: flex; flex-direction: column; gap: 4px; }
.entity-form textarea { min-height: 90px; resize: vertical; }
.settings-form { display: flex; flex-direction: column; }
.proposal {
  margin-top: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--panel);
}
.proposal h3 { margin-bottom: 8px; }
.proposal-row { padding: 4px 0; font-size: 14px; }
.proposal-row .old { color: var(--danger); text-decoration: line-through; }
.proposal-row .new { color: var(--ok); }
.info { display: flex; flex-direction: column; gap: 8px; }
.info .card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 12px 14px;
}
.info code { color: var(--accent); }
.ok { color: var(--ok); }
`;

const SHELL_JS = `"use strict";
// PLAN-v5 step 2 — the thin shell's entire client logic. Vanilla JS, no build.
(function () {
  var TOKEN_KEY = "gw.local.token";
  var PROJECT_KEY = "gw.local.project";
  var state = {
    token: null,
    projects: [],
    projectId: null,
    graph: null,
    chapterId: null,
    view: "write",
    entity: null, // { kind: "character"|"location", id }
    proposal: null, // PLAN-v5 step 4 — the pending change set (never canon)
    settings: {},
    providerInfo: null,
    saveTimer: null,
  };

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function status(msg) { $("status").textContent = msg || ""; }

  function api(path, opts) {
    opts = opts || {};
    var headers = { "content-type": "application/json" };
    if (state.token) headers.authorization = "Bearer " + state.token;
    return fetch(path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
        if (res.status === 401) {
          forgetToken();
          throw new Error("The host rejected the token.");
        }
        if (!res.ok || (data && data.ok === false)) {
          throw new Error((data && (data.reason || data.error)) || ("HTTP " + res.status));
        }
        return data;
      });
    });
  }

  function forgetToken() {
    state.token = null;
    sessionStorage.removeItem(TOKEN_KEY);
    $("app").hidden = true;
    $("gate").hidden = false;
    $("gate-token").value = "";
  }

  function applyToken(token) {
    state.token = token;
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  // ── Projects / Write ──────────────────────────────────────────
  function loadProjects() {
    return api("/projects").then(function (data) {
      state.projects = (data.projects || []).map(function (p) {
        return { id: p.id, name: p.name, format: p.format, chapters: p.chapters || [] };
      });
      var saved = localStorage.getItem(PROJECT_KEY);
      if (!state.projectId && saved && state.projects.some(function (p) { return p.id === saved; })) {
        state.projectId = saved;
      }
      renderProjectList();
      renderBibleProjectSelect();
      if (state.projectId) return selectProject(state.projectId);
      return null;
    });
  }

  function renderProjectList() {
    var ul = $("project-list");
    ul.innerHTML = "";
    state.projects.forEach(function (p) {
      var li = document.createElement("li");
      if (p.id === state.projectId) li.className = "active";
      li.innerHTML = '<span>' + esc(p.name) + '</span><span class="meta">' + esc(p.format || "") + "</span>";
      li.addEventListener("click", function () { selectProject(p.id); });
      ul.appendChild(li);
    });
  }

  function renderBibleProjectSelect() {
    var sel = $("bible-project");
    sel.innerHTML = "";
    state.projects.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === state.projectId) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function selectProject(id) {
    state.projectId = id;
    localStorage.setItem(PROJECT_KEY, id);
    state.entity = null;
    state.proposal = null;
    return api("/projects/" + encodeURIComponent(id)).then(function (data) {
      state.graph = data.project;
      state.chapterId = state.graph.chapters && state.graph.chapters.length ? state.graph.chapters[0].id : null;
      renderProjectList();
      renderBibleProjectSelect();
      renderWrite();
      renderBible();
    });
  }

  function chapterById(id) {
    return (state.graph && state.graph.chapters || []).filter(function (c) { return c.id === id; })[0] || null;
  }

  function renderWrite() {
    if (!state.graph) {
      $("write-empty").hidden = false;
      $("write-pane").hidden = true;
      return;
    }
    $("write-empty").hidden = true;
    $("write-pane").hidden = false;
    $("write-title").textContent = state.graph.name || "Untitled";
    var tabs = $("chapter-tabs");
    tabs.innerHTML = "";
    (state.graph.chapters || []).forEach(function (c) {
      var b = document.createElement("button");
      b.textContent = c.title || "Chapter";
      if (c.id === state.chapterId) b.className = "active";
      b.addEventListener("click", function () {
        flushSave();
        state.chapterId = c.id;
        renderWrite();
      });
      tabs.appendChild(b);
    });
    var chapter = chapterById(state.chapterId);
    $("editor").value = chapter ? chapter.content || "" : "";
    $("save-state").textContent = "";
    renderWordCount();
  }

  function renderWordCount() {
    var words = ($("editor").value || "").trim().split(/\\s+/).filter(Boolean).length;
    $("word-count").textContent = words + " word" + (words === 1 ? "" : "s");
  }

  function scheduleSave() {
    $("save-state").textContent = "unsaved…";
    if (state.saveTimer) clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(function () { flushSave(); }, 1200);
  }

  function flushSave() {
    if (state.saveTimer) { clearTimeout(state.saveTimer); state.saveTimer = null; }
    if (!state.projectId || !state.chapterId) return Promise.resolve();
    var chapter = chapterById(state.chapterId);
    if (!chapter) return Promise.resolve();
    var content = $("editor").value;
    if (content === (chapter.content || "")) { $("save-state").textContent = ""; return Promise.resolve(); }
    $("save-state").textContent = "saving…";
    return api("/projects/" + encodeURIComponent(state.projectId) + "/chapters/" + encodeURIComponent(state.chapterId), {
      method: "PATCH",
      body: { patch: { content: content } },
    }).then(function (data) {
      chapter.content = content;
      if (data && data.chapter && typeof data.chapter.wordCount === "number") chapter.wordCount = data.chapter.wordCount;
      $("save-state").textContent = "saved";
      status("");
    }).catch(function (err) {
      $("save-state").textContent = "save failed";
      status("Save failed: " + err.message);
    });
  }

  // ── Bible ─────────────────────────────────────────────────────
  var CHARACTER_FIELDS = [
    { key: "name", label: "Name", type: "text" },
    { key: "role", label: "Role", type: "text" },
    { key: "personality", label: "Personality", type: "textarea" },
    { key: "backstory", label: "Backstory", type: "textarea" },
  ];
  var LOCATION_FIELDS = [
    { key: "name", label: "Name", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "atmosphere", label: "Atmosphere", type: "textarea" },
  ];

  function entityList(kind) {
    return (state.graph && state.graph[kind === "character" ? "characters" : "locations"]) || [];
  }

  function renderBible() {
    ["character", "location"].forEach(function (kind) {
      var ul = $(kind + "-list");
      ul.innerHTML = "";
      entityList(kind).forEach(function (e) {
        var li = document.createElement("li");
        if (state.entity && state.entity.kind === kind && state.entity.id === e.id) li.className = "active";
        li.innerHTML = '<span>' + esc(e.name) + '</span>' +
          (kind === "character" && e.role ? '<span class="meta">' + esc(e.role) + "</span>" : "");
        li.addEventListener("click", function () { selectEntity(kind, e.id); });
        ul.appendChild(li);
      });
    });
    renderEntityForm();
  }

  function selectEntity(kind, id) {
    state.entity = { kind: kind, id: id };
    state.proposal = null;
    renderBible();
  }

  function selectedEntity() {
    if (!state.entity) return null;
    return entityList(state.entity.kind).filter(function (e) { return e.id === state.entity.id; })[0] || null;
  }

  function renderEntityForm() {
    var form = $("bible-form");
    var entity = selectedEntity();
    if (!entity) { form.hidden = true; $("bible-empty").hidden = false; return; }
    var fields = state.entity.kind === "character" ? CHARACTER_FIELDS : LOCATION_FIELDS;
    $("bible-empty").hidden = true;
    form.hidden = false;
    $("entity-title").textContent = (state.entity.kind === "character" ? "Character — " : "Location — ") + (entity.name || "Untitled");
    var host = $("entity-fields");
    host.innerHTML = "";
    fields.forEach(function (f) {
      var label = document.createElement("label");
      label.className = "field";
      var span = document.createElement("span");
      span.textContent = f.label;
      var input;
      if (f.type === "textarea") {
        input = document.createElement("textarea");
        input.value = entity[f.key] || "";
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.value = entity[f.key] || "";
      }
      input.dataset.key = f.key;
      label.appendChild(span);
      label.appendChild(input);
      host.appendChild(label);
    });
    renderProposal();
  }

  function newEntity(kind) {
    if (!state.graph) { status("Pick a project first."); return; }
    var name = prompt(kind === "character" ? "Character name" : "Location name");
    if (!name) return;
    api("/projects/" + encodeURIComponent(state.projectId) + "/" + kind + "s", {
      method: "POST",
      body: { name: name },
    }).then(function (data) {
      var created = data[kind] || data.character || data.location;
      return selectProject(state.projectId).then(function () {
        if (created) selectEntity(kind, created.id);
      });
    }).catch(function (err) { status("Create failed: " + err.message); });
  }

  // ── Accept / reject (PLAN-v5 step 4) ────────────────────────
  // Nothing here writes canonical state until Accept. Propose asks the server
  // for the exact user-edit transaction the shared builder would produce
  // (old→new per changed field); Accept records + applies it; Reject only
  // forgets the draft.
  function proposeEntity() {
    var entity = selectedEntity();
    if (!entity) return;
    var kind = state.entity.kind;
    var entityKey = kind === "character" ? "characters" : "locations";
    var fields = kind === "character" ? CHARACTER_FIELDS : LOCATION_FIELDS;
    var draft = {};
    fields.forEach(function (f) {
      var input = document.querySelector('#entity-fields [data-key="' + f.key + '"]');
      draft[f.key] = input ? input.value : "";
    });
    $("entity-state").textContent = "computing diff…";
    api("/projects/" + encodeURIComponent(state.projectId) + "/entity-proposals", {
      method: "POST",
      body: { entityKey: entityKey, entity: entity, draft: draft },
    }).then(function (data) {
      state.proposal = data.proposal;
      $("entity-state").textContent = "";
      renderProposal();
    }).catch(function (err) {
      $("entity-state").textContent = "propose failed";
      status("Propose failed: " + err.message);
    });
  }

  function renderProposal() {
    var panel = $("proposal");
    var rows = $("proposal-rows");
    var p = state.proposal;
    if (!p) { panel.hidden = true; rows.innerHTML = ""; $("proposal-excluded").hidden = true; return; }
    panel.hidden = false;
    rows.innerHTML = "";
    if (!p.changes.length) {
      rows.innerHTML = '<p class="muted">No changes to propose.</p>';
    } else {
      p.changes.forEach(function (c) {
        var div = document.createElement("div");
        div.className = "proposal-row";
        div.innerHTML = "<strong>" + esc(c.field) + "</strong>: " +
          '<span class="old">' + esc(c.oldValue || "(empty)") + "</span> → " +
          '<span class="new">' + esc(c.newValue || "(empty)") + "</span>";
        rows.appendChild(div);
      });
    }
    var excluded = p.excluded ? Object.keys(p.excluded) : [];
    var ex = $("proposal-excluded");
    ex.hidden = excluded.length === 0;
    ex.textContent = excluded.length
      ? excluded.length + " field(s) are outside the transaction allowlist and will not be written: " + excluded.join(", ")
      : "";
  }

  function acceptProposal() {
    var p = state.proposal;
    if (!p || !p.changes.length) return;
    $("entity-state").textContent = "accepting…";
    api("/projects/" + encodeURIComponent(state.projectId) + "/story-transactions", {
      method: "POST",
      body: { source: "user-edit", changes: p.changes },
    }).then(function () {
      state.proposal = null;
      return selectProject(state.projectId).then(function () {
        $("entity-state").textContent = "accepted";
      });
    }).catch(function (err) {
      $("entity-state").textContent = "accept failed";
      status("Accept failed: " + err.message);
    });
  }

  function rejectProposal() {
    state.proposal = null;
    $("entity-state").textContent = "rejected — canon untouched";
    renderEntityForm();
  }

  function deleteEntity() {
    var entity = selectedEntity();
    if (!entity) return;
    if (!confirm("Delete " + (entity.name || "this entry") + "?")) return;
    api("/projects/" + encodeURIComponent(state.projectId) + "/" + state.entity.kind + "s/" + encodeURIComponent(entity.id), {
      method: "DELETE",
    }).then(function () {
      state.entity = null;
      return selectProject(state.projectId);
    }).catch(function (err) { status("Delete failed: " + err.message); });
  }

  // ── Settings ──────────────────────────────────────────────────
  function loadSettings() {
    return Promise.all([
      api("/settings").catch(function () { return { settings: {} }; }),
      api("/providers").catch(function () { return null; }),
    ]).then(function (results) {
      state.settings = results[0] && results[0].settings ? results[0].settings : {};
      state.providerInfo = results[1];
      renderSettings();
    });
  }

  function renderSettings() {
    $("settings-provider").value = state.settings.provider || "off";
    $("settings-model").value = state.settings.model || "";
    $("settings-endpoint").value = state.settings.endpointUrl || "";
    var info = $("settings-info");
    info.innerHTML = "";
    var p = state.providerInfo;
    if (!p) { info.innerHTML = '<div class="card muted">Provider status unavailable.</div>'; return; }
    var detected = p.detected || [];
    function card(title, rows) {
      var div = document.createElement("div");
      div.className = "card";
      div.innerHTML = "<strong>" + esc(title) + "</strong>" +
        rows.map(function (r) { return '<div class="muted">' + r + "</div>"; }).join("");
      info.appendChild(div);
    }
    card("Detected localhost providers", detected.length
      ? detected.map(function (d) {
          return esc(d.label) + " — <code>" + esc(d.baseUrl) + "</code> (" + esc((d.models || []).join(", ")) + ")";
        })
      : ["None detected (start Ollama or LM Studio, then reload)."]);
    var kp = p.keyPresence || {};
    card("API keys present", [
      "anthropic: " + (kp.anthropic ? '<span class="ok">yes</span>' : "no") +
      " · openai: " + (kp.openai ? '<span class="ok">yes</span>' : "no") +
      " · segmind: " + (kp.segmind ? '<span class="ok">yes</span>' : "no"),
    ]);
    var routing = p.routing || {};
    card("Saved routing", [
      "provider: <code>" + esc(routing.provider || "unset") + "</code> · models: " +
        esc([routing.models && routing.models.default, routing.models && routing.models.fast, routing.models && routing.models.quality].filter(Boolean).join(", ") || "unset"),
    ]);
  }

  function saveSettings() {
    $("settings-state").textContent = "saving…";
    api("/settings", {
      method: "POST",
      body: {
        provider: $("settings-provider").value,
        model: $("settings-model").value.trim(),
        endpointUrl: $("settings-endpoint").value.trim(),
      },
    }).then(function (data) {
      state.settings = data.settings || {};
      $("settings-state").textContent = "saved — restart the host to apply";
    }).catch(function (err) {
      $("settings-state").textContent = "save failed";
      status("Settings failed: " + err.message);
    });
  }

  // ── Wiring ────────────────────────────────────────────────────
  function showView(name) {
    state.view = name;
    ["write", "bible", "settings"].forEach(function (v) {
      $("view-" + v).hidden = v !== name;
    });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
      t.classList.toggle("active", t.getAttribute("data-view") === name);
    });
    if (name === "settings") loadSettings();
  }

  function boot() {
    var saved = sessionStorage.getItem(TOKEN_KEY);
    $("host-label").textContent = location.origin;
    if (!saved) { $("gate").hidden = false; return; }
    state.token = saved;
    api("/providers").then(function () {
      $("gate").hidden = true;
      $("app").hidden = false;
      return loadProjects();
    }).catch(function () {
      forgetToken();
    });
  }

  $("gate-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var token = $("gate-token").value.trim();
    if (!token) return;
    var probe = fetch("/providers", { headers: { authorization: "Bearer " + token } });
    probe.then(function (res) {
      if (res.status === 401) throw new Error("That token was rejected.");
      applyToken(token);
      $("gate-error").hidden = true;
      $("gate-token").value = "";
      boot();
    }).catch(function (err) {
      $("gate-error").hidden = false;
      $("gate-error").textContent = err.message || "Connection failed.";
    });
  });

  $("disconnect").addEventListener("click", function () {
    forgetToken();
  });

  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) {
    t.addEventListener("click", function () { showView(t.getAttribute("data-view")); });
  });

  $("new-project").addEventListener("click", function () {
    var name = prompt("Project name");
    if (!name) return;
    api("/projects", { method: "POST", body: { name: name } }).then(function (data) {
      var project = data.project;
      return loadProjects().then(function () {
        if (project && project.id) return selectProject(project.id);
      });
    }).catch(function (err) { status("Create failed: " + err.message); });
  });

  $("editor").addEventListener("input", function () { renderWordCount(); scheduleSave(); });
  $("editor").addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); flushSave(); }
  });
  window.addEventListener("beforeunload", function () { flushSave(); });

  $("bible-project").addEventListener("change", function (e) {
    if (e.target.value) selectProject(e.target.value);
  });
  $("new-character").addEventListener("click", function () { newEntity("character"); });
  $("new-location").addEventListener("click", function () { newEntity("location"); });
  $("bible-form").addEventListener("submit", function (e) { e.preventDefault(); proposeEntity(); });
  $("accept-proposal").addEventListener("click", acceptProposal);
  $("reject-proposal").addEventListener("click", rejectProposal);
  $("delete-entity").addEventListener("click", deleteEntity);
  $("settings-form").addEventListener("submit", function (e) { e.preventDefault(); saveSettings(); });

  boot();
})();
`;

export const LOCAL_SHELL_FILES: Readonly<Record<string, LocalShellAsset>> = {
  // Root — the trimmed request path for "/" is "".
  "": { contentType: "text/html; charset=utf-8", body: SHELL_HTML },
  "app.js": { contentType: "text/javascript; charset=utf-8", body: SHELL_JS },
  "app.css": { contentType: "text/css; charset=utf-8", body: SHELL_CSS },
};
