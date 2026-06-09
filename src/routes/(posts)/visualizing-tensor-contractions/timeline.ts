// Compiles an EinsumSpec into a fully keyframed scene: every dot, axis line and
// label gets per-channel keyframe tracks, built once per spec. Rendering is then
// a pure sample of (element, channel, time), which makes scrubbing trivial.

import type { EinsumSpec } from './einsum';

export type Ease = 'lin' | 'io' | 'out' | 'in';
export interface Kf {
	t: number;
	v: number;
	e?: Ease; // easing of the segment arriving at this keyframe
}
export type Track = Kf[];

export interface El {
	kind: 'dot' | 'line' | 'label' | 'rect';
	color: string;
	layer: number;
	tracks: Record<string, Track>;
	text?: string;
	fs?: number;
	w?: number; // stroke width
	dash?: string;
	// static rect geometry
	x?: number;
	y?: number;
	wd?: number;
	ht?: number;
	rx?: number;
	fill?: string;
}

export interface Phase {
	key: string;
	label: string;
	desc: string;
	t0: number;
	t1: number;
}

export interface Scene {
	els: El[];
	phases: Phase[];
	duration: number;
}

type Vec = { x: number; y: number };
type Idx = Record<string, number>;

const S = 22; // lattice spacing in the main view
const ZERO: Vec = { x: 0, y: 0 };
const DIR_H: Vec = { x: 1, y: 0 };
const DIR_V: Vec = { x: 0, y: 1 };
const DIR_D: Vec = { x: 0.58, y: -0.42 }; // depth, drawn oblique

const SLOT_A: Vec = { x: 120, y: 175 };
const SLOT_B: Vec = { x: 330, y: 175 };
const SLOT_OUT: Vec = { x: 225, y: 192 };

const MAG = { x: 452, y: 64, w: 226, h: 252 };
const MAG_A: Vec = { x: 510, y: 172 };
const MAG_B: Vec = { x: 622, y: 172 };
const MERGED: Vec = { x: 566, y: 172 };
const SM = 15; // lattice spacing inside the magnifier

const PALETTE = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9'];
const DOT_TINT = ['#8c99ae', '#b09c89']; // cool gray for A, warm gray for B
const COPY_TINT = ['#7e90af', '#ad9176'];
const GHOST = '#c7c9ce';
const OUT_DOT = '#555c66';
const MUTED = '#9aa0a8';

export function letterColors(spec: EinsumSpec): Record<string, string> {
	const colors: Record<string, string> = {};
	spec.letters.forEach((L, i) => (colors[L] = PALETTE[i % PALETTE.length]));
	return colors;
}

const add2 = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const addAll = (...vs: Vec[]): Vec => vs.reduce(add2, ZERO);
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (v: Vec, k: number): Vec => ({ x: v.x * k, y: v.y * k });
const lerpV = (a: Vec, b: Vec, u: number): Vec => ({
	x: a.x + (b.x - a.x) * u,
	y: a.y + (b.y - a.y) * u
});
const norm = (v: Vec): Vec => {
	const l = Math.hypot(v.x, v.y);
	return l < 1e-9 ? { x: -1, y: 0 } : scale(v, 1 / l);
};

// Interpolate direction vectors by angle + length so axis reorientation reads
// as a rotation rather than a collapse through the origin.
function slerp(a: Vec, b: Vec, u: number): Vec {
	if (a.x === b.x && a.y === b.y) return a;
	const a0 = Math.atan2(a.y, a.x);
	const a1 = Math.atan2(b.y, b.x);
	let da = a1 - a0;
	if (da > Math.PI) da -= 2 * Math.PI;
	if (da < -Math.PI) da += 2 * Math.PI;
	const ang = a0 + da * u;
	const len = Math.hypot(a.x, a.y) + (Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y)) * u;
	return { x: Math.cos(ang) * len, y: Math.sin(ang) * len };
}

const EASE_FN: Record<Ease, (u: number) => number> = {
	lin: (u) => u,
	io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
	out: (u) => 1 - Math.pow(1 - u, 3),
	in: (u) => u * u * u
};
const easeIO = EASE_FN.io;

export function sampleTrack(tr: Track, t: number): number {
	if (!tr.length) return 0;
	if (t <= tr[0].t) return tr[0].v;
	for (let i = 1; i < tr.length; i++) {
		if (t <= tr[i].t) {
			const a = tr[i - 1];
			const b = tr[i];
			const dt = b.t - a.t;
			if (dt <= 0) return b.v;
			const u = (t - a.t) / dt;
			return a.v + (b.v - a.v) * EASE_FN[b.e ?? 'io'](u);
		}
	}
	return tr[tr.length - 1].v;
}

function dirsForRank(r: number): Vec[] {
	if (r === 0) return [];
	if (r === 1) return [DIR_V];
	if (r === 2) return [DIR_V, DIR_H];
	return [DIR_D, DIR_V, DIR_H];
}

function enumIdx(letters: string[], sizes: Record<string, number>): Idx[] {
	let out: Idx[] = [{}];
	for (const L of letters) {
		const next: Idx[] = [];
		for (const ix of out) for (let v = 0; v < sizes[L]; v++) next.push({ ...ix, [L]: v });
		out = next;
	}
	return out;
}

function bboxCenter(pts: Vec[]): Vec {
	let x0 = Infinity,
		x1 = -Infinity,
		y0 = Infinity,
		y1 = -Infinity;
	for (const p of pts) {
		x0 = Math.min(x0, p.x);
		x1 = Math.max(x1, p.x);
		y0 = Math.min(y0, p.y);
		y1 = Math.max(y1, p.y);
	}
	return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

interface InputInfo {
	Ls: string[];
	comp: string[];
	lacks: string[];
	eps: Record<string, number>;
	dir0: Record<string, Vec>;
	posArr: (ix: Idx) => Vec;
}

export function buildScene(spec: EinsumSpec): Scene {
	const { inputs, output, letters, roles, sizes } = spec;
	const colors = letterColors(spec);

	const els: El[] = [];
	const kf = (tr: Track, t: number, v: number, e?: Ease) => tr.push({ t, v, e });
	const mkDot = (color: string, layer: number): El => {
		const el: El = { kind: 'dot', color, layer, tracks: { x: [], y: [], r: [], o: [] } };
		els.push(el);
		return el;
	};
	const mkLine = (color: string, layer: number, w: number): El => {
		const el: El = {
			kind: 'line',
			color,
			layer,
			w,
			tracks: { x1: [], y1: [], x2: [], y2: [], o: [] }
		};
		els.push(el);
		return el;
	};
	const mkLabel = (text: string, color: string, fs: number, layer: number): El => {
		const el: El = { kind: 'label', text, color, fs, layer, tracks: { x: [], y: [], o: [] } };
		els.push(el);
		return el;
	};
	const setVec = (el: El, t: number, p: Vec, e?: Ease) => {
		kf(el.tracks.x, t, p.x, e);
		kf(el.tracks.y, t, p.y, e);
	};
	const setLine = (el: El, t: number, p1: Vec, p2: Vec, e?: Ease) => {
		kf(el.tracks.x1, t, p1.x, e);
		kf(el.tracks.y1, t, p1.y, e);
		kf(el.tracks.x2, t, p2.x, e);
		kf(el.tracks.y2, t, p2.y, e);
	};

	// ---- phases ----
	const anyComp = letters.some((L) => roles[L] === 'contracted' || roles[L] === 'summed');
	const phases: Phase[] = [];
	let tcur = 0;
	const addPhase = (key: string, label: string, desc: string, dur: number) => {
		phases.push({ key, label, desc, t0: tcur, t1: tcur + dur });
		tcur += dur;
	};
	addPhase(
		'inputs',
		'inputs',
		'Each input tensor is drawn as its axes. The entries are just gray dots — the shape and meaning of the axes is what matters.',
		0.9
	);
	if (anyComp)
		addPhase(
			'contract',
			'contract',
			"Axes that don't appear in the output are squeezed away. Their dots survive, compressed into little piles.",
			1.5
		);
	addPhase(
		'arrange',
		'arrange',
		'The surviving axes move into the positions the output signature calls for. Same-colored axes land on the same direction.',
		1.7
	);
	addPhase(
		'broadcast',
		'broadcast',
		'Each pile is copied out to every output cell it participates in.',
		1.6
	);
	addPhase(
		'combine',
		'multiply + sum',
		'At every cell, the two piles meet: lone sums collapse, matching piles align and multiply pairwise, and everything sums into a single entry.',
		3.4
	);
	addPhase(
		'result',
		'output',
		'The output tensor, in the same representation the inputs began with.',
		1.2
	);
	const ct = phases.find((p) => p.key === 'contract');
	const ar = phases.find((p) => p.key === 'arrange')!;
	const bc = phases.find((p) => p.key === 'broadcast')!;
	const cb = phases.find((p) => p.key === 'combine')!;
	const rs = phases.find((p) => p.key === 'result')!;
	const duration = tcur;
	const cd = cb.t1 - cb.t0;

	// ---- output frame geometry ----
	const outDirPool = dirsForRank(output.length);
	const outDir: Record<string, Vec> = {};
	output.forEach((L, i) => (outDir[L] = outDirPool[i]));
	let cells = enumIdx(output, sizes);
	if (output.length === 3) cells = [...cells].reverse(); // draw back-to-front
	const relOut = (ix: Idx) => output.reduce((p, L) => add2(p, scale(outDir[L], ix[L] * S)), ZERO);
	const anchorOut = sub(SLOT_OUT, bboxCenter(cells.map(relOut)));
	const cellPos = (ix: Idx) => add2(anchorOut, relOut(ix));

	const repIx: Idx = {};
	output.forEach((L) => (repIx[L] = Math.floor((sizes[L] - 1) / 2)));
	const repPos = cellPos(repIx);

	// ---- input tensors ----
	const infos: InputInfo[] = [];
	const slots = [SLOT_A, SLOT_B];

	for (let w = 0; w < 2; w++) {
		const Ls = inputs[w];
		const dirPool = dirsForRank(Ls.length);
		const dir0: Record<string, Vec> = {};
		Ls.forEach((L, i) => (dir0[L] = dirPool[i]));
		const comp = Ls.filter((L) => !output.includes(L));
		const surv = Ls.filter((L) => output.includes(L));
		const lacks = output.filter((L) => !Ls.includes(L));
		const eps: Record<string, number> = {};
		comp.forEach((L) => (eps[L] = 6 / Math.max(1, sizes[L] - 1)));

		let allIx = enumIdx(Ls, sizes);
		if (Ls.length === 3) allIx = [...allIx].reverse();
		const rel0 = (ix: Idx) => Ls.reduce((p, L) => add2(p, scale(dir0[L], ix[L] * S)), ZERO);
		const anchor0 = sub(slots[w], bboxCenter(allIx.map(rel0)));

		// Where this tensor parks in the output frame: on its own sub-frame, just
		// outside the grid along every output direction it lacks (like row/column
		// headers). If it lacks nothing, a small offset to the side so the two
		// tensors don't overlap.
		const marginOff = lacks.reduce((p, M) => add2(p, scale(outDir[M], -1.35 * S)), ZERO);
		let spare = ZERO;
		if (!lacks.length) {
			const sd = output.length === 2 ? DIR_D : DIR_H;
			spare = scale(sd, S * 0.42 * (w === 0 ? -1 : 1));
		}
		const anchor2 = addAll(anchorOut, marginOff, spare);
		const dirEnd = (L: string) => (output.includes(L) ? outDir[L] : dir0[L]);
		const frameDir = (L: string, u: number) => slerp(dir0[L], dirEnd(L), u);
		const frameAnchor = (u: number) => lerpV(anchor0, anchor2, u);
		// Position with surviving axes at frame-interpolation u; compressed axes
		// stay smudges in their original orientation.
		const posU = (u: number, ix: Idx) => {
			let p = frameAnchor(u);
			for (const L of surv) p = add2(p, scale(frameDir(L, u), ix[L] * S));
			for (const C of comp) p = add2(p, scale(dir0[C], ix[C] * eps[C]));
			return p;
		};
		const pos0 = (ix: Idx) => add2(anchor0, rel0(ix));
		const pos1 = (ix: Idx) => posU(0, ix);
		const posArr = (ix: Idx) => posU(1, ix);

		// dots
		for (const ix of allIx) {
			const depth = Ls.length === 3 ? ix[Ls[0]] : 0;
			const df = 1 - 0.06 * depth;
			const rBase = 2.6 * df;
			const oBase = 0.95 - 0.07 * depth;
			const d = mkDot(DOT_TINT[w], 3);
			kf(d.tracks.r, 0, rBase);
			kf(d.tracks.o, 0, oBase);
			setVec(d, 0, pos0(ix));
			if (ct && comp.length) {
				setVec(d, ct.t0, pos0(ix));
				setVec(d, ct.t1, pos1(ix), 'io');
				kf(d.tracks.r, ct.t0, rBase);
				kf(d.tracks.r, ct.t1, 2.1 * df, 'io');
			}
			const ad = ar.t1 - ar.t0;
			setVec(d, ar.t0, pos1(ix));
			setVec(d, ar.t0 + ad / 3, posU(easeIO(1 / 3), ix), 'lin');
			setVec(d, ar.t0 + (2 * ad) / 3, posU(easeIO(2 / 3), ix), 'lin');
			setVec(d, ar.t1, posArr(ix), 'lin');
			kf(d.tracks.o, rs.t0, oBase);
			kf(d.tracks.o, rs.t0 + 0.6 * (rs.t1 - rs.t0), 0, 'io');
		}

		// axis lines + labels
		for (const L of Ls) {
			const n = sizes[L];
			const isComp = comp.includes(L);
			const others = Ls.filter((x) => x !== L);
			const perpU = (u: number) => {
				if (!others.length) return { x: -10, y: 0 };
				let s = ZERO;
				for (const o of others) s = add2(s, frameDir(o, u));
				return scale(norm(s), -10);
			};
			const axisPt = (u: number, c: number) =>
				addAll(frameAnchor(u), scale(frameDir(L, u), c * S), perpU(u));
			const labelPt = (u: number) => axisPt(u, n - 0.2);

			const ln = mkLine(colors[L], 2, 2.5);
			setLine(ln, 0, axisPt(0, -0.2), axisPt(0, n - 0.8));
			kf(ln.tracks.o, 0, 0.95);
			const lab = mkLabel(L, colors[L], 13, 6);
			setVec(lab, 0, labelPt(0));
			kf(lab.tracks.o, 0, 1);

			if (isComp && ct) {
				setLine(ln, ct.t0, axisPt(0, -0.2), axisPt(0, n - 0.8));
				setLine(ln, ct.t1, axisPt(0, -0.2), axisPt(0, -0.2), 'io');
				kf(ln.tracks.o, ct.t0, 0.95);
				kf(ln.tracks.o, ct.t1, 0, 'io');
				setVec(lab, ct.t0, labelPt(0));
				setVec(lab, ct.t1, axisPt(0, -0.2), 'io');
				kf(lab.tracks.o, ct.t0, 1);
				kf(lab.tracks.o, ct.t0 + 0.7 * (ct.t1 - ct.t0), 0, 'io');
			} else if (!isComp) {
				const ad = ar.t1 - ar.t0;
				setLine(ln, ar.t0, axisPt(0, -0.2), axisPt(0, n - 0.8));
				for (const frac of [1 / 3, 2 / 3, 1]) {
					const u = frac === 1 ? 1 : easeIO(frac);
					setLine(ln, ar.t0 + ad * frac, axisPt(u, -0.2), axisPt(u, n - 0.8), 'lin');
				}
				setVec(lab, ar.t0, labelPt(0));
				for (const frac of [1 / 3, 2 / 3, 1]) {
					const u = frac === 1 ? 1 : easeIO(frac);
					setVec(lab, ar.t0 + ad * frac, labelPt(u), 'lin');
				}
				kf(ln.tracks.o, rs.t0, 0.95);
				kf(ln.tracks.o, rs.t0 + 0.6 * (rs.t1 - rs.t0), 0, 'io');
				kf(lab.tracks.o, rs.t0, 1);
				kf(lab.tracks.o, rs.t0 + 0.6 * (rs.t1 - rs.t0), 0, 'io');
			}
		}

		infos.push({ Ls, comp, lacks, eps, dir0, posArr });
	}

	// ---- output frame: axes, ghost cells, value dots ----
	for (const L of output) {
		const n = sizes[L];
		const others = output.filter((x) => x !== L);
		const perp = others.length
			? scale(norm(others.reduce((p, o) => add2(p, outDir[o]), ZERO)), -10)
			: { x: -10, y: 0 };
		const pt = (c: number) => addAll(anchorOut, scale(outDir[L], c * S), perp);
		const ln = mkLine(colors[L], 0, 2.5);
		setLine(ln, 0, pt(-0.2), pt(n - 0.8));
		kf(ln.tracks.o, 0, 0);
		kf(ln.tracks.o, ar.t0, 0);
		kf(ln.tracks.o, ar.t1, 0.4, 'io');
		kf(ln.tracks.o, rs.t0, 0.4);
		kf(ln.tracks.o, rs.t0 + 0.6 * (rs.t1 - rs.t0), 0.95, 'io');
		const lab = mkLabel(L, colors[L], 13, 6);
		setVec(lab, 0, pt(n - 0.2));
		kf(lab.tracks.o, 0, 0);
		kf(lab.tracks.o, ar.t0, 0);
		kf(lab.tracks.o, ar.t1, 0.45, 'io');
		kf(lab.tracks.o, rs.t0, 0.45);
		kf(lab.tracks.o, rs.t0 + 0.6 * (rs.t1 - rs.t0), 1, 'io');
	}
	for (const cix of cells) {
		const p = cellPos(cix);
		const ghost = mkDot(GHOST, 1);
		setVec(ghost, 0, p);
		kf(ghost.tracks.r, 0, 1.7);
		kf(ghost.tracks.o, 0, 0);
		kf(ghost.tracks.o, ar.t0, 0);
		kf(ghost.tracks.o, ar.t1, 0.5, 'io');
		kf(ghost.tracks.o, cb.t0 + 0.7 * cd, 0.5);
		kf(ghost.tracks.o, cb.t0 + 0.88 * cd, 0, 'io');

		const od = mkDot(OUT_DOT, 5);
		setVec(od, 0, p);
		kf(od.tracks.r, cb.t0 + 0.72 * cd, 0);
		kf(od.tracks.r, cb.t0 + 0.88 * cd, 3.3, 'out');
		kf(od.tracks.o, cb.t0 + 0.72 * cd, 0);
		kf(od.tracks.o, cb.t0 + 0.88 * cd, 1, 'lin');
	}

	// ---- broadcast copies ----
	const bd = bc.t1 - bc.t0;
	for (const cix of cells) {
		for (let w = 0; w < 2; w++) {
			const info = infos[w];
			const pileIxs = enumIdx(info.comp, sizes);
			const stagDen = info.lacks.reduce((s, M) => s + (sizes[M] - 1), 0);
			const stag = stagDen ? info.lacks.reduce((s, M) => s + cix[M], 0) / stagDen : 0;
			const t0 = bc.t0 + 0.3 * bd * stag;
			const t1 = t0 + 0.55 * bd;
			const side: Vec = w === 0 ? { x: -3.6, y: -2.5 } : { x: 3.6, y: 2.5 };
			for (const pix of pileIxs) {
				const srcIx: Idx = {};
				for (const L of info.Ls) srcIx[L] = info.comp.includes(L) ? pix[L] : cix[L];
				const src = info.posArr(srcIx);
				const smudge = info.comp.reduce(
					(p, C) => add2(p, scale(info.dir0[C], pix[C] * info.eps[C])),
					ZERO
				);
				const dst = addAll(cellPos(cix), side, smudge);
				const c = mkDot(COPY_TINT[w], 4);
				kf(c.tracks.r, 0, 1.7);
				kf(c.tracks.o, 0, 0);
				kf(c.tracks.o, t0, 0);
				kf(c.tracks.o, t0 + 0.15 * bd, 0.95, 'lin');
				setVec(c, t0, src);
				setVec(c, t1, dst, 'io');
				setVec(c, cb.t0 + 0.6 * cd, dst);
				setVec(c, cb.t0 + 0.78 * cd, add2(cellPos(cix), scale(side, 0.12)), 'io');
				kf(c.tracks.o, cb.t0 + 0.66 * cd, 0.95);
				kf(c.tracks.o, cb.t0 + 0.84 * cd, 0, 'io');
			}
		}
	}

	// ---- representative-cell highlight + magnifier frame ----
	const showAt = (tr: Track, t: number, v: number) => {
		kf(tr, 0, 0);
		kf(tr, t - 0.25, 0);
		kf(tr, t, v, 'io');
	};
	const hl: El = {
		kind: 'rect',
		color: '#787f8a',
		layer: 6,
		x: repPos.x - 9,
		y: repPos.y - 9,
		wd: 18,
		ht: 18,
		rx: 5,
		fill: 'none',
		tracks: { o: [] }
	};
	els.push(hl);
	showAt(hl.tracks.o, bc.t1, 0.9);
	const conn1 = mkLine('#c9cbd0', 6, 1);
	conn1.dash = '3 3';
	setLine(conn1, 0, { x: repPos.x + 9, y: repPos.y - 9 }, { x: MAG.x, y: MAG.y + 6 });
	showAt(conn1.tracks.o, bc.t1, 0.55);
	const conn2 = mkLine('#c9cbd0', 6, 1);
	conn2.dash = '3 3';
	setLine(conn2, 0, { x: repPos.x + 9, y: repPos.y + 9 }, { x: MAG.x, y: MAG.y + MAG.h - 6 });
	showAt(conn2.tracks.o, bc.t1, 0.55);
	const box: El = {
		kind: 'rect',
		color: '#d8dade',
		layer: 7,
		x: MAG.x,
		y: MAG.y,
		wd: MAG.w,
		ht: MAG.h,
		rx: 8,
		fill: '#ffffff',
		tracks: { o: [] }
	};
	els.push(box);
	showAt(box.tracks.o, bc.t1, 1);
	const cap = mkLabel('at every output cell:', MUTED, 10, 8);
	setVec(cap, 0, { x: MAG.x + MAG.w / 2, y: MAG.y + 20 });
	showAt(cap.tracks.o, bc.t1, 0.9);

	// ---- magnifier ritual ----
	// sub-windows within the combine phase
	const ex0 = cb.t0 + 0.02 * cd,
		ex1 = cb.t0 + 0.16 * cd;
	const cl0 = cb.t0 + 0.2 * cd,
		cl1 = cb.t0 + 0.34 * cd;
	const al0 = cb.t0 + 0.4 * cd,
		al1 = cb.t0 + 0.54 * cd;
	const mu0 = cb.t0 + 0.58 * cd,
		mu1 = cb.t0 + 0.74 * cd;
	const sm0 = cb.t0 + 0.8 * cd,
		sm1 = cb.t0 + 0.94 * cd;

	const shared = letters.filter((L) => roles[L] === 'contracted');
	const poolM = [DIR_V, DIR_H, DIR_D];
	const dirM: Record<string, Vec> = {};
	shared.forEach((L, i) => (dirM[L] = poolM[i]));
	const sharedIxs = enumIdx(shared, sizes);
	const relSharedRaw = (ix: Idx) =>
		shared.reduce((p, L) => add2(p, scale(dirM[L], ix[L] * SM)), ZERO);
	const sharedCenter = bboxCenter(sharedIxs.map(relSharedRaw));
	const relShared = (ix: Idx) => sub(relSharedRaw(ix), sharedCenter);
	const alignOff: Vec = shared.length <= 1 ? { x: 18, y: 0 } : { x: 6, y: -5 };

	for (let w = 0; w < 2; w++) {
		const info = infos[w];
		const solo = info.comp.filter((L) => !shared.includes(L));
		const pileLs = [...shared, ...solo];
		const dirP: Record<string, Vec> = {};
		pileLs.forEach((L, i) => (dirP[L] = poolM[i]));
		const pixs = enumIdx(pileLs, sizes);
		const relRaw = (ix: Idx) => pileLs.reduce((p, L) => add2(p, scale(dirP[L], ix[L] * SM)), ZERO);
		const ctr = bboxCenter(pixs.map(relRaw));
		const rel = (ix: Idx) => sub(relRaw(ix), ctr);
		const relCollapsed = (ix: Idx) => {
			const c: Idx = { ...ix };
			for (const L of solo) c[L] = (sizes[L] - 1) / 2;
			return rel(c);
		};
		const center0 = w === 0 ? MAG_A : MAG_B;
		const alignedCenter =
			w === 0 ? sub(MERGED, scale(alignOff, 0.5)) : add2(MERGED, scale(alignOff, 0.5));

		for (const pix of pixs) {
			const m = mkDot(COPY_TINT[w], 8);
			kf(m.tracks.r, 0, 3.2);
			kf(m.tracks.o, 0, 0);
			kf(m.tracks.o, ex0, 0);
			kf(m.tracks.o, ex1, 0.95, 'lin');
			setVec(m, ex0, add2(center0, scale(rel(pix), 0.15)));
			setVec(m, ex1, add2(center0, rel(pix)), 'io');
			if (solo.length) {
				setVec(m, cl0, add2(center0, rel(pix)));
				setVec(m, cl1, add2(center0, relCollapsed(pix)), 'io');
				kf(m.tracks.r, cl0, 3.2);
				kf(m.tracks.r, cl1, 3.7, 'io');
			}
			setVec(m, al0, add2(center0, relCollapsed(pix)));
			setVec(m, al1, add2(alignedCenter, relShared(pix)), 'io');
			setVec(m, mu0, add2(alignedCenter, relShared(pix)));
			setVec(m, mu1, add2(MERGED, relShared(pix)), 'io');
			kf(m.tracks.o, mu0, 0.95);
			kf(m.tracks.o, mu1, 0, 'io');
		}

		// tiny colored axes inside the magnifier, so you can see which index each
		// pile is still indexed by
		for (const L of pileLs) {
			const n = sizes[L];
			const others = pileLs.filter((x) => x !== L);
			const perp = others.length
				? scale(norm(others.reduce((p, o) => add2(p, dirP[o]), ZERO)), -7)
				: { x: -7, y: 0 };
			const corner = sub(center0, ctr);
			const pt = (c: number) => addAll(corner, scale(dirP[L], c * SM), perp);
			const ln = mkLine(colors[L], 8, 2);
			setLine(ln, 0, pt(-0.2), pt(n - 0.8));
			kf(ln.tracks.o, 0, 0);
			kf(ln.tracks.o, ex0, 0);
			kf(ln.tracks.o, ex1, 0.85, 'lin');
			const lab = mkLabel(L, colors[L], 10, 8);
			setVec(lab, 0, pt(n - 0.2));
			kf(lab.tracks.o, 0, 0);
			kf(lab.tracks.o, ex0, 0);
			kf(lab.tracks.o, ex1, 0.9, 'lin');
			const fadeAt = solo.includes(L) ? cl0 : al0;
			const fadeEnd = solo.includes(L) ? cl1 : al0 + 0.6 * (al1 - al0);
			kf(ln.tracks.o, fadeAt, 0.85);
			kf(ln.tracks.o, fadeEnd, 0, 'io');
			kf(lab.tracks.o, fadeAt, 0.9);
			kf(lab.tracks.o, fadeEnd, 0, 'io');
		}
	}

	// product dots, then the summed result dot
	for (const six of sharedIxs) {
		const p = mkDot('#6e7480', 8);
		kf(p.tracks.r, 0, 3.6);
		setVec(p, mu0, add2(MERGED, relShared(six)));
		setVec(p, sm0, add2(MERGED, relShared(six)));
		setVec(p, sm1, MERGED, 'io');
		kf(p.tracks.o, mu0 + 0.3 * (mu1 - mu0), 0);
		kf(p.tracks.o, mu1, 1, 'lin');
		kf(p.tracks.o, sm0 + 0.5 * (sm1 - sm0), 1);
		kf(p.tracks.o, sm1, 0, 'io');
	}
	const res = mkDot('#454c57', 9);
	setVec(res, 0, MERGED);
	kf(res.tracks.r, sm0 + 0.4 * (sm1 - sm0), 0);
	kf(res.tracks.r, sm1, 5, 'out');
	kf(res.tracks.r, sm1 + 0.15, 4.2, 'io');
	kf(res.tracks.o, sm0 + 0.4 * (sm1 - sm0), 0);
	kf(res.tracks.o, sm1, 1, 'lin');

	// little ×, Σ annotations during the merge ritual
	const glyphPos = { x: MERGED.x, y: MAG.y + MAG.h - 26 };
	const mult = mkLabel('×', MUTED, 14, 8);
	setVec(mult, 0, glyphPos);
	kf(mult.tracks.o, mu0, 0);
	kf(mult.tracks.o, mu0 + 0.2 * (mu1 - mu0), 0.85, 'lin');
	kf(mult.tracks.o, sm0 - 0.05, 0.85);
	kf(mult.tracks.o, sm0, 0, 'lin');
	const sig = mkLabel('Σ', MUTED, 13, 8);
	setVec(sig, 0, glyphPos);
	kf(sig.tracks.o, sm0, 0);
	kf(sig.tracks.o, sm0 + 0.2 * (sm1 - sm0), 0.85, 'lin');
	kf(sig.tracks.o, rs.t0, 0.85);
	kf(sig.tracks.o, rs.t0 + 0.3, 0, 'lin');
	const note = mkLabel('= one entry of the output', MUTED, 10, 8);
	setVec(note, 0, glyphPos);
	kf(note.tracks.o, rs.t0, 0);
	kf(note.tracks.o, rs.t0 + 0.4, 0.9, 'lin');

	els.sort((a, b) => a.layer - b.layer);
	return { els, phases, duration };
}
