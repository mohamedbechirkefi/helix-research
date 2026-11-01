// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
//
// P1.4.2: Mol* view coordinated with a React Three Fiber canvas.
// Query parameters: layout=side (default) | overlay ; r3f=0 (no R3F canvas) ; molstar=0 (no Mol*)
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { createPluginUI } from 'molstar/lib/mol-plugin-ui';
import { renderReact18 } from 'molstar/lib/mol-plugin-ui/react18';
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { StructureElement } from 'molstar/lib/mol-model/structure';
import 'molstar/lib/mol-plugin-ui/skin/dark.scss';
import { glContexts } from './gl-count';
import { BETA_CHAINS, Codon, HBS, THREE_LETTER, codonForResidue, codons as makeCodons, parseFasta } from './mapping';
import { HBS_CONTACTS, residueExpression, callLog, lociFor, loadStructure, logCall, readResidues, readSelection, summarise } from './helix-molstar';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { Color } from 'molstar/lib/mol-util/color';

declare global { interface Window { __helix: Record<string, any>; __plugin?: PluginContext } }
const params = new URLSearchParams(location.search);
const LAYOUT = params.get('layout') === 'overlay' ? 'overlay' : 'side';
const WITH_R3F = params.get('r3f') !== '0';
const WITH_MOLSTAR = params.get('molstar') !== '0';
const CODON_RANGE: [number, number] = [1, 14];
const H: Record<string, any> = (window.__helix = { layout: LAYOUT, withR3F: WITH_R3F, withMolstar: WITH_MOLSTAR, ready: false, events: [], glContexts, callLog });

// ---------- shared selection store (the "world state" stand-in) ----------
type Sel = { codon: number | null; source: 'r3f' | 'molstar' | 'strip' | null; phase: 'dna' | 'protein'; seq: number };
let state: Sel = { codon: null, source: null, phase: 'dna', seq: 0 };
const listeners = new Set<() => void>();
const store = {
  get: () => state,
  set: (p: Partial<Sel>) => { state = { ...state, ...p, seq: state.seq + 1 }; H.events.push({ type: 'store', ...state, t: +performance.now().toFixed(1) }); listeners.forEach((l) => l()); },
  sub: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
};
const useSel = () => useSyncExternalStore(store.sub, store.get);

// ---------- R3F: procedural DNA from real CDS codons ----------
const BASE_COLOR: Record<string, string> = { A: '#4f9dde', T: '#e0c35a', G: '#59c18f', C: '#d9685f' };
const COMP: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };
const RISE = 0.34 * 1.6, TWIST = (2 * Math.PI) / 10.5, RADIUS = 1;
const spin = { r3f: false };

function bpPosition(i: number) {
  const a = i * TWIST;
  return { y: i * RISE, a, p1: new THREE.Vector3(Math.cos(a) * RADIUS, i * RISE, Math.sin(a) * RADIUS), p2: new THREE.Vector3(Math.cos(a + Math.PI * 0.8) * RADIUS, i * RISE, Math.sin(a + Math.PI * 0.8) * RADIUS) };
}

function CodonMesh({ codon, offset, selected, onPick }: { codon: Codon; offset: number; selected: boolean; onPick: (k: number) => void }) {
  const [hover, setHover] = useState(false);
  const isHbs = codon.index === HBS.codon;
  return (
    <group
      userData={{ codon: codon.index }}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(codon.index); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
      onPointerOut={() => setHover(false)}
    >
      {[...codon.bases].map((b, j) => {
        const { p1, p2 } = bpPosition(offset + j);
        const mid = p1.clone().add(p2).multiplyScalar(0.5);
        const len = p1.distanceTo(p2);
        const dir = p2.clone().sub(p1).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const emissive = selected ? '#ffb000' : hover ? '#2ec4b6' : '#000000';
        return (
          <group key={j}>
            <mesh position={p1}><sphereGeometry args={[0.16, 16, 12]} /><meshStandardMaterial color={isHbs ? '#ffcf66' : '#c9d4df'} emissive={emissive} emissiveIntensity={0.6} /></mesh>
            <mesh position={p2}><sphereGeometry args={[0.16, 16, 12]} /><meshStandardMaterial color="#c9d4df" emissive={emissive} emissiveIntensity={0.6} /></mesh>
            <mesh position={mid.clone().add(p1).multiplyScalar(0.5)} quaternion={q}><cylinderGeometry args={[0.07, 0.07, len / 2, 10]} /><meshStandardMaterial color={BASE_COLOR[b]} emissive={emissive} emissiveIntensity={0.5} /></mesh>
            <mesh position={mid.clone().add(p2).multiplyScalar(0.5)} quaternion={q}><cylinderGeometry args={[0.07, 0.07, len / 2, 10]} /><meshStandardMaterial color={BASE_COLOR[COMP[b]]} emissive={emissive} emissiveIntensity={0.5} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

function CameraRig({ codonCount }: { codonCount: number }) {
  const sel = useSel();
  const { camera } = useThree();
  const centreY = ((codonCount * 3) * RISE) / 2;
  useFrame((_, dt) => {
    // Target: overview, or a close-up of the selected codon ("dolly-in" before the hand-off to Mol*).
    const k = sel.codon;
    const close = k !== null && k >= CODON_RANGE[0] && k <= CODON_RANGE[1];
    const y = close ? ((k! - CODON_RANGE[0]) * 3 + 1) * RISE : centreY;
    const dist = close ? (sel.phase === 'protein' ? 2.2 : 4.5) : 15;
    const target = new THREE.Vector3(0, y, 0);
    const pos = new THREE.Vector3(dist, y + (close ? 0.4 : 2), dist * 0.35);
    const s = 1 - Math.pow(0.002, dt); // frame-rate independent ease
    camera.position.lerp(pos, s);
    const look = (camera.userData.look as THREE.Vector3 | undefined) ?? target.clone();
    look.lerp(target, s); camera.userData.look = look; camera.lookAt(look);
  });
  return null;
}

// Overlay only: one layer owns the pointer at a time (R3F in the DNA phase, Mol* in the protein phase).
function EventGate() {
  const sel = useSel();
  const setEvents = useThree((s) => s.setEvents);
  useEffect(() => { if (LAYOUT === 'overlay') setEvents({ enabled: sel.phase === 'dna' }); }, [sel.phase, setEvents]);
  return null;
}

function Dna({ cds }: { cds: string }) {
  const sel = useSel();
  const list = useMemo(() => makeCodons(cds, CODON_RANGE[0], CODON_RANGE[1]), [cds]);
  const spinGroup = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (spin.r3f && spinGroup.current) spinGroup.current.rotation.y += dt * 0.8; });
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1.6} />
      <CameraRig codonCount={list.length} />
      <EventGate />
      <group ref={spinGroup}>
        {list.map((c, i) => (
          <CodonMesh key={c.index} codon={c} offset={i * 3} selected={sel.codon === c.index} onPick={(k) => store.set({ codon: k, source: 'r3f', phase: LAYOUT === 'overlay' ? 'protein' : 'dna' })} />
        ))}
      </group>
    </>
  );
}

// ---------- Mol* side ----------
async function startMolstar(target: HTMLDivElement) {
  const spec = DefaultPluginUISpec();
  spec.layout = { initial: { isExpanded: false, showControls: false } };
  spec.config = [...(spec.config ?? []), [PluginConfig.Viewport.ShowAnimation, false]];
  const plugin = await logCall('createPluginUI', {}, () => createPluginUI({ target, render: renderReact18, spec }));
  window.__plugin = plugin;
  plugin.canvas3d!.setProps({ renderer: { backgroundColor: Color(0x06090f) } } as any);
  await loadStructure(plugin, new URL('data/2HBS.cif', location.href).href);
  // Reverse direction: Mol* click on a beta-chain residue selects the codon in R3F.
  plugin.behaviors.interaction.click.subscribe((e) => {
    if (!StructureElement.Loci.is(e.current.loci)) return;
    const r = readResidues(e.current.loci)[0];
    H.events.push({ type: 'molstar.click', residue: r });
    if (!r || !BETA_CHAINS.includes(r.label_asym_id)) return;
    store.set({ codon: codonForResidue(r.label_seq_id), source: 'molstar' });
  });
  return plugin;
}

let contactsShown = false;
async function molstarShowCodon(plugin: PluginContext, k: number) {
  if (k === 1) { H.events.push({ type: 'molstar.skip', reason: 'codon 1 (Met) is not in the mature chain or the structure' }); return; }
  const target = { label_asym_id: HBS.structureChain, label_seq_id: k - 1 };
  const loci = lociFor(plugin, target);
  plugin.managers.structure.selection.fromLoci('set', loci);
  plugin.managers.interactivity.lociHighlights.highlightOnly({ loci });
  plugin.managers.structure.focus.setFromLoci(loci);
  plugin.managers.camera.focusLoci(loci, { durationMs: 700, extraRadius: 4 });
  if (k === HBS.codon && !contactsShown) {
    contactsShown = true;
    const s = plugin.managers.structure.hierarchy.current.structures[0];
    const comp = await plugin.builders.structure.tryCreateComponentFromExpression(s.cell.transform.ref, residueExpression(HBS_CONTACTS), 'helix-contacts', { label: 'Chain B contacts' });
    if (comp) await plugin.builders.structure.representation.addRepresentation(comp, { type: 'ball-and-stick', color: 'uniform', colorParams: { value: Color(0x2ec4b6) } });
  }
}

// ---------- measurement ----------
async function measure(durationMs: number, opts: { molSpin: boolean; r3fSpin: boolean }) {
  const plugin = window.__plugin;
  let draws = 0;
  const sub = plugin?.canvas3d?.didDraw.subscribe(() => draws++);
  if (plugin && opts.molSpin) plugin.canvas3d!.setProps({ trackball: { animate: { name: 'spin', params: { speed: 0.5, axis: Vec3.create(0, 1, 0) } } } });
  spin.r3f = opts.r3fSpin;
  const deltas: number[] = [];
  await new Promise<void>((resolve) => {
    let last = performance.now(); const start = last;
    const tick = (now: number) => { deltas.push(now - last); last = now; if (now - start < durationMs) requestAnimationFrame(tick); else resolve(); };
    requestAnimationFrame(tick);
  });
  if (plugin) plugin.canvas3d!.setProps({ trackball: { animate: { name: 'off', params: {} } } });
  spin.r3f = false;
  sub?.unsubscribe();
  return { ...opts, ...summarise(deltas.slice(5), draws, durationMs) };
}

export function App() {
  const molRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cds, setCds] = useState<string | null>(null);
  const [plugin, setPlugin] = useState<PluginContext | null>(null);
  const sel = useSel();

  useEffect(() => {
    if (H.started) return; H.started = true;
    const t0 = performance.now();
    (async () => {
      const fa = parseFasta(await (await fetch('data/seq_ENST00000335295_cds.fa')).text());
      H.cds = { id: fa.id, length: fa.seq.length, codon7: fa.seq.slice(18, 21), c20: fa.seq[19] };
      setCds(fa.seq);
      let p: PluginContext | null = null;
      if (WITH_MOLSTAR && molRef.current) {
        p = await startMolstar(molRef.current);
        setPlugin(p);
        // Consistency check: codon k translation vs 2HBS chain H residue k-1 (expect one mismatch: codon 7, GLU vs VAL = HbS).
        H.mappingCheck = makeCodons(fa.seq, 2, CODON_RANGE[1]).map((c) => {
          const r = readResidues(lociFor(p!, { label_asym_id: 'H', label_seq_id: c.index - 1 }))[0];
          return { codon: c.index, bases: c.bases, translated: THREE_LETTER[c.aa], structure: r?.label_comp_id, match: THREE_LETTER[c.aa] === r?.label_comp_id };
        });
      }
      H.loadMs = +(performance.now() - t0).toFixed(1);
      H.ready = true;
    })().catch((e) => { H.error = String(e?.stack ?? e); });
    H.measure = measure;
    H.pick = (k: number, source: Sel['source'] = 'strip') => store.set({ codon: k, source, phase: LAYOUT === 'overlay' ? 'protein' : 'dna' });
    // Screen position (page pixels) of codon k's first backbone sphere, for automated clicks.
    H.codonScreenPos = (k: number) => {
      const { camera, el } = H.r3f; const i = (k - CODON_RANGE[0]) * 3 + 1;
      const v = bpPosition(i).p1.clone().project(camera); const r = el.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
    };
    H.focusResidueCameraOnly = (chain: string, seq: number) => {
      const p = window.__plugin!; p.managers.structure.focus.clear(); p.managers.structure.selection.clear();
      p.managers.camera.focusLoci(lociFor(p, { label_asym_id: chain, label_seq_id: seq }), { durationMs: 0, extraRadius: 3 });
    };
    H.back = () => store.set({ codon: null, source: 'strip', phase: 'dna' });
  }, []);

  // Forward direction: store -> Mol* (unless Mol* was the source).
  useEffect(() => {
    if (!plugin || sel.codon === null || sel.source === 'molstar') return;
    const t = performance.now();
    molstarShowCodon(plugin, sel.codon).then(() => {
      H.lastSync = { codon: sel.codon, source: sel.source, selection: readSelection(plugin), ms: +(performance.now() - t).toFixed(1) };
    });
  }, [plugin, sel.seq]);

  const overlay = LAYOUT === 'overlay';
  const r3fOpacity = overlay && sel.phase === 'protein' ? 0.12 : 1;
  const list = cds ? makeCodons(cds, CODON_RANGE[0], CODON_RANGE[1]) : [];
  const r3f = WITH_R3F && cds && (
    <Canvas
      data-role="r3f"
      camera={{ position: [15, 12, 5], fov: 40 }}
      gl={{ alpha: overlay, antialias: true }}
      eventSource={overlay ? (wrapRef as React.RefObject<HTMLElement>) : undefined}
      style={overlay ? { position: 'absolute', inset: 0, pointerEvents: 'none', opacity: r3fOpacity, transition: 'opacity 600ms ease' } : { background: '#0b1119' }}
      onCreated={({ gl, camera }) => { gl.domElement.dataset.role = 'r3f'; H.r3f = { camera, el: gl.domElement }; }}
    >
      <Dna cds={cds} />
    </Canvas>
  );
  return (
    <div style={{ display: 'grid', gridTemplateRows: '1fr auto', height: '100vh', background: '#06090f', color: '#e8ecef', font: '13px/1.4 system-ui' }}>
      {overlay ? (
        <div ref={wrapRef} style={{ position: 'relative' }}>
          <div ref={molRef} style={{ position: 'absolute', inset: 0, pointerEvents: sel.phase === 'protein' ? 'auto' : 'none' }} />
          {r3f}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ position: 'relative' }}>{r3f}</div>
          <div ref={molRef} style={{ position: 'relative' }} />
        </div>
      )}
      <footer style={{ padding: 8, borderTop: '1px solid #1c2633' }}>
        <div role="toolbar" aria-label="Codons of ENST00000335295.4, c.1 to c.42" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {list.map((c) => (
            <button key={c.index} onClick={() => H.pick(c.index, 'strip')} aria-pressed={sel.codon === c.index}
              style={{ font: '12px ui-monospace', padding: '3px 6px', background: sel.codon === c.index ? '#ffb000' : c.index === HBS.codon ? '#3a2f12' : '#141c27', color: sel.codon === c.index ? '#000' : '#e8ecef', border: '1px solid #2a3647', borderRadius: 4 }}>
              {c.index}:{c.bases} {c.aa}
            </button>
          ))}
          {overlay && <button onClick={() => H.back()} style={{ marginLeft: 12 }}>Back to DNA</button>}
        </div>
        <div style={{ marginTop: 6 }} id="status">
          layout {LAYOUT}; selected codon {sel.codon ?? 'none'} (from {sel.source ?? '-'})
          {sel.codon === HBS.codon && ' : c.19-21 GAG (Glu) reference; 2HBS chain H residue 6 is VAL (HbS, GTG)'}
          {sel.codon !== null && (sel.codon < CODON_RANGE[0] || sel.codon > CODON_RANGE[1]) && ` (outside the displayed DNA window c.1-c.${CODON_RANGE[1] * 3})`}
          {H.lastSync && <> ; Mol* selection read back: {H.lastSync.selection.map((r: any) => `${r.label_comp_id} ${r.label_asym_id}${r.label_seq_id}`).join(', ')}</>}
        </div>
      </footer>
    </div>
  );
}
