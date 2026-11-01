// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
//
// P1.4.1 page. Query parameters:
//   mode=imperative (default) | mvs    which API drives the view
//   source=local (default) | rcsb      local copy of research/raw/rcsb/2HBS.cif, or a plain GET to files.rcsb.org
//   measure=0                          skip the frame-time sampling
import { useEffect, useRef, useState } from 'react';
import { createPluginUI } from 'molstar/lib/mol-plugin-ui';
import { renderReact18 } from 'molstar/lib/mol-plugin-ui/react18';
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { PluginSpec } from 'molstar/lib/mol-plugin/spec';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { MolViewSpec } from 'molstar/lib/extensions/mvs/behavior';
import { StructureElement, Structure } from 'molstar/lib/mol-model/structure';
import 'molstar/lib/mol-plugin-ui/skin/dark.scss';
import {
  HBS_CONTACTS, HBS_TARGET, buildMvs, callLog, loadMvsView, loadStructure, logCall, measureFrames,
  probeGpu, readFocus, readResidues, readSelection, showResidue,
} from './helix-molstar';

declare global { interface Window { __helix: Record<string, any>; __plugin?: PluginContext } }

const params = new URLSearchParams(location.search);
const MODE = params.get('mode') === 'mvs' ? 'mvs' : 'imperative';
const SOURCE = params.get('source') === 'rcsb' ? 'rcsb' : 'local';
const MEASURE = params.get('measure') !== '0';
const URL_2HBS = SOURCE === 'rcsb' ? 'https://files.rcsb.org/download/2HBS.cif' : new URL('data/2HBS.cif', location.href).href;

const H: Record<string, any> = (window.__helix = { mode: MODE, source: SOURCE, url: URL_2HBS, ready: false, events: [], callLog });

function nextDraw(plugin: PluginContext) {
  return new Promise<void>((resolve) => {
    const sub = plugin.canvas3d!.didDraw.subscribe(() => { sub.unsubscribe(); resolve(); });
    plugin.canvas3d!.requestDraw();
  });
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(target: HTMLDivElement, setStatus: (s: string) => void) {
  const tStart = performance.now();
  const spec = DefaultPluginUISpec();
  spec.behaviors.push(PluginSpec.Behavior(MolViewSpec));
  spec.layout = { initial: { isExpanded: false, showControls: false } };
  spec.config = [...(spec.config ?? []), [PluginConfig.Viewport.ShowAnimation, false]];
  const plugin = await logCall('createPluginUI', { spec: 'DefaultPluginUISpec + MolViewSpec behavior' }, () =>
    createPluginUI({ target, render: renderReact18, spec }));
  window.__plugin = plugin;
  H.pluginInitMs = +(performance.now() - tStart).toFixed(1);
  H.gpu = await probeGpu(plugin);

  // Events Helix can listen to.
  plugin.behaviors.interaction.click.subscribe((e) => {
    if (StructureElement.Loci.is(e.current.loci)) H.events.push({ type: 'click', residues: readResidues(e.current.loci) });
  });
  plugin.managers.structure.selection.events.changed.subscribe(() => {
    H.events.push({ type: 'selection.changed', residues: readSelection(plugin) });
  });
  plugin.managers.structure.focus.behaviors.current.subscribe((f) => {
    if (f) H.events.push({ type: 'focus.current', residues: readResidues(f.loci) });
  });

  const tLoad = performance.now();
  if (MODE === 'imperative') {
    setStatus('loading 2HBS (imperative)');
    await loadStructure(plugin, URL_2HBS);
    await nextDraw(plugin);
    H.loadToFirstDrawMs = +(performance.now() - tLoad).toFixed(1);
    const tAct = performance.now();
    await showResidue(plugin, HBS_TARGET, { contacts: HBS_CONTACTS });
    await nextDraw(plugin);
    H.actionToDrawMs = +(performance.now() - tAct).toFixed(1);
    await wait(900); // camera animation is 600 ms
    H.readback = { selection: readSelection(plugin), focus: readFocus(plugin) };
  } else {
    setStatus('loading 2HBS (MolViewSpec)');
    const mvs = buildMvs(URL_2HBS);
    H.mvsj = mvs;
    await loadMvsView(plugin, mvs);
    await nextDraw(plugin);
    H.loadToFirstDrawMs = +(performance.now() - tLoad).toFixed(1);
    await wait(900);
    // MVS does not touch the selection manager. Read back what each declared component contains.
    const s = plugin.managers.structure.hierarchy.current.structures[0];
    H.readback = {
      selection: readSelection(plugin),
      components: s.components.map((c) => ({
        label: c.cell.obj?.label,
        residues: c.cell.obj ? readResidues(Structure.toStructureElementLoci(c.cell.obj.data as Structure)) : [],
      })).filter((c) => c.residues.length <= 10),
    };
  }
  const cam = plugin.canvas3d!.camera.state;
  H.camera = { target: Array.from(cam.target).map((x) => +x.toFixed(2)), radius: +cam.radius.toFixed(2) };
  H.totalToReadyMs = +(performance.now() - tStart).toFixed(1);
  H.ready = true;
  setStatus('ready');
  if (MEASURE) {
    await wait(1500); // leave time for the screenshot of the focused view
    H.frames = await measureFrames(plugin, 5000);
    H.measured = true;
  }
}

export function App() {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('starting');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!ref.current || H.started) return;
    H.started = true;
    run(ref.current, setStatus).catch((e) => { H.error = String(e?.stack ?? e); setStatus('error: ' + e); });
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const rb = H.readback;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', height: '100vh', background: '#06090f', color: '#e8ecef', font: '13px/1.4 system-ui' }}>
      <div ref={ref} style={{ position: 'relative' }} />
      <aside style={{ padding: 12, overflow: 'auto', borderLeft: '1px solid #1c2633' }} data-tick={tick}>
        <h1 style={{ fontSize: 15, margin: '0 0 8px' }}>P1.4.1 Mol* embed: {MODE}</h1>
        <div>status: <b id="status">{status}</b></div>
        <div>source: {SOURCE} ({URL_2HBS})</div>
        {rb && (
          <>
            <h2 style={{ fontSize: 13 }}>Read back from viewer state</h2>
            <pre id="readback" style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{JSON.stringify(rb, null, 1)}</pre>
          </>
        )}
        {H.loadToFirstDrawMs && <div>load to first draw: {H.loadToFirstDrawMs} ms</div>}
        {H.frames && <div>frames p50 {H.frames.p50Ms} ms, p95 {H.frames.p95Ms} ms</div>}
      </aside>
    </div>
  );
}
