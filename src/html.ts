export function renderGalaxyHtml(dataPath: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Hyperspell Knowledge Galaxy</title>
  <style>
    :root {
      --bg0: #070b17;
      --bg1: #0f1733;
      --bg2: #1a1c3d;
      --ink: #d8e3ff;
      --muted: #8ea0cf;
      --accent: #51d7ff;
      --image: #ffb84d;
      --ok: #53e38a;
      --warn: #f4c74f;
      --bad: #ff6f7d;
      --panel: rgba(7, 12, 26, 0.72);
      --edge: rgba(120, 166, 255, 0.34);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      color: var(--ink);
      font-family: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
      background: radial-gradient(120% 120% at 75% 15%, var(--bg2) 0%, var(--bg1) 45%, var(--bg0) 100%);
    }
    #stage {
      position: fixed;
      inset: 0;
    }
    .hud {
      position: fixed;
      left: 16px;
      right: 16px;
      top: 16px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      pointer-events: none;
      z-index: 20;
    }
    .chip {
      padding: 8px 10px;
      border-radius: 999px;
      background: var(--panel);
      border: 1px solid rgba(145, 178, 255, 0.28);
      backdrop-filter: blur(6px);
      font-size: 12px;
      letter-spacing: 0.01em;
    }
    .chip b { color: #fff; font-weight: 700; }
    .panel {
      position: fixed;
      width: 330px;
      max-height: calc(100% - 32px);
      right: 16px;
      top: 16px;
      padding: 12px;
      overflow: auto;
      border-radius: 14px;
      background: var(--panel);
      border: 1px solid rgba(145, 178, 255, 0.28);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
      z-index: 25;
    }
    .panel h2 {
      margin: 0 0 8px;
      font-size: 15px;
      letter-spacing: 0.02em;
      color: #f3f6ff;
    }
    .mini {
      margin-top: 10px;
      border-top: 1px solid rgba(145, 178, 255, 0.2);
      padding-top: 8px;
    }
    .list {
      margin: 0;
      padding-left: 16px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .row { margin: 5px 0; font-size: 12px; color: var(--muted); }
    .row b { color: var(--ink); }
    .warn {
      margin-top: 8px;
      padding: 8px;
      border-radius: 10px;
      border: 1px solid rgba(255, 184, 77, 0.45);
      background: rgba(255, 184, 77, 0.12);
      color: #ffd9a1;
      font-size: 12px;
      line-height: 1.35;
    }
    .filters {
      position: fixed;
      left: 16px;
      bottom: 16px;
      width: min(640px, calc(100% - 32px));
      background: var(--panel);
      border: 1px solid rgba(145, 178, 255, 0.28);
      border-radius: 14px;
      padding: 10px;
      z-index: 26;
      backdrop-filter: blur(6px);
    }
    .controls {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }
    label {
      font-size: 11px;
      color: var(--muted);
      display: block;
      margin-bottom: 4px;
    }
    select, input[type="range"], button {
      width: 100%;
      border-radius: 10px;
      border: 1px solid rgba(145, 178, 255, 0.28);
      background: rgba(10, 14, 29, 0.9);
      color: var(--ink);
      padding: 7px 8px;
      font-size: 12px;
    }
    button { cursor: pointer; background: rgba(22, 31, 58, 0.95); }
    .timeline {
      margin-top: 10px;
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 8px;
      align-items: center;
    }
    .ghost {
      background: rgba(22, 31, 58, 0.65);
    }
    .ghost.active {
      border-color: rgba(255, 184, 77, 0.65);
      box-shadow: inset 0 0 0 1px rgba(255, 184, 77, 0.45);
      background: rgba(255, 184, 77, 0.16);
      color: #ffe1ad;
    }
    .scroller {
      max-height: 170px;
      overflow: auto;
      padding-right: 6px;
    }
    #tooltip {
      position: fixed;
      pointer-events: none;
      transform: translate(10px, 10px);
      padding: 7px 9px;
      border-radius: 8px;
      background: rgba(6, 10, 24, 0.92);
      border: 1px solid rgba(145, 178, 255, 0.28);
      font-size: 11px;
      color: #dfe8ff;
      z-index: 40;
      display: none;
      max-width: 260px;
    }
    @media (max-width: 900px) {
      .panel { width: calc(100% - 32px); max-height: 32%; top: auto; bottom: 132px; }
      .controls { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <canvas id="stage"></canvas>
  <div id="tooltip"></div>
  <div class="hud" id="hud"></div>
  <aside class="panel">
    <h2>Inspector</h2>
    <div id="inspector" class="row">Click a node to inspect memory details.</div>
    <div class="mini">
      <h2>Data Snapshot</h2>
      <div id="summary" class="row">Loading memory summary...</div>
    </div>
  </aside>
  <section class="filters">
    <div class="controls">
      <div>
        <label for="sourceFilter">Source</label>
        <select id="sourceFilter"><option value="all">All sources</option></select>
      </div>
      <div>
        <label for="statusFilter">Status</label>
        <select id="statusFilter">
          <option value="all">All statuses</option>
          <option value="completed">completed</option>
          <option value="processing">processing</option>
          <option value="pending">pending</option>
          <option value="failed">failed</option>
          <option value="pending_review">pending_review</option>
          <option value="skipped">skipped</option>
        </select>
      </div>
      <div>
        <label for="imageOnly">Image focus</label>
        <select id="imageOnly">
          <option value="all">All memories</option>
          <option value="image">Images only</option>
        </select>
      </div>
    </div>
    <div class="timeline">
      <input id="timeline" type="range" min="0" max="100" value="100" />
      <button id="demoBtn" class="ghost" type="button">Demo mode</button>
      <button id="resetBtn" type="button">Reset camera</button>
    </div>
  </section>

  <script type="module">
    import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";
    import { OrbitControls } from "https://unpkg.com/three@0.164.1/examples/jsm/controls/OrbitControls.js";

    const sourceColors = {
      slack: 0x4ac4ff,
      notion: 0x7ac2ff,
      github: 0x9bc0ff,
      google_drive: 0x7dcbff,
      google_mail: 0x7da8ff,
      box: 0x65d8c4,
      dropbox: 0x57b8ff,
      vault: 0xffa457,
      web_crawler: 0xbf97ff,
      reddit: 0xff7f63,
      trace: 0x90ffc7,
      microsoft_teams: 0x8ca9ff,
      unknown: 0x9faed4,
    };

    const statusColor = {
      completed: "var(--ok)",
      processing: "var(--warn)",
      pending: "var(--warn)",
      failed: "var(--bad)",
      pending_review: "#c7a8ff",
      skipped: "#8ca0bf",
      unknown: "#8ca0bf",
    };

    const dataUrl = ${JSON.stringify(dataPath)};
    const canvas = document.getElementById("stage");
    const tooltip = document.getElementById("tooltip");
    const hud = document.getElementById("hud");
    const inspector = document.getElementById("inspector");
    const summary = document.getElementById("summary");
    const sourceFilter = document.getElementById("sourceFilter");
    const statusFilter = document.getElementById("statusFilter");
    const imageOnly = document.getElementById("imageOnly");
    const timeline = document.getElementById("timeline");
    const demoBtn = document.getElementById("demoBtn");
    const resetBtn = document.getElementById("resetBtn");

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060914, 0.0035);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1800);
    camera.position.set(0, 26, 170);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 35;
    controls.maxDistance = 460;

    const ambient = new THREE.AmbientLight(0x8ba1d8, 0.7);
    const point = new THREE.PointLight(0xb4cbff, 1.3, 1200, 1.4);
    point.position.set(80, 100, 120);
    scene.add(ambient, point);

    const stars = new THREE.BufferGeometry();
    const starCount = 2800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 1300;
      starPositions[i + 1] = (Math.random() - 0.5) * 1300;
      starPositions[i + 2] = (Math.random() - 0.5) * 1300;
    }
    stars.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ size: 0.8, color: 0x5f83cc, transparent: true, opacity: 0.65 })));

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let graph = null;
    let nodeMeshes = [];
    let edgeGroup = null;
    let hovered = null;
    let selected = null;
    let baseGraph = null;
    let demoMode = false;
    let demoNodes = [];
    let demoEdges = [];

    function countBy(list, keyFn) {
      const out = {};
      for (const item of list) {
        const k = keyFn(item);
        out[k] = (out[k] || 0) + 1;
      }
      return out;
    }

    function timelineSpan(nodes) {
      const times = nodes
        .map((n) => Date.parse(n.indexedAt || n.createdAt || ""))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      if (!times.length) {
        return "n/a";
      }
      const first = new Date(times[0]).toISOString().slice(0, 10);
      const last = new Date(times[times.length - 1]).toISOString().slice(0, 10);
      return first + " -> " + last;
    }

    function rebuildSourceOptions(activeGraph) {
      sourceFilter.innerHTML = '<option value="all">All sources</option>';
      const sources = Object.keys(activeGraph.sourceCounts || {}).sort();
      for (const s of sources) {
        const op = document.createElement("option");
        op.value = s;
        op.textContent = s + " (" + activeGraph.sourceCounts[s] + ")";
        sourceFilter.appendChild(op);
      }
    }

    function regenerateDemoData() {
      demoNodes = [];
      demoEdges = [];
      if (!baseGraph || !Array.isArray(baseGraph.nodes) || baseGraph.nodes.length === 0) {
        return;
      }
      const anchors = baseGraph.nodes.slice(0, Math.min(24, baseGraph.nodes.length));
      for (let i = 0; i < anchors.length; i += 1) {
        const a = anchors[i];
        const id = "demo:image:" + i;
        const dx = Math.sin(i * 0.71) * (24 + (i % 5) * 3);
        const dy = 16 + Math.cos(i * 0.43) * 9;
        const dz = Math.cos(i * 0.61) * (24 + (i % 7) * 2);
        demoNodes.push({
          id,
          source: "demo_images",
          resourceId: id,
          label: "Demo Image " + (i + 1),
          title: "Demo Image Memory " + (i + 1),
          status: "completed",
          score: 0.8,
          createdAt: a.createdAt,
          indexedAt: a.indexedAt,
          url: null,
          isImage: true,
          imageConfidence: "high",
          keywords: ["demo", "image", "memory"],
          x: a.x + dx,
          y: a.y + dy,
          z: a.z + dz,
          size: 2.2,
        });
        demoEdges.push({ source: a.id, target: id, strength: 0.9, reason: "demo_attach" });
      }
      for (let i = 1; i < demoNodes.length; i += 1) {
        demoEdges.push({
          source: demoNodes[i - 1].id,
          target: demoNodes[i].id,
          strength: 0.8,
          reason: "demo_band",
        });
      }
    }

    function getActiveGraph() {
      if (!baseGraph) {
        return null;
      }
      if (!demoMode) {
        return baseGraph;
      }
      const combinedNodes = baseGraph.nodes.concat(demoNodes);
      const combinedEdges = baseGraph.edges.concat(demoEdges);
      const sourceCounts = Object.assign({}, baseGraph.sourceCounts);
      sourceCounts.demo_images = demoNodes.length;
      return {
        ...baseGraph,
        nodes: combinedNodes,
        edges: combinedEdges,
        sourceCounts,
        metrics: {
          ...baseGraph.metrics,
          totalMemories: baseGraph.metrics.totalMemories + demoNodes.length,
          imageMemories: baseGraph.metrics.imageMemories + demoNodes.length,
        },
      };
    }

    function renderSummary(graph) {
      const topSources = Object.entries(graph.sourceCounts || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const recent = (graph.nodes || [])
        .slice()
        .sort((a, b) => Date.parse(b.indexedAt || b.createdAt || "") - Date.parse(a.indexedAt || a.createdAt || ""))
        .slice(0, 12);

      const statusCounts = countBy(graph.nodes || [], function(n) { return n.status || "unknown"; });
      const imageConf = countBy(
        (graph.nodes || []).filter(function(n) { return n.isImage; }),
        function(n) { return n.imageConfidence || "none"; },
      );

      const sourcesItems = topSources
        .map(function(pair) {
          return '<li><b>' + pair[0] + '</b>: ' + pair[1] + '</li>';
        })
        .join("");
      const sourcesHtml = topSources.length
        ? '<ul class="list">' + sourcesItems + '</ul>'
        : '<div class="row">No sources available.</div>';

      const recentItems = recent
        .map(function(n) {
          return '<li>' + (n.title || n.label || "untitled").slice(0, 44) + ' <b>[' + n.source + ']</b></li>';
        })
        .join("");
      const recentHtml = recent.length
        ? '<div class="scroller"><ul class="list">' + recentItems + '</ul></div>'
        : '<div class="row">No recent memories.</div>';

      const imageHint = graph.metrics?.imageMemories > 0
        ? ''
        : '<div class="warn">No image memories were detected in the current Hyperspell window. The graph is still showing all memories. Try widening lookback/max docs or indexing image-heavy sources.</div>';

      const statusLine = Object.keys(statusCounts)
        .sort()
        .map(function(k) { return k + ': ' + statusCounts[k]; })
        .join(' | ');
      const imgLine = Object.keys(imageConf).length
        ? Object.keys(imageConf).sort().map(function(k) { return k + ': ' + imageConf[k]; }).join(' | ')
        : 'none';

      summary.innerHTML = [
        '<div class="row">sender: <b>' + (graph.senderId || "n/a") + '</b></div>',
        '<div class="row">total: <b>' + (graph.metrics?.totalMemories ?? 0) + '</b> | images: <b>' + (graph.metrics?.imageMemories ?? 0) + '</b></div>',
        '<div class="row">span: <b>' + timelineSpan(graph.nodes || []) + '</b></div>',
        '<div class="row">status mix: <b>' + (statusLine || 'n/a') + '</b></div>',
        '<div class="row">image confidence: <b>' + imgLine + '</b></div>',
        '<div class="row"><b>Top sources</b></div>',
        sourcesHtml,
        '<div class="row" style="margin-top:8px"><b>Recent memories</b></div>',
        recentHtml,
        imageHint,
      ].join("");
    }

    function buildHud(metrics) {
      hud.innerHTML = "";
      const chips = [
        ["Memories", metrics.totalMemories],
        ["Image Memories", metrics.imageMemories],
        ["Processing", metrics.processing],
        ["Failed", metrics.failed],
        ["Freshness", metrics.freshnessHours == null ? "n/a" : metrics.freshnessHours + "h"],
      ];
      for (const [k, v] of chips) {
        const el = document.createElement("div");
        el.className = "chip";
        el.innerHTML = k + ": <b>" + v + "</b>";
        hud.appendChild(el);
      }
    }

    function setInspector(node) {
      if (!node) {
        inspector.textContent = "Click a node to inspect memory details.";
        return;
      }
      const statusTint = statusColor[node.status] || "#8ca0bf";
      inspector.innerHTML = [
        '<div class="row"><b>' + (node.title || node.label) + '</b></div>',
        '<div class="row">source: <b>' + node.source + '</b></div>',
        '<div class="row">status: <b style="color:' + statusTint + '">' + node.status + '</b></div>',
        '<div class="row">image confidence: <b>' + node.imageConfidence + '</b></div>',
        '<div class="row">indexed: <b>' + (node.indexedAt || "n/a") + '</b></div>',
        '<div class="row">created: <b>' + (node.createdAt || "n/a") + '</b></div>',
        '<div class="row">resource: <b>' + node.resourceId + '</b></div>',
        '<div class="row">keywords: <b>' + (node.keywords || []).join(", ") + '</b></div>',
        node.url ? '<div class="row">url: <a href="' + node.url + '" target="_blank" rel="noreferrer">open source</a></div>' : '<div class="row">url: <b>none</b></div>',
      ].join("");
    }

    function clearSceneGraph() {
      for (const m of nodeMeshes) {
        scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      }
      nodeMeshes = [];
      if (edgeGroup) {
        scene.remove(edgeGroup);
        edgeGroup.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
      }
      edgeGroup = null;
    }

    function matchesFilters(node) {
      const sf = sourceFilter.value;
      const st = statusFilter.value;
      const im = imageOnly.value;
      if (sf !== "all" && node.source !== sf) return false;
      if (st !== "all" && node.status !== st) return false;
      if (im === "image" && !node.isImage) return false;
      return true;
    }

    function timelineAccepts(node, low, high) {
      const ts = Date.parse(node.indexedAt || node.createdAt || "");
      if (!Number.isFinite(ts)) return true;
      return ts >= low && ts <= high;
    }

    function renderGraph() {
      graph = getActiveGraph();
      if (!graph) return;
      clearSceneGraph();
      const active = [];

      const tNorm = Number(timeline.value) / 100;
      const allTimes = graph.nodes
        .map((n) => Date.parse(n.indexedAt || n.createdAt || ""))
        .filter((n) => Number.isFinite(n));
      const minTs = allTimes.length ? Math.min(...allTimes) : Date.now() - 86400000;
      const maxTs = allTimes.length ? Math.max(...allTimes) : Date.now();
      const low = minTs;
      const high = minTs + (maxTs - minTs) * tNorm;

      for (const n of graph.nodes) {
        if (!matchesFilters(n) || !timelineAccepts(n, low, high)) continue;
        active.push(n);
        const color = sourceColors[n.source] || sourceColors.unknown;
        const geometry = new THREE.SphereGeometry(n.isImage ? 1.25 : 0.8, 12, 12);
        const material = new THREE.MeshStandardMaterial({
          color,
          emissive: n.isImage ? 0x9b6322 : 0x111827,
          emissiveIntensity: n.isImage ? 1.1 : 0.2,
          roughness: 0.35,
          metalness: 0.35,
          transparent: true,
          opacity: n.status === "failed" ? 0.38 : 0.95,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(n.x, n.y, n.z);
        mesh.scale.setScalar(n.size);
        mesh.userData.node = n;
        scene.add(mesh);
        nodeMeshes.push(mesh);
      }

      const activeIds = new Set(active.map((n) => n.id));
      edgeGroup = new THREE.Group();
      for (const e of graph.edges) {
        if (!activeIds.has(e.source) || !activeIds.has(e.target)) continue;
        const a = active.find((n) => n.id === e.source);
        const b = active.find((n) => n.id === e.target);
        if (!a || !b) continue;
        const g = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(a.x, a.y, a.z),
          new THREE.Vector3(b.x, b.y, b.z),
        ]);
        const m = new THREE.LineBasicMaterial({ color: 0x7eb0ff, transparent: true, opacity: Math.min(0.5, e.strength * 0.45) });
        edgeGroup.add(new THREE.Line(g, m));
      }
      scene.add(edgeGroup);
    }

    function updateTooltip(event) {
      if (!hovered) {
        tooltip.style.display = "none";
        return;
      }
      tooltip.style.display = "block";
      tooltip.style.left = event.clientX + "px";
      tooltip.style.top = event.clientY + "px";
      const n = hovered.userData.node;
      tooltip.textContent = n.title + " [" + n.source + "]";
    }

    function hitTest(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(nodeMeshes, false);
      hovered = hits.length ? hits[0].object : null;
      updateTooltip(event);
    }

    renderer.domElement.addEventListener("pointermove", hitTest);
    renderer.domElement.addEventListener("click", (event) => {
      hitTest(event);
      selected = hovered ? hovered.userData.node : null;
      setInspector(selected);
      if (selected) {
        const target = new THREE.Vector3(selected.x, selected.y, selected.z);
        controls.target.lerp(target, 0.9);
      }
    });

    [sourceFilter, statusFilter, imageOnly, timeline].forEach((el) => {
      el.addEventListener("input", renderGraph);
      el.addEventListener("change", renderGraph);
    });

    demoBtn.addEventListener("click", () => {
      demoMode = !demoMode;
      if (demoMode) {
        demoBtn.classList.add("active");
      } else {
        demoBtn.classList.remove("active");
      }
      const activeGraph = getActiveGraph();
      if (activeGraph) {
        rebuildSourceOptions(activeGraph);
        renderSummary(activeGraph);
        buildHud(activeGraph.metrics);
      }
      renderGraph();
    });

    resetBtn.addEventListener("click", () => {
      camera.position.set(0, 26, 170);
      controls.target.set(0, 0, 0);
    });

    async function load() {
      const res = await fetch(dataUrl);
      if (!res.ok) {
        throw new Error("Failed to load graph data");
      }
      baseGraph = await res.json();
      regenerateDemoData();
      graph = getActiveGraph();
      renderSummary(graph);
      buildHud(graph.metrics);
      rebuildSourceOptions(graph);

      renderGraph();
    }

    load().catch((err) => {
      inspector.innerHTML = '<div class="row"><b>Failed to load dashboard data.</b></div><div class="row">' + String(err.message || err) + '</div>';
      summary.innerHTML = '<div class="row"><b>Data load failed.</b></div><div class="row">' + String(err.message || err) + '</div>';
    });

    function animate() {
      requestAnimationFrame(animate);
      const t = performance.now() * 0.001;
      if (edgeGroup) {
        edgeGroup.rotation.y = t * 0.03;
      }
      for (let i = 0; i < nodeMeshes.length; i += 1) {
        const m = nodeMeshes[i];
        const n = m.userData.node;
        if (n && n.isImage) {
          const wave = 1 + Math.sin(t * 2.6 + i * 0.17) * 0.05;
          m.scale.setScalar(n.size * wave);
        }
      }
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;
}
