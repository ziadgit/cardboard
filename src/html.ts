export function renderGalaxyHtml(dataPath: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hyperspell Knowledge Galaxy</title>
  <style>
    :root {
      --bg0: #070b17;
      --bg1: #0f1733;
      --bg2: #1a1c3d;
      --ink: #d8e3ff;
      --muted: #8ea0cf;
      --panel: rgba(7, 12, 26, 0.78);
      --line: rgba(145, 178, 255, 0.28);
      --warn: #ffd9a1;
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
    #stage { position: fixed; inset: 0; width: 100%; height: 100%; }
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
      border: 1px solid var(--line);
      font-size: 12px;
    }
    .chip b { color: #fff; }
    .panel {
      position: fixed;
      right: 16px;
      top: 16px;
      width: 360px;
      max-height: calc(100% - 32px);
      overflow: auto;
      padding: 12px;
      border-radius: 14px;
      background: var(--panel);
      border: 1px solid var(--line);
      z-index: 25;
    }
    .panel h2 { margin: 0 0 8px; font-size: 15px; }
    .row { margin: 5px 0; color: var(--muted); font-size: 12px; line-height: 1.35; }
    .row b { color: var(--ink); }
    .meta { margin-top: 7px; padding-left: 8px; border-left: 2px solid rgba(145, 178, 255, 0.25); }
    .warn {
      margin-top: 8px;
      padding: 8px;
      border-radius: 10px;
      border: 1px solid rgba(255, 184, 77, 0.45);
      background: rgba(255, 184, 77, 0.12);
      color: var(--warn);
      font-size: 12px;
    }
    .filters {
      position: fixed;
      left: 16px;
      bottom: 16px;
      width: min(680px, calc(100% - 32px));
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 10px;
      z-index: 26;
    }
    .controls { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    label { font-size: 11px; color: var(--muted); display: block; margin-bottom: 4px; }
    select, input[type="range"], button {
      width: 100%;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: rgba(10, 14, 29, 0.9);
      color: var(--ink);
      padding: 7px 8px;
      font-size: 12px;
    }
    .bar { margin-top: 10px; display: grid; grid-template-columns: 1fr auto auto; gap: 8px; }
    button.active { border-color: rgba(255, 184, 77, 0.65); background: rgba(255, 184, 77, 0.18); }
    #tooltip {
      position: fixed;
      pointer-events: none;
      transform: translate(10px, 10px);
      padding: 6px 8px;
      border-radius: 8px;
      background: rgba(6, 10, 24, 0.92);
      border: 1px solid var(--line);
      font-size: 11px;
      z-index: 40;
      display: none;
      max-width: 300px;
    }
    #debug {
      position: fixed;
      left: 16px;
      top: 80px;
      z-index: 30;
      max-width: 520px;
      font-size: 12px;
      color: #ffb8b8;
      background: rgba(58, 10, 18, 0.85);
      border: 1px solid rgba(255, 111, 125, 0.5);
      border-radius: 10px;
      padding: 8px;
      display: none;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <canvas id="stage"></canvas>
  <div id="tooltip"></div>
  <div id="debug"></div>
  <div class="hud" id="hud"></div>

  <aside class="panel">
    <h2>Inspector</h2>
    <div id="inspector" class="row">Click a node to inspect memory details.</div>
    <h2 style="margin-top:12px">Data Snapshot</h2>
    <div id="summary" class="row">Loading memory summary...</div>
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
    <div class="bar">
      <input id="timeline" type="range" min="0" max="100" value="100" />
      <button id="demoBtn" type="button">Demo mode</button>
      <button id="resetBtn" type="button">Reset camera</button>
    </div>
  </section>

  <script>
  (function() {
    var dataUrl = ${JSON.stringify(dataPath)};
    var canvas = document.getElementById("stage");
    var ctx = canvas.getContext("2d");
    var tooltip = document.getElementById("tooltip");
    var debug = document.getElementById("debug");
    var hud = document.getElementById("hud");
    var inspector = document.getElementById("inspector");
    var summary = document.getElementById("summary");
    var sourceFilter = document.getElementById("sourceFilter");
    var statusFilter = document.getElementById("statusFilter");
    var imageOnly = document.getElementById("imageOnly");
    var timeline = document.getElementById("timeline");
    var demoBtn = document.getElementById("demoBtn");
    var resetBtn = document.getElementById("resetBtn");

    function showDebug(msg) {
      debug.style.display = "block";
      debug.textContent = msg;
    }

    if (!ctx) {
      showDebug("Canvas 2D is not available in this browser context.");
      return;
    }

    var sourceColors = {
      slack: "#4ac4ff",
      notion: "#7ac2ff",
      github: "#9bc0ff",
      google_drive: "#7dcbff",
      google_mail: "#7da8ff",
      box: "#65d8c4",
      dropbox: "#57b8ff",
      vault: "#ffa457",
      demo_images: "#ffb84d",
      unknown: "#9faed4",
    };

    var baseGraph = null;
    var graph = null;
    var demoMode = false;
    var selectedNode = null;
    var hoveredNode = null;
    var camera = { yaw: 0, pitch: -0.2, dist: 260, panX: 0, panY: 0 };
    var dragging = false;
    var dragBtn = 0;
    var dragStart = { x: 0, y: 0 };

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();

    function buildHud(metrics) {
      hud.innerHTML = "";
      [["Memories", metrics.totalMemories], ["Image Memories", metrics.imageMemories], ["Processing", metrics.processing], ["Failed", metrics.failed], ["Freshness", metrics.freshnessHours == null ? "n/a" : metrics.freshnessHours + "h"]]
        .forEach(function(pair) {
          var el = document.createElement("div");
          el.className = "chip";
          el.innerHTML = pair[0] + ": <b>" + pair[1] + "</b>";
          hud.appendChild(el);
        });
    }

    function rebuildSourceOptions(g) {
      sourceFilter.innerHTML = '<option value="all">All sources</option>';
      Object.keys(g.sourceCounts || {}).sort().forEach(function(s) {
        var op = document.createElement("option");
        op.value = s;
        op.textContent = s + " (" + g.sourceCounts[s] + ")";
        sourceFilter.appendChild(op);
      });
    }

    function makeDemoGraph() {
      if (!baseGraph) return null;
      var extraNodes = [];
      var extraEdges = [];
      var anchors = (baseGraph.nodes || []).slice(0, Math.min(24, baseGraph.nodes.length));
      anchors.forEach(function(a, idx) {
        var id = "demo:image:" + idx;
        extraNodes.push({
          id: id,
          source: "demo_images",
          resourceId: id,
          label: "Demo Image " + (idx + 1),
          title: "Demo Image Memory " + (idx + 1),
          type: "image/demo",
          status: "completed",
          score: 0.9,
          createdAt: a.createdAt,
          indexedAt: a.indexedAt,
          url: null,
          isImage: true,
          imageConfidence: "high",
          keywords: ["demo", "image"],
          metadataPreview: [{ key: "kind", value: "synthetic_demo" }],
          x: a.x + Math.sin(idx * 0.71) * (24 + (idx % 5) * 3),
          y: a.y + 16 + Math.cos(idx * 0.43) * 9,
          z: a.z + Math.cos(idx * 0.61) * (24 + (idx % 7) * 2),
          size: 2.25,
        });
        extraEdges.push({ source: a.id, target: id, strength: 0.9, reason: "demo_attach" });
      });
      for (var i = 1; i < extraNodes.length; i += 1) {
        extraEdges.push({ source: extraNodes[i - 1].id, target: extraNodes[i].id, strength: 0.8, reason: "demo_band" });
      }
      var sourceCounts = Object.assign({}, baseGraph.sourceCounts || {});
      sourceCounts.demo_images = extraNodes.length;
      return {
        generatedAt: baseGraph.generatedAt,
        senderId: baseGraph.senderId,
        metrics: {
          totalMemories: (baseGraph.metrics.totalMemories || 0) + extraNodes.length,
          imageMemories: (baseGraph.metrics.imageMemories || 0) + extraNodes.length,
          failed: baseGraph.metrics.failed || 0,
          processing: baseGraph.metrics.processing || 0,
          freshnessHours: baseGraph.metrics.freshnessHours,
        },
        sourceCounts: sourceCounts,
        statusCounts: baseGraph.statusCounts || {},
        timeline: baseGraph.timeline || [],
        nodes: (baseGraph.nodes || []).concat(extraNodes),
        edges: (baseGraph.edges || []).concat(extraEdges),
      };
    }

    function activeGraph() {
      if (!baseGraph) return null;
      return demoMode ? makeDemoGraph() : baseGraph;
    }

    function renderSummary(g) {
      var nodes = g.nodes || [];
      var topSources = Object.entries(g.sourceCounts || {}).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 6);
      var recent = nodes.slice().sort(function(a, b) { return Date.parse(b.indexedAt || b.createdAt || "") - Date.parse(a.indexedAt || a.createdAt || ""); }).slice(0, 10);
      var sourceLines = topSources.map(function(p) { return "<div class='row'>- <b>" + p[0] + "</b>: " + p[1] + "</div>"; }).join("");
      var recentLines = recent.map(function(n) { return "<div class='row'>- " + (n.title || n.label || "untitled").slice(0, 52) + " <b>[" + n.source + "]</b></div>"; }).join("");
      var warn = g.metrics.imageMemories > 0 ? "" : "<div class='warn'>No image memories detected in current data window. Demo mode injects synthetic image nodes for preview.</div>";
      summary.innerHTML = ""
        + "<div class='row'>sender: <b>" + (g.senderId || "n/a") + "</b></div>"
        + "<div class='row'>total: <b>" + (g.metrics.totalMemories || 0) + "</b> | images: <b>" + (g.metrics.imageMemories || 0) + "</b></div>"
        + "<div class='row'><b>Top sources</b></div>" + sourceLines
        + "<div class='row' style='margin-top:8px'><b>Recent memories</b></div>" + recentLines
        + warn;
    }

    function setInspector(node) {
      if (!node) {
        inspector.textContent = "Click a node to inspect memory details.";
        return;
      }
      var meta = (node.metadataPreview || []).map(function(m) { return "<div class='row meta'><b>" + m.key + "</b>: " + m.value + "</div>"; }).join("");
      inspector.innerHTML = ""
        + "<div class='row'><b>" + (node.title || node.label || "untitled") + "</b></div>"
        + "<div class='row'>source: <b>" + node.source + "</b></div>"
        + "<div class='row'>type: <b>" + (node.type || "n/a") + "</b></div>"
        + "<div class='row'>status: <b>" + (node.status || "unknown") + "</b></div>"
        + "<div class='row'>image confidence: <b>" + (node.imageConfidence || "none") + "</b></div>"
        + "<div class='row'>score: <b>" + Number(node.score || 0).toFixed(3) + "</b></div>"
        + "<div class='row'>indexed: <b>" + (node.indexedAt || "n/a") + "</b></div>"
        + "<div class='row'>resource: <b>" + (node.resourceId || "n/a") + "</b></div>"
        + meta;
    }

    function rotatePoint(x, y, z) {
      var cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
      var cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);

      var x1 = x * cy - z * sy;
      var z1 = x * sy + z * cy;

      var y2 = y * cp - z1 * sp;
      var z2 = y * sp + z1 * cp;

      return { x: x1 + camera.panX, y: y2 + camera.panY, z: z2 };
    }

    function project(p) {
      var fov = 360;
      var z = p.z + camera.dist;
      if (z < 5) return null;
      var s = fov / z;
      return {
        x: canvas.width * 0.5 + p.x * s,
        y: canvas.height * 0.5 - p.y * s,
        z: z,
        scale: s,
      };
    }

    function gatherVisible() {
      graph = activeGraph();
      if (!graph) return { nodes: [], edges: [] };

      var nodes = graph.nodes || [];
      var edges = graph.edges || [];
      var allTimes = nodes.map(function(n) { return Date.parse(n.indexedAt || n.createdAt || ""); }).filter(function(v) { return Number.isFinite(v); });
      var minTs = allTimes.length ? Math.min.apply(null, allTimes) : Date.now() - 86400000;
      var maxTs = allTimes.length ? Math.max.apply(null, allTimes) : Date.now();
      var high = minTs + (maxTs - minTs) * (Number(timeline.value) / 100);

      var byId = {};
      var visibleNodes = [];
      nodes.forEach(function(n) {
        if (sourceFilter.value !== "all" && n.source !== sourceFilter.value) return;
        if (statusFilter.value !== "all" && n.status !== statusFilter.value) return;
        if (imageOnly.value === "image" && !n.isImage) return;
        var ts = Date.parse(n.indexedAt || n.createdAt || "");
        if (Number.isFinite(ts) && ts > high) return;

        var p = rotatePoint(n.x || 0, n.y || 0, n.z || 0);
        var scr = project(p);
        if (!scr) return;

        var r = Math.max(1.5, (n.size || 1) * scr.scale * (n.isImage ? 1.6 : 1.1));
        var vn = { raw: n, p3: p, p2: scr, r: r };
        visibleNodes.push(vn);
        byId[n.id] = vn;
      });

      visibleNodes.sort(function(a, b) { return b.p2.z - a.p2.z; });

      var visibleEdges = [];
      edges.forEach(function(e) {
        var a = byId[e.source];
        var b = byId[e.target];
        if (!a || !b) return;
        visibleEdges.push({ a: a, b: b, strength: e.strength || 0.4 });
      });

      return { nodes: visibleNodes, edges: visibleEdges };
    }

    function draw() {
      var frame = gatherVisible();

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      var grd = ctx.createRadialGradient(canvas.width * 0.75, canvas.height * 0.15, 20, canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.8);
      grd.addColorStop(0, "rgba(40,56,120,0.22)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(126,176,255,0.24)";
      frame.edges.forEach(function(e) {
        ctx.globalAlpha = Math.min(0.5, e.strength * 0.45);
        ctx.beginPath();
        ctx.moveTo(e.a.p2.x, e.a.p2.y);
        ctx.lineTo(e.b.p2.x, e.b.p2.y);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      frame.nodes.forEach(function(n) {
        var c = sourceColors[n.raw.source] || sourceColors.unknown;
        ctx.beginPath();
        ctx.fillStyle = c;
        ctx.globalAlpha = n.raw.status === "failed" ? 0.35 : 0.92;
        ctx.arc(n.p2.x, n.p2.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (n.raw.isImage) {
          ctx.beginPath();
          ctx.strokeStyle = "rgba(255,184,77,0.9)";
          ctx.lineWidth = 1.3;
          ctx.arc(n.p2.x, n.p2.y, n.r + 2.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      if (selectedNode) {
        var hit = null;
        for (var i = 0; i < frame.nodes.length; i += 1) {
          if (frame.nodes[i].raw.id === selectedNode.id) {
            hit = frame.nodes[i];
            break;
          }
        }
        if (hit) {
          ctx.beginPath();
          ctx.strokeStyle = "rgba(255,255,255,0.95)";
          ctx.lineWidth = 2;
          ctx.arc(hit.p2.x, hit.p2.y, hit.r + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      draw._frame = frame;
      requestAnimationFrame(draw);
    }

    function pickNode(x, y) {
      var frame = draw._frame;
      if (!frame) return null;
      var best = null;
      var bestD = Infinity;
      frame.nodes.forEach(function(n) {
        var dx = x - n.p2.x;
        var dy = y - n.p2.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d <= n.r + 4 && d < bestD) {
          best = n.raw;
          bestD = d;
        }
      });
      return best;
    }

    canvas.addEventListener("mousemove", function(e) {
      if (dragging) {
        var dx = e.clientX - dragStart.x;
        var dy = e.clientY - dragStart.y;
        dragStart.x = e.clientX;
        dragStart.y = e.clientY;
        if (dragBtn === 0) {
          camera.yaw += dx * 0.005;
          camera.pitch += dy * 0.005;
          camera.pitch = Math.max(-1.4, Math.min(1.4, camera.pitch));
        } else {
          camera.panX += dx * 0.4;
          camera.panY -= dy * 0.4;
        }
        return;
      }

      hoveredNode = pickNode(e.clientX, e.clientY);
      if (!hoveredNode) {
        tooltip.style.display = "none";
        return;
      }
      tooltip.style.display = "block";
      tooltip.style.left = e.clientX + "px";
      tooltip.style.top = e.clientY + "px";
      tooltip.textContent = (hoveredNode.title || hoveredNode.label || "untitled") + " [" + hoveredNode.source + "]";
    });

    canvas.addEventListener("mousedown", function(e) {
      dragging = true;
      dragBtn = e.button;
      dragStart.x = e.clientX;
      dragStart.y = e.clientY;
    });
    window.addEventListener("mouseup", function() { dragging = false; });

    canvas.addEventListener("wheel", function(e) {
      e.preventDefault();
      camera.dist += e.deltaY * 0.2;
      camera.dist = Math.max(40, Math.min(900, camera.dist));
    }, { passive: false });

    canvas.addEventListener("click", function(e) {
      var n = pickNode(e.clientX, e.clientY);
      selectedNode = n;
      setInspector(n);
    });

    [sourceFilter, statusFilter, imageOnly, timeline].forEach(function(el) {
      el.addEventListener("input", function() {});
      el.addEventListener("change", function() {});
    });

    demoBtn.addEventListener("click", function() {
      demoMode = !demoMode;
      demoBtn.classList.toggle("active", demoMode);
      demoBtn.textContent = demoMode ? "Demo on" : "Demo mode";
      sourceFilter.value = "all";
      statusFilter.value = "all";
      imageOnly.value = "all";
      timeline.value = "100";
      var g = activeGraph();
      if (g) {
        buildHud(g.metrics);
        rebuildSourceOptions(g);
        renderSummary(g);
      }
    });

    resetBtn.addEventListener("click", function() {
      camera.yaw = 0;
      camera.pitch = -0.2;
      camera.dist = 260;
      camera.panX = 0;
      camera.panY = 0;
    });

    fetch(dataUrl).then(function(res) {
      if (!res.ok) throw new Error("Failed to load data: " + res.status);
      return res.json();
    }).then(function(g) {
      baseGraph = g;
      var act = activeGraph();
      buildHud(act.metrics);
      rebuildSourceOptions(act);
      renderSummary(act);
      draw();
    }).catch(function(err) {
      showDebug("Data load failed: " + (err && err.message ? err.message : String(err)) + "\\nURL: " + dataUrl);
      summary.innerHTML = '<div class="warn">Data load failed: ' + (err && err.message ? err.message : String(err)) + '</div>';
    });

    window.addEventListener("resize", resize);
    window.addEventListener("error", function(e) {
      showDebug("Visualizer error: " + (e && e.message ? e.message : "unknown"));
    });
  })();
  </script>
</body>
</html>`;
}
