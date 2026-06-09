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

export const VIEW = { w: 640, h: 300 };
// The zoom lens lives in the same SVG as the main view, so the dashed guide
// lines can run from the highlighted cell straight to the lens.
export const LENS = { x: 545, y: 95, r: 72 };

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
// Dots carry a subtle cool/warm tint so you can tell which operand a dot came
// from, all the way through broadcast and into the magnifier.
const OP_TINT = ['#8c99ae', '#b09c89'];
const COPY_TINT = ['#7e90af', '#ad9176'];
const PROD_GRAY = '#6e7480';
const RESULT_GRAY = '#555c66';
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

// Strict validation for the interactive playground. Returns a friendly error
// message, or null if the expression is drawable.
export function validateEinsum(raw: string): string | null {
	const cleaned = raw.replace(/\s+/g, '');
	const parts = cleaned.split('->');
	if (parts.length !== 2) return 'Write an explicit output, e.g. ij,jk->ik';
	const ops = parts[0].split(',');
	if (ops.length !== 2) return 'Exactly two input tensors are supported';
	for (const s of [...ops, parts[1]]) {
		if (!/^[a-z]*$/.test(s)) return 'Indices must be lowercase letters';
	}
	const [a, b] = ops;
	const out = parts[1];
	if (a.length > 3 || b.length > 3)
		return 'Inputs can be at most rank 3 — higher ranks are hard to draw';
	if (out.length > 3) return 'The output can be at most rank 3';
	const named: [string, string][] = [
		['first input', a],
		['second input', b],
		['output', out]
	];
	for (const [name, s] of named) {
		if (new Set(s).size !== s.length)
			return `Repeated index in the ${name} — diagonals aren't supported`;
	}
	for (const l of out) {
		if (!a.includes(l) && !b.includes(l)) return `Output index "${l}" doesn't appear in any input`;
	}
	return null;
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
	{ key: 'intro', dur: 0.07 },
	{ key: 'squeeze', dur: 0.16 },
	{ key: 'arrange', dur: 0.15 },
	{ key: 'broadcast', dur: 0.17 },
	{ key: 'resolve', dur: 0.45 }
];

// Sub-stages of resolve: collapse solo-summed axes -> align the piles ->
// multiply pairwise -> sum. The collapse window is skipped entirely when
// neither operand has a solo-summed axis, so the common cases stay snappy.
function resolveStages(model: Model, r: number) {
	const hasSolo =
		model.aSqueezed.length > model.contracted.length ||
		model.bSqueezed.length > model.contracted.length;
	const w: Record<string, [number, number]> = hasSolo
		? { cl: [0.06, 0.22], ro: [0.28, 0.48], mp: [0.54, 0.72], sm: [0.78, 0.94] }
		: { cl: [0, 0.001], ro: [0.1, 0.34], mp: [0.45, 0.66], sm: [0.74, 0.92] };
	const win = ([a, b]: [number, number]) => smooth((r - a) / Math.max(b - a, 1e-6));
	return { cl: win(w.cl), ro: win(w.ro), mp: win(w.mp), sm: win(w.sm), hasSolo };
}

export interface PhaseInfo {
	key: string;
	label: string;
	start: number;
	end: number;
}
// Exposed so the interactive playground can render clickable step chips.
export const PHASE_INFO: PhaseInfo[] = (() => {
	const labels: Record<string, string> = {
		intro: 'inputs',
		squeeze: 'contract',
		arrange: 'arrange',
		broadcast: 'broadcast',
		resolve: 'multiply + sum'
	};
	let s = 0;
	return PHASES.map((p) => {
		const info = { key: p.key, label: labels[p.key] ?? p.key, start: s, end: s + p.dur };
		s += p.dur;
		return info;
	});
})();

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
export interface VLine {
	key: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	color: string;
	opacity: number;
}
export interface MagState {
	active: boolean;
	label: string;
	glyph: string; // '×' while multiplying, 'Σ' while summing
	axes: Axis[]; // tiny colored axes showing what each pile is still indexed by
	aDots: Dot[];
	bDots: Dot[];
	prodDots: Dot[];
	sumDot: Dot | null;
}
export interface Scene {
	phase: string;
	caption: string;
	axes: Axis[];
	vectorLines: VLine[];
	dots: Dot[];
	highlight: { x: number; y: number; r: number; opacity: number } | null;
	connectors: VLine[]; // dashed guides from the highlighted cell to the lens
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
	labels: Record<string, string> = {},
	vectors = ''
): Scene {
	const { spec, colors, aSqueezed, bSqueezed, contracted, outOrigin } = model;
	const labelOf = (l: string): string => labels[l] ?? l;

	const squeezeT = easeInOut(localRaw(progress, 'squeeze'));
	const arrangeT = easeInOut(localRaw(progress, 'arrange'));
	const bcastRaw = localRaw(progress, 'broadcast');
	const resolveRaw = localRaw(progress, 'resolve');
	const phase = currentPhase(progress);

	// Resolve happens for every cell at once: align the piles -> multiply -> sum.
	const K = Math.max(model.K, 1);
	const { ro, mp, sm } = resolveStages(model, resolveRaw);

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
	// Operands park just outside the output grid, like row/column headers: one
	// step out along every output direction they lack, which lands their piles
	// right on the corresponding output axis line. If an operand lacks nothing
	// (e.g. hadamard), nudge the two sideways so they don't overlap each other.
	const lacksOf = (op: 'a' | 'b') => spec.out.filter((l) => !lettersOf(op).includes(l));
	const marginFor = (op: 'a' | 'b'): Vec => {
		const lacks = lacksOf(op);
		let m: Vec = { x: 0, y: 0 };
		for (const l of lacks) m = add(m, mul(DIRS[spec.out.indexOf(l)], -U));
		if (!lacks.length) {
			const spareDir = DIRS[spec.out.length <= 1 ? 1 : 2];
			m = mul(spareDir, (op === 'a' ? -1 : 1) * 0.3 * U);
		}
		return m;
	};
	const margins = { a: marginFor('a'), b: marginFor('b') };
	const arrangedPos = (op: 'a' | 'b', idx: Idx): Vec =>
		add(add(outFramePoint(idx), margins[op]), operandMicro(op, idx));
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

	// Dots along the depth axis get slightly fainter the further back they sit.
	const depthFade = (letters: string[], idx: Idx): number => {
		const dl = letters[2];
		return dl ? 1 - 0.35 * ((idx[dl] ?? 0) / Math.max(1, sizeOf(dl) - 1)) : 1;
	};

	// source lattice dots (input -> squeeze -> arrange). They stay visible as
	// row/column headers while their copies broadcast out, then fade at resolve.
	const srcOpacity = 1 - smooth(resolveRaw / 0.35);
	if (srcOpacity > 0.01) {
		(['a', 'b'] as const).forEach((op, opIdx) => {
			const list = op === 'a' ? model.aDots : model.bDots;
			for (const idx of list) {
				const p = srcPos(op, idx);
				dots.push({
					key: `s-${op}-${keyOf(idx)}`,
					x: p.x,
					y: p.y,
					r: lerp(3, 2.5, squeezeT),
					opacity: srcOpacity * depthFade(lettersOf(op), idx),
					fill: OP_TINT[opIdx]
				});
			}
		});
	}

	// faint ghost dots mark the output cells once the frame assembles, until the
	// real result dots land on top of them
	const ghostO = smooth(arrangeT) * 0.45 * (1 - sm);
	if (ghostO > 0.01) {
		model.outCells.forEach((cell, ci) => {
			const p = outFramePoint(cell);
			dots.push({
				key: `g-${ci}`,
				x: p.x,
				y: p.y,
				r: 1.6,
				opacity: ghostO * depthFade(spec.out, cell),
				fill: GHOST
			});
		});
	}

	// base-vector lines: connect the dots that form a meaningful vector (e.g. a
	// query/key/value vector along a feature axis) so they read as one unit.
	const vectorLines: VLine[] = [];
	if (vectors && srcOpacity > 0.01) {
		const sz = sizeOf(vectors);
		if (sz >= 2) {
			(['a', 'b'] as const).forEach((op) => {
				const letters = lettersOf(op);
				if (!letters.includes(vectors)) return;
				const others = letters.filter((l) => l !== vectors);
				for (const oc of combos(others)) {
					const p0 = srcPos(op, { ...oc, [vectors]: 0 });
					const p1 = srcPos(op, { ...oc, [vectors]: sz - 1 });
					vectorLines.push({
						key: `v-${op}-${keyOf(oc)}`,
						x1: p0.x,
						y1: p0.y,
						x2: p1.x,
						y2: p1.y,
						color: colors.get(vectors) as string,
						opacity: srcOpacity * 0.45
					});
				}
			});
		}
	}

	// contributions: compressed vectors broadcast to each output cell, then the
	// same reorient -> multiply -> sum that the magnifier shows, run on every
	// cell simultaneously.
	const GRID_GAP = 5; // vertical separation of the two parallel rows in a cell
	const inOpacity = smooth(bcastRaw / 0.45);
	const parOff = (qi: number): Vec => ({ x: (qi - (K - 1) / 2) * MICRO, y: 0 });
	if (inOpacity > 0.01) {
		(['a', 'b'] as const).forEach((op, opIdx) => {
			const opLetters = lettersOf(op);
			const opGap = op === 'a' ? -GRID_GAP : GRID_GAP;
			// the two piles sit diagonally offset within a cell rather than both
			// centered on it, so they read as two arrivals instead of one cross
			const sideOff: Vec = op === 'a' ? { x: -5, y: -3.4 } : { x: 5, y: 3.4 };
			// stagger copies so they sweep across the grid along the directions
			// this operand broadcasts over, instead of all arriving at once
			const lacks = lacksOf(op);
			const stagDen = lacks.reduce((s, l) => s + (sizeOf(l) - 1), 0);
			model.outCells.forEach((cell, ci) => {
				const center = outFramePoint(cell);
				const stag = stagDen ? lacks.reduce((s, l) => s + (cell[l] ?? 0), 0) / stagDen : 0;
				const tCell = easeInOut(clamp((bcastRaw - 0.35 * stag) / 0.6, 0, 1));
				const cellFade = depthFade(spec.out, cell);
				model.contractCombos.forEach((q, qi) => {
					// kept indices this operand reads from the cell + the contracted index
					const merged: Idx = { ...q };
					opLetters.forEach((l) => {
						if (cell[l] !== undefined) merged[l] = cell[l];
					});
					const real = add(add(center, sideOff), operandMicro(op, q)); // real orientation
					let pos: Vec;
					let opac: number;
					if (phase === 'resolve') {
						const par = add(add(center, parOff(qi)), { x: 0, y: opGap });
						const re = lerpV(real, par, ro);
						pos = lerpV(re, add(center, parOff(qi)), mp);
						opac = (1 - mp) * cellFade;
					} else {
						const start = arrangedPos(op, merged);
						pos = lerpV(start, real, tCell);
						opac = smooth(tCell / 0.25) * cellFade;
					}
					if (opac <= 0.01) return;
					dots.push({
						key: `c-${op}-${ci}-${keyOf(q)}`,
						x: pos.x,
						y: pos.y,
						r: 2.5,
						opacity: opac,
						fill: COPY_TINT[opIdx]
					});
				});
			});
		});
	}

	// product dots (during multiply) collapsing into the result dot (during sum)
	if (phase === 'resolve') {
		model.outCells.forEach((cell, ci) => {
			const center = outFramePoint(cell);
			const cellFade = depthFade(spec.out, cell);
			model.contractCombos.forEach((q, qi) => {
				const o = mp * (1 - sm) * cellFade;
				if (o <= 0.01) return;
				const px = lerp(center.x + parOff(qi).x, center.x, sm);
				dots.push({ key: `p-${ci}-${qi}`, x: px, y: center.y, r: 3, opacity: o, fill: PROD_GRAY });
			});
			const o = smooth(sm) * cellFade;
			if (o > 0.01)
				dots.push({
					key: `r-${ci}`,
					x: center.x,
					y: center.y,
					r: 4,
					opacity: o,
					fill: RESULT_GRAY
				});
		});
	}

	// highlight ring on the representative cell that the zoom is showing (0,0),
	// with dashed guides making it clear the lens is a zoom of that cell
	const repIdx = 0;
	let highlight: Scene['highlight'] = null;
	const connectors: VLine[] = [];
	if (phase === 'resolve' || phase === 'broadcast') {
		const c = outFramePoint(model.outCells[repIdx]);
		const vis = smooth(bcastRaw / 0.3);
		highlight = { x: c.x, y: c.y, r: 15, opacity: 0.45 * vis };
		const k = 0.707;
		for (const s of [-1, 1]) {
			connectors.push({
				key: `cn-${s}`,
				x1: c.x + 15 * k,
				y1: c.y + s * 15 * k,
				x2: LENS.x - LENS.r * k,
				y2: LENS.y + s * LENS.r * k,
				color: '#b9bbc0',
				opacity: 0.55 * vis
			});
		}
	}

	// --- magnifier --- (the same ritual, zoomed in with the piles' true structure)
	const mag = sampleMag(
		model,
		repIdx,
		resolveRaw,
		smooth(bcastRaw / 0.5),
		bcastRaw > 0.01 || phase === 'resolve',
		labelOf
	);

	// --- caption ---
	const caption = captionFor(phase, contracted, aSqueezed, bSqueezed);

	return { phase, caption, axes, vectorLines, dots, highlight, connectors, mag };
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
	resolveRaw: number,
	arrivalT: number,
	active: boolean,
	labelOf: (l: string) => string
): MagState {
	if (!active)
		return {
			active: false,
			label: '',
			glyph: '',
			axes: [],
			aDots: [],
			bDots: [],
			prodDots: [],
			sumDot: null
		};

	const { spec, colors, contracted } = model;
	const cell = model.outCells[repIdx] ?? {};
	const label = spec.out.length
		? spec.out.map((l) => `${labelOf(l)} ${cell[l] ?? 0}`).join(',  ')
		: 'scalar';

	const { cl, ro, mp, sm } = resolveStages(model, resolveRaw);

	const LC: Vec = { x: LENS.x, y: LENS.y };
	const maxPileRank = Math.max(model.aSqueezed.length, model.bSqueezed.length);
	const SM = maxPileRank >= 3 ? 10 : 14; // lattice spacing inside the lens
	const alignOff: Vec = contracted.length <= 1 ? { x: 22, y: 0 } : { x: 7, y: -6 };

	// Canonical orientation both piles rotate into before the pairwise multiply.
	const canonRel = (ix: Idx): Vec => {
		let p: Vec = { x: 0, y: 0 };
		contracted.forEach((l, i) => {
			p = add(p, mul(DIRS[i], ((ix[l] ?? 0) - (sizeOf(l) - 1) / 2) * SM));
		});
		return p;
	};

	// Each pile arrives with its true structure: a lattice over the operand's
	// squeezed letters, in the same screen orientations those axes had in the
	// grid (so matmul's two j-piles really start out perpendicular). Solo-summed
	// axes collapse first, then the piles rotate to a common orientation.
	const axes: Axis[] = [];
	const buildPile = (op: 'a' | 'b', opIdx: number): Dot[] => {
		const letters = op === 'a' ? spec.a : spec.b;
		const squeezed = op === 'a' ? model.aSqueezed : model.bSqueezed;
		const solo = squeezed.filter((l) => !contracted.includes(l));
		const pileLs = [...contracted, ...solo];
		// mirror the diagonal arrangement the piles have inside the cell
		const center: Vec =
			op === 'a' ? { x: LC.x - 30, y: LC.y - 17 } : { x: LC.x + 30, y: LC.y + 17 };
		const aligned = add(LC, mul(alignOff, op === 'a' ? -0.5 : 0.5));
		const realRel = (ix: Idx): Vec => {
			let p: Vec = { x: 0, y: 0 };
			for (const l of pileLs) {
				const dir = DIRS[letters.indexOf(l)] ?? DIRS[1];
				p = add(p, mul(dir, ((ix[l] ?? 0) - (sizeOf(l) - 1) / 2) * SM));
			}
			return p;
		};
		const collapsedRel = (ix: Idx): Vec => {
			const c: Idx = { ...ix };
			for (const l of solo) c[l] = (sizeOf(l) - 1) / 2;
			return realRel(c);
		};
		const dots: Dot[] = [];
		for (const ix of combos(pileLs)) {
			let pos = add(center, realRel(ix));
			pos = lerpV(pos, add(center, collapsedRel(ix)), cl);
			pos = lerpV(pos, add(aligned, canonRel(ix)), ro);
			pos = lerpV(pos, add(LC, canonRel(ix)), mp);
			const o = arrivalT * (1 - mp);
			if (o <= 0.01) continue;
			dots.push({
				key: `m${op}-${keyOf(ix)}`,
				x: pos.x,
				y: pos.y,
				r: 3.5 + (solo.length ? cl * 0.4 : 0),
				opacity: o,
				fill: COPY_TINT[opIdx]
			});
		}
		// tiny colored axes show what each pile is still indexed by; solo axes
		// vanish when their sum collapses, shared axes when alignment starts
		for (const l of pileLs) {
			const n = sizeOf(l);
			if (n < 2) continue;
			const dir = unit(DIRS[letters.indexOf(l)] ?? DIRS[1]);
			const others = pileLs.filter((x) => x !== l);
			// offset the axis away from the pile: opposite the other axes if there
			// are any, otherwise perpendicular to itself
			let perp: Vec = mul({ x: -dir.y, y: dir.x }, 9);
			if (others.length) {
				let s: Vec = { x: 0, y: 0 };
				for (const o of others) s = add(s, DIRS[letters.indexOf(o)] ?? DIRS[1]);
				perp = mul(unit(s), -9);
			}
			const half = ((n - 1) / 2 + 0.35) * SM;
			const p0 = add(add(center, mul(dir, -half)), perp);
			const p1 = add(add(center, mul(dir, half)), perp);
			const o = arrivalT * 0.9 * (1 - (solo.includes(l) ? cl : ro));
			if (o <= 0.01) continue;
			axes.push({
				key: `max-${op}-${l}`,
				x1: p0.x,
				y1: p0.y,
				x2: p1.x,
				y2: p1.y,
				color: colors.get(l) as string,
				opacity: o,
				letter: l,
				label: l,
				lx: p1.x + dir.x * 10,
				ly: p1.y + dir.y * 10
			});
		}
		return dots;
	};
	const aDots = buildPile('a', 0);
	const bDots = buildPile('b', 1);

	const prodDots: Dot[] = [];
	for (const ix of combos(contracted)) {
		const o = mp * (1 - sm);
		if (o <= 0.01) continue;
		const pos = lerpV(add(LC, canonRel(ix)), LC, sm);
		prodDots.push({
			key: `mp-${keyOf(ix)}`,
			x: pos.x,
			y: pos.y,
			r: 4,
			opacity: o,
			fill: PROD_GRAY
		});
	}
	const sumDot: Dot | null =
		sm > 0.01 ? { key: 'msum', x: LC.x, y: LC.y, r: 6, opacity: sm, fill: '#403e43' } : null;

	const glyph = sm > 0.03 && model.K > 1 ? 'Σ' : mp > 0.03 ? '×' : '';

	return { active: true, label, glyph, axes, aDots, bDots, prodDots, sumDot };
}
