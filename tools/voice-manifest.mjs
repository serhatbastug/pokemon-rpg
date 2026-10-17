// assets/voice/lines.json'a hangi satırların ses dosyası olduğunu işler.
// Ses eklediğinde ya da sildiğinde çalıştır: node tools/voice-manifest.mjs
// Dosyası olmayan satırlar oyunda istek atmaz, "bıt" sesiyle okunur.
import fs from 'node:fs';

const dir = new URL('../assets/voice/', import.meta.url);
const file = new URL('lines.json', dir);
const lines = JSON.parse(fs.readFileSync(file, 'utf8'));
let n = 0;
for (const l of lines) {
    l.voiced = fs.existsSync(new URL(l.id + '.mp3', dir));
    if (l.voiced) n++;
}
fs.writeFileSync(file, JSON.stringify(lines, null, 1) + '\n');
console.log(`${n}/${lines.length} satirin ses dosyasi var`);
