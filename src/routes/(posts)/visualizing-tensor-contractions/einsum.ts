// Parsing + semantic classification of a (restricted) einsum expression.
//
// Each index letter gets one of four roles, and the whole animation falls out
// of this classification:
//   - contracted: in both inputs, not in the output (the classic case)
//   - batch:      in both inputs and the output (never compresses)
//   - free:       in one input and the output (a broadcast direction for the other input)
//   - summed:     in one input only, not in the output (collapses by summation, no partner)

export type Role = 'batch' | 'free' | 'contracted' | 'summed';

export interface EinsumSpec {
	inputs: [string[], string[]];
	output: string[];
	/** distinct letters, in order of first appearance across the inputs */
	letters: string[];
	roles: Record<string, Role>;
	sizes: Record<string, number>;
}

// Sizes aren't part of einsum notation, so each letter gets a small default.
// Deliberately varied so different axes are distinguishable by length.
const SIZE_CYCLE = [3, 4, 5];

export function parseEinsum(src: string): EinsumSpec {
	const cleaned = src.replace(/\s+/g, '');
	const parts = cleaned.split('->');
	if (parts.length !== 2) throw new Error('Write an explicit output, e.g. ij,jk->ik');
	const [lhs, rhs] = parts;
	const operands = lhs.split(',');
	if (operands.length !== 2) throw new Error('Exactly two input tensors are supported');
	for (const s of [...operands, rhs]) {
		if (!/^[a-z]*$/.test(s)) throw new Error('Indices must be lowercase letters');
	}
	const a = operands[0].split('');
	const b = operands[1].split('');
	const output = rhs.split('');
	if (a.length > 3 || b.length > 3)
		throw new Error('Inputs can be at most rank 3 — higher ranks are hard to draw');
	if (output.length > 3) throw new Error('The output can be at most rank 3');
	const named: [string, string[]][] = [
		['first input', a],
		['second input', b],
		['output', output]
	];
	for (const [name, ls] of named) {
		if (new Set(ls).size !== ls.length)
			throw new Error(`Repeated index in the ${name} — diagonals aren't supported`);
	}
	for (const L of output) {
		if (!a.includes(L) && !b.includes(L))
			throw new Error(`Output index "${L}" doesn't appear in any input`);
	}

	const letters: string[] = [];
	for (const L of [...a, ...b]) if (!letters.includes(L)) letters.push(L);

	const roles: Record<string, Role> = {};
	for (const L of letters) {
		const inBoth = a.includes(L) && b.includes(L);
		const inOut = output.includes(L);
		roles[L] = inBoth ? (inOut ? 'batch' : 'contracted') : inOut ? 'free' : 'summed';
	}

	const sizes: Record<string, number> = {};
	letters.forEach((L, i) => (sizes[L] = SIZE_CYCLE[i % SIZE_CYCLE.length]));

	return { inputs: [a, b], output, letters, roles, sizes };
}
