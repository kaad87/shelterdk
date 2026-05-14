// Internal rate-limit store — exported separately so tests can reset it
// without violating Next.js route export constraints.
export const ipTimestamps = new Map<string, number[]>();
