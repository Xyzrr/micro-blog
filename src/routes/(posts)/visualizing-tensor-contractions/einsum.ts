// Pure logic for the einsum contraction visualization.
// No Svelte here: parse a preset, classify its index letters into roles,
// and sample the whole animated scene at a given global progress in [0, 1].

export interface Vec {
	x: number;
	y: number;
}

export interface Spec {
	a: string[];
	b: string[];
	out: string[];
}

export type Role = 'batch' | 'freeA' | 'freeB' | 'contracted' | 'redA' | 'redB';

export interface Preset {
	label: string;
	expr: string;
}

export const PRESETS: Preset[] = [
	{ label: 'matmul', expr: 'ij,jk->ik' },
	{ label: 'batched matmul', expr: 'bij,bjk->bik' },
	{ label: 'matrix x vector', expr: 'ij,j->i' },
	{ label: 'dot product', expr: 'i,i->' },
	{ label: 'outer product', expr: 'i,j->ij' },
	{ label: 'hadamard', expr: 'ij,ij->ij' },
	{ label: 'reduction', expr: 'ij,jk->k' },
	{ label: 'rank-3', expr: 'ijk,ikl->ijl' }
];

// --- geometry constants -----------------------------------------------------

const U = 30; // spacing between dots along an axis
const MICRO = 5; // spacing once an axis is squeezed
// Axis directions by slot: 0 -> down, 1 -> right, 2 -> depth (isometric).
const DIRS: Vec[] = [
	{ x: 0, y: 1 },
	{ x: 1, y: 0 },
	{ x: 0.55, y: -0.42 }
];

export const VIEW = { w: 420, h: 300 };
export const MAG = { w: 180, h: 210 };

const SIZE_MAP: Record<string, number> = {
	i: 3,
	j: 4,
	k: 3,
	l: 2,
	m: 3,
	n: 2,
	b: 2,
	p: 3,
	q: 3
};
const sizeOf = (l: string): number => SIZE_MAP[l] ?? 3;

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6', '#ec4899'];
const DOT_GRAY = '#b6b4ba';
const RESULT_GRAY = '#86848a';
const GHOST = '#c7c5cb';

// --- small math helpers -----------------------------------------------------

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const easeInOut = (t: number): number =>
	t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smooth = (t: number): number => {
	const c = clamp(t, 0, 1);
	return c * c * (3 - 2 * c);
};

function mixHex(a: string, b: string, t: number): string {
	const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
	const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
	const mixed = pa.map((v, i) => Math.round(lerp(v, pb[i], clamp(t, 0, 1))));
	return '#' + mixed.map((v) => v.toString(16).padStart(2, '0')).join('');
}

type Idx = Record<string, number>;

function combos(letters: string[]): Idx[] {
	let res: Idx[] = [{}];
	for (const l of letters) {
		const next: Idx[] = [];
		for (const r of res) for (let v = 0; v < sizeOf(l); v++) next.push({ ...r, [l]: v });
		res = next;
	}
	return res;
}

// --- parsing + classification ----------------------------------------------

export function parseEinsum(raw: string): Spec {
	const [lhs, rhs = ''] = raw.split('->');
	const [aStr = '', bStr = ''] = lhs.split(',');
	return {
		a: [...aStr.trim()],
		b: [...bStr.trim()],
		out: [...rhs.trim()]
	};
}

export function classify(spec: Spec): Map<string, Role> {
	const inA = new Set(spec.a);
	const inB = new Set(spec.b);
	const inO = new Set(spec.out);
	const roles = new Map<string, Role>();
	const all = new Set([...spec.a, ...spec.b, ...spec.out]);
	for (const l of all) {
		const a = inA.has(l);
		const b = inB.has(l);
		const o = inO.has(l);
		let r: Role;
		if (a && b && o) r = 'batch';
		else if (a && b) r = 'contracted';
		else if (a && o) r = 'freeA';
		else if (b && o) r = 'freeB';
		else if (a) r = 'redA';
		else r = 'redB';
		roles.set(l, r);
	}
	return roles;
}

// --- model ------------------------------------------------------------------

export interface Model {
	raw: string;
	spec: Spec;
	roles: Map<string, Role>;
	colors: Map<string, string>;
	contracted: string[];
	aSqueezed: string[];
	bSqueezed: string[];
	aIn: Vec;
	bIn: Vec;
	outOrigin: Vec;
	aDots: Idx[];
	bDots: Idx[];
	outCells: Idx[];
	contractCombos: Idx[];
	K: number;
}

function colorMap(spec: Spec): Map<string, string> {
	const seen = new Set<string>();
	const order: string[] = [];
	for (const l of [...spec.a, ...spec.b, ...spec.out])
		if (!seen.has(l)) {
			seen.add(l);
			order.push(l);
		}
	const m = new Map<string, string>();
	order.forEach((l, i) => m.set(l, PALETTE[i % PALETTE.length]));
	return m;
}

function pointFor(letters: string[], idx: Idx, spacing: (l: string, slot: number) => number): Vec {
	let p: Vec = { x: 0, y: 0 };
	letters.forEach((l, slot) => {
		p = add(p, mul(DIRS[slot], (idx[l] ?? 0) * spacing(l, slot)));
	});
	return p;
}

function centerOrigin(center: Vec, letters: string[]): Vec {
	const pts = combos(letters).map((idx) => pointFor(letters, idx, () => U));
	const xs = pts.map((p) => p.x);
	const ys = pts.map((p) => p.y);
	const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
	const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
	return { x: center.x - cx, y: center.y - cy };
}

export function buildModel(raw: string): Model {
	const spec = parseEinsum(raw);
	const roles = classify(spec);
	const roleOf = (l: string) => roles.get(l) as Role;
	const contracted = spec.a.filter((l) => roleOf(l) === 'contracted');
	const aSqueezed = spec.a.filter((l) => roleOf(l) === 'contracted' || roleOf(l) === 'redA');
	const bSqueezed = spec.b.filter((l) => roleOf(l) === 'contracted' || roleOf(l) === 'redB');
	const K = contracted.reduce((p, l) => p * sizeOf(l), 1);
	return {
		raw,
		spec,
		roles,
		colors: colorMap(spec),
		contracted,
		aSqueezed,
		bSqueezed,
		aIn: centerOrigin({ x: 110, y: 150 }, spec.a),
		bIn: centerOrigin({ x: 320, y: 150 }, spec.b),
		outOrigin: centerOrigin({ x: 210, y: 150 }, spec.out),
		aDots: combos(spec.a),
		bDots: combos(spec.b),
		outCells: combos(spec.out),
		contractCombos: combos(contracted),
		K
	};
}

// --- phases -----------------------------------------------------------------

interface Phase {
	key: string;
	dur: number;
}
const PHASES: Phase[] = [
	{ key: 'intro', dur: 0.08 },
	{ key: 'squeeze', dur: 0.22 },
	{ key: 'arrange', dur: 0.15 },
	{ key: 'broadcast', dur: 0.15 },
	{ key: 'resolve', dur: 0.4 }
];

function phaseBounds(key: string): [number, number] {
	let start = 0;
	for (const p of PHASES) {
		if (p.key === key) return [start, start + p.dur];
		start += p.dur;
	}
	return [0, 1];
}
function localRaw(progress: number, key: string): number {
	const [s, e] = phaseBounds(key);
	return clamp((progress - s) / (e - s), 0, 1);
}
function currentPhase(progress: number): string {
	let start = 0;
	for (const p of PHASES) {
		if (progress < start + p.dur) return p.key;
		start += p.dur;
	}
	return PHASES[PHASES.length - 1].key;
}

// --- sampled scene ----------------------------------------------------------

export interface Dot {
	key: string;
	x: number;
	y: number;
	r: number;
	opacity: number;
	fill: string;
}
export interface Axis {
	key: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	color: string;
	opacity: number;
	letter: string;
	label: string;
	lx: number;
	ly: number;
}
export interface MagState {
	active: boolean;
	label: string;
	aDots: Dot[];
	bDots: Dot[];
	prodDots: Dot[];
	sumDot: Dot | null;
}
export interface Scene {
	phase: string;
	caption: string;
	axes: Axis[];
	dots: Dot[];
	highlight: { x: number; y: number; r: number; opacity: number } | null;
	mag: MagState;
}

const AX_PAD = U; // perpendicular gap between dots and their axis (one cell of spacing)
const AX_EXT = 7; // how far the axis extends past the end dots
const unit = (v: Vec): Vec => {
	const m = Math.hypot(v.x, v.y) || 1;
	return { x: v.x / m, y: v.y / m };
};
const centroidOf = (pts: Vec[]): Vec => {
	if (pts.length === 0) return { x: 0, y: 0 };
	const s = pts.reduce((a, p) => add(a, p), { x: 0, y: 0 });
	return { x: s.x / pts.length, y: s.y / pts.length };
};
function buildAxis(
	key: string,
	letter: string,
	label: string,
	color: string,
	opacity: number,
	p0: Vec,
	p1: Vec,
	centroid: Vec
): Axis {
	const d = unit({ x: p1.x - p0.x, y: p1.y - p0.y });
	let pe: Vec = { x: -d.y, y: d.x };
	const mid: Vec = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
	const away: Vec = { x: mid.x - centroid.x, y: mid.y - centroid.y };
	if (pe.x * away.x + pe.y * away.y < 0) pe = { x: -pe.x, y: -pe.y };
	const ox = pe.x * AX_PAD;
	const oy = pe.y * AX_PAD;
	const x1 = p0.x + ox - d.x * AX_EXT;
	const y1 = p0.y + oy - d.y * AX_EXT;
	const x2 = p1.x + ox + d.x * AX_EXT;
	const y2 = p1.y + oy + d.y * AX_EXT;
	const lead = label.length > 2 ? 14 : 9;
	return {
		key,
		x1,
		y1,
		x2,
		y2,
		color,
		opacity,
		letter,
		label,
		lx: x2 + d.x * lead,
		ly: y2 + d.y * lead
	};
}

const keyOf = (idx: Idx): string =>
	Object.keys(idx)
		.sort()
		.map((k) => `${k}${idx[k]}`)
		.join('');

export function sample(
	model: Model,
	progress: number,
	labels: Record<string, string> = {}
): Scene {
	const { spec, colors, aSqueezed, bSqueezed, contracted, outOrigin } = model;
	const labelOf = (l: string): string => labels[l] ?? l;

	const squeezeT = easeInOut(localRaw(progress, 'squeeze'));
	const arrangeT = easeInOut(localRaw(progress, 'arrange'));
	const broadcastT = easeInOut(localRaw(progress, 'broadcast'));
	const bcastRaw = localRaw(progress, 'broadcast');
	const resolveRaw = localRaw(progress, 'resolve');
	const phase = currentPhase(progress);

	// Resolve happens for every cell at once, in three slow stages:
	// reorient the perpendicular vectors parallel -> multiply -> sum.
	const K = Math.max(model.K, 1);
	const ro = smooth(clamp((resolveRaw - 0.08) / 0.34, 0, 1));
	const mp = smooth(clamp((resolveRaw - 0.46) / 0.27, 0, 1));
	const sm = smooth(clamp((resolveRaw - 0.76) / 0.24, 0, 1));

	const squeezedOf = (op: 'a' | 'b') => (op === 'a' ? aSqueezed : bSqueezed);
	const lettersOf = (op: 'a' | 'b') => (op === 'a' ? spec.a : spec.b);
	const originOf = (op: 'a' | 'b') => (op === 'a' ? model.aIn : model.bIn);

	const outFramePoint = (idx: Idx): Vec => {
		let p = { ...outOrigin };
		spec.out.forEach((l, slot) => {
			p = add(p, mul(DIRS[slot], (idx[l] ?? 0) * U));
		});
		return p;
	};
	const operandMicro = (op: 'a' | 'b', idx: Idx): Vec => {
		let d: Vec = { x: 0, y: 0 };
		lettersOf(op).forEach((l, slot) => {
			if (squeezedOf(op).includes(l) && idx[l] !== undefined) {
				d = add(d, mul(DIRS[slot], (idx[l] - (sizeOf(l) - 1) / 2) * MICRO));
			}
		});
		return d;
	};
	const arrangedPos = (op: 'a' | 'b', idx: Idx): Vec =>
		add(outFramePoint(idx), operandMicro(op, idx));
	const inputPos = (op: 'a' | 'b', idx: Idx): Vec => {
		let p = { ...originOf(op) };
		lettersOf(op).forEach((l, slot) => {
			const sp = squeezedOf(op).includes(l) ? lerp(U, MICRO, squeezeT) : U;
			p = add(p, mul(DIRS[slot], (idx[l] ?? 0) * sp));
		});
		return p;
	};
	const srcPos = (op: 'a' | 'b', idx: Idx): Vec =>
		lerpV(inputPos(op, idx), arrangedPos(op, idx), arrangeT);

	// --- axes ---
	// Each operand axis glides continuously from its input pose into the output
	// frame. Surviving (kept) axes land exactly on the output-frame axis and
	// stay; contracted axes fade out as they get squeezed. There are no separate
	// output axes, so a given axis is never drawn in two places at once.
	const axes: Axis[] = [];
	const outCentroid = centroidOf(model.outCells.map((c) => outFramePoint(c)));
	(['a', 'b'] as const).forEach((op) => {
		const list = op === 'a' ? model.aDots : model.bDots;
		const inCentroid = centroidOf(list.map((idx) => inputPos(op, idx)));
		const centroid = lerpV(inCentroid, outCentroid, arrangeT);
		lettersOf(op).forEach((l) => {
			const sz = sizeOf(l);
			if (sz < 2) return;
			const isSq = squeezedOf(op).includes(l);
			const zero: Idx = {};
			lettersOf(op).forEach((x) => (zero[x] = 0));
			const end: Idx = { ...zero, [l]: sz - 1 };
			const inP0 = inputPos(op, zero);
			const inP1 = inputPos(op, end);
			// kept axes glide to the shared output-frame line (no micro offset);
			// squeezed axes have vanished by the time arrange starts, so they
			// just stay put.
			const arrP0 = isSq ? inP0 : outFramePoint({});
			const arrP1 = isSq ? inP1 : outFramePoint({ [l]: sz - 1 });
			const p0 = lerpV(inP0, arrP0, arrangeT);
			const p1 = lerpV(inP1, arrP1, arrangeT);
			const base = colors.get(l) as string;
			const color = isSq ? mixHex(base, GHOST, squeezeT) : base;
			const opacity = isSq ? 1 - squeezeT : 1;
			if (opacity <= 0.01) return;
			axes.push(buildAxis(`ax-${op}-${l}`, l, labelOf(l), color, opacity, p0, p1, centroid));
		});
	});

	// --- dots ---
	const dots: Dot[] = [];

	// source lattice dots (input -> squeeze -> arrange), fade out as broadcast starts
	const srcOpacity = 1 - smooth(bcastRaw / 0.45);
	if (srcOpacity > 0.01) {
		(['a', 'b'] as const).forEach((op) => {
			const list = op === 'a' ? model.aDots : model.bDots;
			for (const idx of list) {
				const p = srcPos(op, idx);
				dots.push({
					key: `s-${op}-${keyOf(idx)}`,
					x: p.x,
					y: p.y,
					r: 3,
					opacity: srcOpacity,
					fill: DOT_GRAY
				});
			}
		});
	}

	// contributions: compressed vectors broadcast to each output cell, then the
	// same reorient -> multiply -> sum that the magnifier shows, run on every
	// cell simultaneously.
	const n = model.outCells.length;
	const GRID_GAP = 5; // vertical separation of the two parallel rows in a cell
	const inOpacity = smooth(bcastRaw / 0.45);
	const parOff = (qi: number): Vec => ({ x: (qi - (K - 1) / 2) * MICRO, y: 0 });
	if (inOpacity > 0.01) {
		(['a', 'b'] as const).forEach((op) => {
			const opLetters = lettersOf(op);
			const opGap = op === 'a' ? -GRID_GAP : GRID_GAP;
			model.outCells.forEach((cell, ci) => {
				const center = outFramePoint(cell);
				model.contractCombos.forEach((q, qi) => {
					// kept indices this operand reads from the cell + the contracted index
					const merged: Idx = { ...q };
					opLetters.forEach((l) => {
						if (cell[l] !== undefined) merged[l] = cell[l];
					});
					const real = add(center, operandMicro(op, q)); // arrives in real orientation
					let pos: Vec;
					let opac: number;
					if (phase === 'resolve') {
						const par = add(add(center, parOff(qi)), { x: 0, y: opGap });
						const re = lerpV(real, par, ro);
						pos = lerpV(re, add(center, parOff(qi)), mp);
						opac = 1 - mp;
					} else {
						const start = arrangedPos(op, merged);
						pos = lerpV(start, real, broadcastT);
						opac = inOpacity;
					}
					if (opac <= 0.01) return;
					dots.push({
						key: `c-${op}-${ci}-${keyOf(q)}`,
						x: pos.x,
						y: pos.y,
						r: 3,
						opacity: opac,
						fill: DOT_GRAY
					});
				});
			});
		});
	}

	// product dots (during multiply) collapsing into the result dot (during sum)
	if (phase === 'resolve') {
		model.outCells.forEach((cell, ci) => {
			const center = outFramePoint(cell);
			model.contractCombos.forEach((q, qi) => {
				const o = mp * (1 - sm);
				if (o <= 0.01) return;
				const px = lerp(center.x + parOff(qi).x, center.x, sm);
				dots.push({ key: `p-${ci}-${qi}`, x: px, y: center.y, r: 3, opacity: o, fill: '#9a9aa0' });
			});
			const o = smooth(sm);
			if (o > 0.01)
				dots.push({ key: `r-${ci}`, x: center.x, y: center.y, r: 4, opacity: o, fill: RESULT_GRAY });
		});
	}

	// highlight ring on the representative cell that the zoom is showing (0,0)
	const repIdx = 0;
	let highlight: Scene['highlight'] = null;
	if ((phase === 'resolve' || phase === 'broadcast') && n > 1) {
		const c = outFramePoint(model.outCells[repIdx]);
		highlight = { x: c.x, y: c.y, r: 15, opacity: 0.45 };
	}

	// --- magnifier --- (same reorient -> multiply -> sum, zoomed in)
	const mag = sampleMag(model, repIdx, ro, mp, sm, bcastRaw > 0.01 || phase === 'resolve', labelOf);

	// --- caption ---
	const caption = captionFor(phase, contracted, aSqueezed, bSqueezed);

	return { phase, caption, axes, dots, highlight, mag };
}

function captionFor(
	phase: string,
	contracted: string[],
	aSqueezed: string[],
	bSqueezed: string[]
): string {
	switch (phase) {
		case 'intro':
			return 'Two tensors. The axes carry the meaning; the gray dots are just numbers.';
		case 'squeeze':
			if (contracted.length) return `Contract ${contracted.join('')}: squeeze that axis away.`;
			if (aSqueezed.length || bSqueezed.length) return 'Reduce the summed-away axes.';
			return 'Nothing to contract here.';
		case 'arrange':
			return 'Arrange the surviving axes into the output frame.';
		case 'broadcast':
			return 'Copy each compressed vector out to every output cell.';
		case 'resolve':
			return contracted.length
				? 'At each cell, take the dot product along the contracted axis.'
				: 'At each cell, multiply the values together.';
		default:
			return '';
	}
}

function sampleMag(
	model: Model,
	repIdx: number,
	ro: number,
	mp: number,
	sm: number,
	active: boolean,
	labelOf: (l: string) => string
): MagState {
	if (!active)
		return { active: false, label: '', aDots: [], bDots: [], prodDots: [], sumDot: null };

	const K = Math.max(model.K, 1);
	const cell = model.outCells[repIdx] ?? {};
	const label = model.spec.out.length
		? model.spec.out.map((l) => `${labelOf(l)} ${cell[l] ?? 0}`).join(',  ')
		: 'scalar';

	const cColor = model.contracted.length
		? (model.colors.get(model.contracted[0]) as string)
		: '#9aa0a6';

	// Each operand's compressed vector keeps the screen orientation of its own
	// contracted axis, so two vectors that were perpendicular in the grid start
	// out perpendicular here too. They then rotate to a common direction before
	// the element-wise multiply.
	const slotA = model.contracted.length ? model.spec.a.indexOf(model.contracted[0]) : 1;
	const slotB = model.contracted.length ? model.spec.b.indexOf(model.contracted[0]) : 1;
	const dirA = unit(DIRS[slotA] ?? { x: 1, y: 0 });
	const dirB = unit(DIRS[slotB] ?? { x: 1, y: 0 });

	const cx = MAG.w / 2;
	const cy = 102;
	const mx = Math.min(24, (MAG.w - 44) / Math.max(K, 1));
	const off = (i: number) => (i - (K - 1) / 2) * mx;
	const rowGap = 18;

	const aDots: Dot[] = [];
	const bDots: Dot[] = [];
	const prodDots: Dot[] = [];
	for (let i = 0; i < K; i++) {
		const aStart: Vec = { x: cx + dirA.x * off(i), y: cy + dirA.y * off(i) };
		const aPar: Vec = { x: cx + off(i), y: cy - rowGap };
		let a = lerpV(aStart, aPar, ro);
		a = lerpV(a, { x: cx + off(i), y: cy }, mp);
		aDots.push({ key: `ma-${i}`, x: a.x, y: a.y, r: 4, opacity: 1 - mp, fill: cColor });

		const bStart: Vec = { x: cx + dirB.x * off(i), y: cy + dirB.y * off(i) };
		const bPar: Vec = { x: cx + off(i), y: cy + rowGap };
		let b = lerpV(bStart, bPar, ro);
		b = lerpV(b, { x: cx + off(i), y: cy }, mp);
		bDots.push({ key: `mb-${i}`, x: b.x, y: b.y, r: 4, opacity: 1 - mp, fill: cColor });

		const px = lerp(cx + off(i), cx, sm);
		prodDots.push({
			key: `mp-${i}`,
			x: px,
			y: cy,
			r: 4,
			opacity: mp * (1 - sm),
			fill: '#6b7280'
		});
	}
	const sumDot: Dot = { key: 'msum', x: cx, y: cy, r: 6, opacity: sm, fill: '#403e43' };

	return { active: true, label, aDots, bDots, prodDots, sumDot };
}
