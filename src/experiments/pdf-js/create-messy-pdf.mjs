// Deterministic fixture. Run with node to regenerate messy-text.pdf.
import { writeFileSync } from 'node:fs';

const text = (font, size, x, y, value, color = '0.12 0.16 0.23', angle = 0) => {
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians).toFixed(5);
  const sin = Math.sin(radians).toFixed(5);
  const escaped = value.replace(/[\\()]/g, '\\$&');
  return `BT /${font} ${size} Tf ${color} rg ${cos} ${sin} ${-sin} ${cos} ${x} ${y} Tm (${escaped}) Tj ET`;
};
const stream = [
  '0.98 0.96 0.90 rg 0 0 612 792 re f',
  '0.87 0.93 1 rg 28 592 556 104 re f',
  '1 0.89 0.66 rg 32 380 260 108 re f',
  '0.91 0.85 0.98 rg 326 364 252 126 re f',
  text('F2', 32, 34, 741, 'MESSY TEXT / PDF.js'),
  text(
    'F1',
    11,
    35,
    714,
    'Mixed fonts, sizes, spacing, columns, rotation and punctuation.',
  ),
  text('F2', 26, 42, 657, 'John 3:16', '0.09 0.29 0.60'),
  text('F3', 15, 42, 626, 'For God so loved the world...'),
  text(
    'F1',
    10,
    42,
    603,
    'Hover for a native title. Click the reference for the verse.',
  ),
  text('F4', 14, 44, 554, 'code:  x = 42;   [brackets]   {braces}'),
  text(
    'F3',
    20,
    43,
    521,
    'A slanted line -- with italic words',
    '0.43 0.16 0.30',
    4,
  ),
  text('F2', 22, 44, 454, 'Psalm 23:1', '0.45 0.26 0.04'),
  text('F3', 13, 44, 427, 'The LORD is my shepherd;'),
  text('F1', 13, 44, 406, 'I shall not want.'),
  text('F2', 22, 340, 446, 'Genesis 1:1', '0.37 0.13 0.55', -5),
  text('F1', 12, 340, 417, 'In the beginning God created'),
  text('F3', 12, 340, 397, 'the heaven and the earth.'),
  text('F2', 38, 42, 309, 'BIG'),
  text('F1', 8, 147, 312, 'tiny text beside a giant word'),
  text('F4', 13, 42, 270, 'W I D E   S P A C I N G    0123456789'),
  text('F1', 13, 42, 247, 'Split reference:'),
  text('F2', 13, 145, 247, 'John'),
  text('F3', 13, 175, 247, '3:'),
  text('F4', 13, 186, 247, '16'),
  text('F3', 18, 42, 228, 'Punctuation: (hello), "world"; [test] / slash!'),
  text('F2', 22, 66, 147, 'Rotated reference: John 3:16', '0.09 0.44 0.37', 12),
  text(
    'F1',
    11,
    42,
    76,
    'Hover and click references to read your installed Bible. Click other text to send it to the app.',
  ),
  text(
    'F4',
    9,
    42,
    52,
    'page 1 / 2  |  text remains selectable beneath the interaction layer',
  ),
].join('\n');
const secondStream = [
  '0.96 0.98 1 rg 0 0 612 792 re f',
  text('F2', 30, 42, 738, 'WRAPPED / FRAGMENTED TEXT'),
  text(
    'F1',
    12,
    42,
    706,
    'One reference split across two lines; ordinary text calls back to the app.',
  ),
  text('F2', 20, 42, 652, 'John'),
  text('F3', 20, 42, 629, '3:16'),
  text('F1', 16, 42, 571, 'Compare Gen. 1:1 with 1 Cor. 13:4-7.'),
  text(
    'F4',
    13,
    42,
    510,
    'Click this chunk to send its text and page number to the app.',
  ),
  text(
    'F1',
    12,
    42,
    464,
    'A book and numbers in distant columns should not become a reference:',
  ),
  text('F2', 20, 42, 420, 'John'),
  text('F2', 20, 390, 420, '3:16'),
  text('F4', 10, 42, 52, 'page 2 / 2'),
].join('\n');

const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 9 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R >> >> /Contents 8 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>',
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R /F4 7 0 R >> >> /Contents 10 0 R >>',
  `<< /Length ${Buffer.byteLength(secondStream)} >>\nstream\n${secondStream}\nendstream`,
];
let pdf = '%PDF-1.4\n';
const offsets = [0];
objects.forEach((object, index) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
});
const xrefOffset = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets
  .slice(1)
  .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
  .join('');
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
writeFileSync(new URL('./messy-text.pdf', import.meta.url), pdf);
console.log(`Created messy-text.pdf (${Buffer.byteLength(pdf)} bytes).`);
