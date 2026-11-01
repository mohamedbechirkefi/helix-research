// SPDX-License-Identifier: LicenseRef-Helix-NC-Research-1.0
//
// P1.4.1: the imperative Mol* calls Helix needs, in one place.
// Every call goes through `logCall` so the experiment produces an API log.

import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { Expression } from 'molstar/lib/mol-script/language/expression';
import { Script } from 'molstar/lib/mol-script/script';
import { StructureElement, StructureProperties as SP, StructureSelection, Structure } from 'molstar/lib/mol-model/structure';
import { Color } from 'molstar/lib/mol-util/color';
import { StateObjectRef } from 'molstar/lib/mol-state';
import { PluginStateObject as SO } from 'molstar/lib/mol-plugin-state/objects';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { loadMVS } from 'molstar/lib/extensions/mvs/load';
import { MVSData } from 'molstar/lib/extensions/mvs/mvs-data';

export type CallLogEntry = { t: number; call: string; args?: unknown; ms?: number };
export const callLog: CallLogEntry[] = [];
const t0 = performance.now();

export async function logCall<T>(call: string, args: unknown, fn: () => T | Promise<T>): Promise<T> {
  const start = performance.now();
  const out = await fn();
  callLog.push({ t: +(start - t0).toFixed(1), call, args, ms: +(performance.now() - start).toFixed(1) });
  return out;
}

/** Semantic target as Helix resolves it (label_* numbering, verified in research/hbs-mapping-note.md). */
export type ResidueTarget = { label_asym_id: string; label_seq_id: number };
export type ResidueRangeTarget = { label_asym_id: string; label_seq_ids: number[] };

export const HBS_TARGET: ResidueTarget = { label_asym_id: 'H', label_seq_id: 6 };
/** Chain B residues within 4.5 A of chain H Val6 (research/derived/val6_contacts_2HBS.json, waters excluded). */
export const HBS_CONTACTS: ResidueRangeTarget = { label_asym_id: 'B', label_seq_ids: [70, 73, 84, 85, 88] };

export function residueExpression(t: ResidueTarget | ResidueRangeTarget): Expression {
  const seqIds = 'label_seq_id' in t ? [t.label_seq_id] : t.label_seq_ids;
  return MS.struct.generator.atomGroups({
    'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.label_asym_id(), t.label_asym_id]),
    'residue-test': MS.core.set.has([MS.set(...seqIds), MS.struct.atomProperty.macromolecular.label_seq_id()]),
  });
}

export function currentStructure(plugin: PluginContext): { ref: string; data: Structure } | undefined {
  const s = plugin.managers.structure.hierarchy.current.structures[0];
  if (!s?.cell.obj) return undefined;
  return { ref: s.cell.transform.ref, data: s.cell.obj.data };
}

export function lociFor(plugin: PluginContext, t: ResidueTarget | ResidueRangeTarget): StructureElement.Loci {
  const s = currentStructure(plugin);
  if (!s) throw new Error('no structure loaded');
  const sel = Script.getStructureSelection(residueExpression(t), s.data);
  return StructureSelection.toLociWithSourceUnits(sel);
}

export async function loadStructure(plugin: PluginContext, url: string) {
  const data = await logCall('plugin.builders.data.download', { url, isBinary: false }, () =>
    plugin.builders.data.download({ url, isBinary: false }, { state: { isGhost: true } }));
  const trajectory = await logCall('plugin.builders.structure.parseTrajectory', 'mmcif', () =>
    plugin.builders.structure.parseTrajectory(data, 'mmcif'));
  // 'model' = the asymmetric unit. The default preset builds assembly 1 (chains A-D only for 2HBS),
  // which does NOT contain chain H: the HbS contact H:Val6 to chain B is between the two tetramers of the AU.
  await logCall('plugin.builders.structure.hierarchy.applyPreset', { preset: 'default', structure: 'model' }, () =>
    plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default', { structure: { name: 'model', params: {} } }));
}

/** Residue identity read back from a loci (one row per residue). */
export type ResidueReadback = {
  label_asym_id: string; auth_asym_id: string; label_seq_id: number; auth_seq_id: number;
  label_comp_id: string; entity_id: string; atoms: number;
};

export function readResidues(loci: StructureElement.Loci): ResidueReadback[] {
  const rows = new Map<string, ResidueReadback>();
  StructureElement.Loci.forEachLocation(loci, (loc) => {
    const key = `${SP.chain.label_asym_id(loc)}:${SP.residue.label_seq_id(loc)}`;
    const row = rows.get(key);
    if (row) { row.atoms++; return; }
    rows.set(key, {
      label_asym_id: SP.chain.label_asym_id(loc), auth_asym_id: SP.chain.auth_asym_id(loc),
      label_seq_id: SP.residue.label_seq_id(loc), auth_seq_id: SP.residue.auth_seq_id(loc),
      label_comp_id: SP.atom.label_comp_id(loc), entity_id: SP.entity.id(loc), atoms: 1,
    });
  });
  return [...rows.values()];
}

/** Read the selection back from the plugin's selection manager (not from our own variables). */
export function readSelection(plugin: PluginContext): ResidueReadback[] {
  const s = currentStructure(plugin);
  if (!s) return [];
  const loci = plugin.managers.structure.selection.getLoci(s.data);
  return StructureElement.Loci.is(loci) ? readResidues(loci) : [];
}

/** Read the focus back from the focus manager. */
export function readFocus(plugin: PluginContext): ResidueReadback[] {
  const f = plugin.managers.structure.focus.current;
  return f ? readResidues(f.loci) : [];
}

const AMBER = Color(0xffb000);
const TEAL = Color(0x2ec4b6);

/** Select, highlight, focus and label one residue; add a coloured component for persistent emphasis. */
export async function showResidue(plugin: PluginContext, target: ResidueTarget, opts: { contacts?: ResidueRangeTarget } = {}) {
  const s = currentStructure(plugin)!;
  const loci = lociFor(plugin, target);
  if (StructureElement.Loci.size(loci) === 0) throw new Error(`target not found: ${JSON.stringify(target)}`);

  await logCall('plugin.managers.structure.selection.fromLoci', { modifier: 'set' }, () =>
    plugin.managers.structure.selection.fromLoci('set', loci));
  await logCall('plugin.managers.interactivity.lociHighlights.highlightOnly', {}, () =>
    plugin.managers.interactivity.lociHighlights.highlightOnly({ loci }));
  await logCall('plugin.managers.structure.focus.setFromLoci', {}, () =>
    plugin.managers.structure.focus.setFromLoci(loci));
  await logCall('plugin.managers.camera.focusLoci', { durationMs: 600, extraRadius: 4 }, () =>
    plugin.managers.camera.focusLoci(loci, { durationMs: 600, extraRadius: 4 }));

  // Persistent emphasis: a component + representation, so it survives selection changes.
  await plugin.dataTransaction(async () => {
    const comp = await logCall('plugin.builders.structure.tryCreateComponentFromExpression', target, () =>
      plugin.builders.structure.tryCreateComponentFromExpression(s.ref as StateObjectRef<SO.Molecule.Structure>, residueExpression(target), 'helix-target', { label: `HbS ${target.label_asym_id} ${target.label_seq_id}` }));
    if (comp) await logCall('plugin.builders.structure.representation.addRepresentation', { type: 'ball-and-stick', color: 'amber' }, () =>
      plugin.builders.structure.representation.addRepresentation(comp, { type: 'ball-and-stick', color: 'uniform', colorParams: { value: AMBER }, typeParams: { sizeFactor: 0.35 } }));
    if (opts.contacts) {
      const c = await logCall('plugin.builders.structure.tryCreateComponentFromExpression', opts.contacts, () =>
        plugin.builders.structure.tryCreateComponentFromExpression(s.ref as StateObjectRef<SO.Molecule.Structure>, residueExpression(opts.contacts!), 'helix-contacts', { label: 'Chain B contacts' }));
      if (c) await logCall('plugin.builders.structure.representation.addRepresentation', { type: 'ball-and-stick', color: 'teal' }, () =>
        plugin.builders.structure.representation.addRepresentation(c, { type: 'ball-and-stick', color: 'uniform', colorParams: { value: TEAL }, typeParams: { sizeFactor: 0.25 } }));
    }
  });
  await logCall('plugin.managers.structure.measurement.addLabel', {}, () =>
    plugin.managers.structure.measurement.addLabel(loci, { labelParams: { customText: 'HbS: Val6 (chain H)' } as any }));
}

/** MolViewSpec version of the same view (declarative). */
export function buildMvs(structureUrl: string): MVSData {
  const b = MVSData.createBuilder();
  const struct = b.download({ url: structureUrl }).parse({ format: 'mmcif' }).modelStructure();
  struct.component({ selector: 'polymer' }).representation({ type: 'cartoon' }).color({ color: '#8fa3b8' });
  const target = struct.component({ selector: { label_asym_id: 'H', label_seq_id: 6 } });
  target.representation({ type: 'ball_and_stick' }).color({ color: '#ffb000' });
  target.label({ text: 'HbS: Val6 (chain H)' });
  target.tooltip({ text: 'beta chain H, label_seq_id 6, VAL (E6V)' });
  target.focus({ radius_extent: 4 });
  const contacts = struct.component({
    selector: [70, 73, 84, 85, 88].map((n) => ({ label_asym_id: 'B', label_seq_id: n })),
  });
  contacts.representation({ type: 'ball_and_stick' }).color({ color: '#2ec4b6' });
  contacts.label({ text: 'chain B contacts' });
  b.canvas({ background_color: '#06090f' });
  return b.getState();
}

export async function loadMvsView(plugin: PluginContext, data: MVSData) {
  const issues = MVSData.validationIssues(data);
  callLog.push({ t: +(performance.now() - t0).toFixed(1), call: 'MVSData.validationIssues', args: issues ?? 'valid' });
  await logCall('loadMVS', { replaceExisting: true, sanityChecks: true }, () =>
    loadMVS(plugin, data, { sanityChecks: true, sourceUrl: window.location.href }));
}

/** WebGL and WebGPU capability probe (used by P1.4.1 and the Tauri shell). */
export async function probeGpu(plugin?: PluginContext) {
  const out: Record<string, unknown> = { userAgent: navigator.userAgent };
  const c = document.createElement('canvas');
  const gl2 = c.getContext('webgl2') as WebGL2RenderingContext | null;
  out.webgl2 = !!gl2;
  if (gl2) {
    const dbg = gl2.getExtension('WEBGL_debug_renderer_info');
    out.webglRenderer = dbg ? gl2.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl2.getParameter(gl2.RENDERER);
    out.webglVendor = dbg ? gl2.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl2.getParameter(gl2.VENDOR);
    out.webglVersion = gl2.getParameter(gl2.VERSION);
    out.maxTextureSize = gl2.getParameter(gl2.MAX_TEXTURE_SIZE);
    gl2.getExtension('WEBGL_lose_context')?.loseContext();
  }
  const nav = navigator as Navigator & { gpu?: { requestAdapter: () => Promise<any> } };
  out.navigatorGpu = typeof nav.gpu !== 'undefined';
  if (nav.gpu) {
    try {
      const adapter = await nav.gpu.requestAdapter();
      out.webgpuAdapter = !!adapter;
      if (adapter) {
        out.webgpuAdapterInfo = adapter.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, description: adapter.info.description } : 'no info';
        out.webgpuShaderF16 = adapter.features?.has?.('shader-f16') ?? null;
        out.webgpuMaxBufferSize = adapter.limits?.maxBufferSize ?? null;
        const device = await adapter.requestDevice();
        out.webgpuDevice = !!device;
        device.destroy?.();
      }
    } catch (e) { out.webgpuError = String(e); }
  }
  if (plugin?.canvas3d) out.molstarWebgl2 = plugin.canvas3d.webgl.isWebGL2;
  return out;
}

/** Spin the camera and sample frame intervals (rAF) plus Mol* draw count. */
export async function measureFrames(plugin: PluginContext, durationMs = 5000) {
  const canvas3d = plugin.canvas3d!;
  let draws = 0;
  const sub = canvas3d.didDraw.subscribe(() => { draws++; });
  canvas3d.setProps({ trackball: { animate: { name: 'spin', params: { speed: 0.5, axis: Vec3.create(0, 1, 0) } } } });
  const deltas: number[] = [];
  await new Promise<void>((resolve) => {
    let last = performance.now();
    const start = last;
    const tick = (now: number) => {
      deltas.push(now - last); last = now;
      if (now - start < durationMs) requestAnimationFrame(tick); else resolve();
    };
    requestAnimationFrame(tick);
  });
  canvas3d.setProps({ trackball: { animate: { name: 'off', params: {} } } });
  sub.unsubscribe();
  return summarise(deltas.slice(5), draws, durationMs);
}

export function summarise(deltas: number[], draws: number, durationMs: number) {
  const s = [...deltas].sort((a, b) => a - b);
  const q = (p: number) => +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2);
  return {
    frames: s.length, molstarDraws: draws, durationMs,
    meanMs: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2),
    p50Ms: q(0.5), p95Ms: q(0.95), p99Ms: q(0.99), maxMs: +s[s.length - 1].toFixed(2),
    over20ms: s.filter((x) => x > 20).length,
  };
}
