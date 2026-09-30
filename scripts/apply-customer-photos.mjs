// Chuyển ảnh khách hàng vào template graduation-editorial-01.
// Đọc mọi file ảnh trong thư mục nguồn (bỏ qua file trang trí gốc của template),
// xoay vòng lấp đầy 10 slot, convert .webp + resize, backup ảnh cũ,
// rồi xoá thư mục nguồn.
//   node scripts/apply-customer-photos.mjs [--src <dir>] [--keep]

import sharp from 'sharp';
import { readdir, copyFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const args = process.argv.slice(2);
const argSrc = args.includes('--src') ? args[args.indexOf('--src') + 1] : 'customer-photos';
const keep = args.includes('--keep');
const SRC_DIR = path.resolve(root, argSrc);
const DEST_DIR = path.join(root, 'public', 'templates', 'graduation-editorial-01');
const BACKUP_DIR = path.join(root, 'customer-photos-backup');

// File asset gốc của template khác — không phải ảnh khách, bỏ qua.
const IGNORE = new Set([
  'bg-pattern-top', 'bg-wave-blue', 'bg-wave-cream', 'bg-wave-dark',
  'cap-icon', 'cap_icon', 'corner-leaf', 'flower-decor', 'sparkle',
  'spin-badge', 'envelope-paper', 'login-stationery',
]);

const SLOTS = [
  { key: 'hero-portrait',    maxW: 1024 },
  { key: 'hero-cutout',      maxW: 1024 },
  { key: 'story-portrait',   maxW: 1200 },
  { key: 'gallery-1',        maxW: 1200 },
  { key: 'gallery-2',        maxW: 1200 },
  { key: 'gallery-3',        maxW: 1200 },
  { key: 'gallery-4',        maxW: 1200 },
  { key: 'gallery-5',        maxW: 1200 },
  { key: 'gallery-6',        maxW: 1200 },
  { key: 'thank-you-banner', maxW: 1600 },
];

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.heic', '.tif', '.tiff']);
const normalize = (name) => name.toLowerCase().replace(/[_\s]+/g, '-').replace(/\.[^.]+$/, '');

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`Không tìm thấy thư mục: ${SRC_DIR}`);
    process.exit(1);
  }

  const files = (await readdir(SRC_DIR))
    .filter(f => IMAGE_EXT.has(path.extname(f).toLowerCase()))
    .filter(f => !IGNORE.has(normalize(f)))
    .sort();
  if (!files.length) {
    console.error(`Không có ảnh khách nào trong ${SRC_DIR} (sau khi bỏ file trang trí).`);
    process.exit(1);
  }

  // Ưu tiên khớp tên file với slot trước.
  const assigned = new Map();          // slot -> file
  const pool = [];
  for (const file of files) {
    const slot = SLOTS.find(s => normalize(file) === s.key);
    if (slot && !assigned.has(slot.key)) assigned.set(slot.key, file);
    else pool.push(file);
  }
  // Slot còn trống lấy tuần tự từ pool; pool cạn thì xoay vòng lại toàn bộ ảnh.
  const fill = pool.length ? pool : files;
  let i = 0;
  for (const slot of SLOTS) {
    if (!assigned.has(slot.key)) {
      assigned.set(slot.key, fill[i % fill.length]);
      i++;
    }
  }

  await mkdir(BACKUP_DIR, { recursive: true });

  console.log(`${files.length} ảnh khách → lấp đầy ${SLOTS.length} slot:`);
  for (const slot of SLOTS) {
    const file = assigned.get(slot.key);
    const srcPath = path.join(SRC_DIR, file);
    const destName = `${slot.key}.webp`;
    const destPath = path.join(DEST_DIR, destName);

    if (existsSync(destPath) && !existsSync(path.join(BACKUP_DIR, destName))) {
      await copyFile(destPath, path.join(BACKUP_DIR, destName));
    }

    await sharp(srcPath)
      .rotate()
      .resize({ width: slot.maxW, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(destPath);
    const dup = files.indexOf(file) !== files.lastIndexOf(file) || Object.values(Object.fromEntries(assigned)).filter(v => v === file).length > 1;
    console.log(`  ${slot.key.padEnd(16)} ← ${file}${dup ? '  (dùng lại)' : ''}`);
  }

  if (!keep) {
    await rm(SRC_DIR, { recursive: true, force: true });
    console.log(`\nĐã xoá thư mục nguồn: ${path.relative(root, SRC_DIR)}`);
  }
  console.log(`Ảnh mẫu cũ backup ở: ${path.relative(root, BACKUP_DIR)}/`);
  console.log(`Xong → http://localhost:3000/preview?template=graduation-editorial-01`);
}

main().catch(err => { console.error(err); process.exit(1); });
