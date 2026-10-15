/** Center of the longest subpath, so a pin sits on the main landmass. */
export function largestSubpathCenter(d: string): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestCount = 0;
  for (const part of d.split(/(?=M)/)) {
    const points = [...part.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)];
    if (points.length <= bestCount) continue;
    let sx = 0;
    let sy = 0;
    for (const point of points) {
      sx += Number(point[1]);
      sy += Number(point[2]);
    }
    bestCount = points.length;
    best = { x: sx / points.length, y: sy / points.length };
  }
  return best;
}
