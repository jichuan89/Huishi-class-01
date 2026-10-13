import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('public/models/organ-skin.glb');
const factor = Number(process.argv[2] ?? 0.60);
if (!Number.isFinite(factor) || factor <= 0 || factor > 1) {
  throw new Error('Pass a darkening factor between 0 (darkest) and 1 (unchanged).');
}

const source = fs.readFileSync(filePath);
if (source.toString('ascii', 0, 4) !== 'glTF' || source.readUInt32LE(4) !== 2) {
  throw new Error(`${filePath} is not a GLB 2.0 file`);
}
const jsonLength = source.readUInt32LE(12);
if (source.readUInt32LE(16) !== 0x4e4f534a) throw new Error('GLB has no JSON chunk');
const json = JSON.parse(source.toString('utf8', 20, 20 + jsonLength).replace(/[\0 ]+$/g, ''));
if (!json.materials?.length) throw new Error('Skin GLB has no materials');

for (const material of json.materials) {
  const pbr = material.pbrMetallicRoughness ??= {};
  const previous = pbr.baseColorFactor ?? [1, 1, 1, 1];
  pbr.baseColorFactor = [factor, factor, factor, previous[3] ?? 1];
}

const jsonBytes = Buffer.from(JSON.stringify(json));
const paddedJsonLength = Math.ceil(jsonBytes.length / 4) * 4;
const jsonChunk = Buffer.alloc(paddedJsonLength, 0x20);
jsonBytes.copy(jsonChunk);
const rest = source.subarray(20 + jsonLength);
const output = Buffer.alloc(12 + 8 + paddedJsonLength + rest.length);
output.write('glTF', 0, 4, 'ascii');
output.writeUInt32LE(2, 4);
output.writeUInt32LE(output.length, 8);
output.writeUInt32LE(paddedJsonLength, 12);
output.writeUInt32LE(0x4e4f534a, 16);
jsonChunk.copy(output, 20);
rest.copy(output, 20 + paddedJsonLength);
fs.writeFileSync(filePath, output);
console.log(`Darkened ${json.materials.length} skin material(s) by ${factor}; preserved the embedded textures.`);
