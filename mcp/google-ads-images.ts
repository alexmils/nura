/**
 * Performance Max image bytes for the local ads MCP.
 * Kept out of lib/google-ads-agent.ts because that module is imported by the
 * admin page, and Next cannot bundle node:zlib.
 */
import { crc32, deflateSync } from "node:zlib";

export type SalesImages = {
  logo: string;
  landscape: string;
  square: string;
};

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, sum]);
}

function brandPng(width: number, height: number): string {
  const sage: [number, number, number] = [132, 176, 103];
  const ink: [number, number, number] = [42, 48, 32];
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.28;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
      const rgb = inside ? ink : sage;
      const index = row + 1 + x * 3;
      raw[index] = rgb[0];
      raw[index + 1] = rgb[1];
      raw[index + 2] = rgb[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return png.toString("base64");
}

let cached: SalesImages | null = null;

export function nuraSalesImages(): SalesImages {
  if (!cached) {
    cached = {
      logo: brandPng(128, 128),
      landscape: brandPng(600, 314),
      square: brandPng(300, 300),
    };
  }
  return cached;
}
