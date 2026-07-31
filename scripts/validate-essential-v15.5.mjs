import fs from 'node:fs';

const css = fs.readFileSync('src/app/globals.css', 'utf8');
const list = fs.readFileSync('src/app/essencial/chat/components/ChatMessagesList.tsx', 'utf8');
const legacy = fs.readFileSync('src/app/essencial/chat/components/ChatMessages.tsx', 'utf8');

const checks = [
  ['classe exclusiva do Essencial', list.includes('publia-footnote--essential')],
  ['rota alternativa do Essencial protegida', legacy.includes('publia-footnote--essential')],
  ['rodapé fixado em 14px', /\.publia-footnote--essential\s*\{[\s\S]*font-size:\s*14px\s*!important/.test(css)],
  ['descendentes fixados em 14px', /\.publia-footnote--essential,\s*[\s\S]*\.publia-footnote--essential \*[\s\S]*font-size:\s*14px\s*!important/.test(css)],
  ['text-size-adjust protegido', css.includes('-webkit-text-size-adjust: 100% !important') && css.includes('text-size-adjust: 100% !important')],
  ['sem escala ou zoom redutor', css.includes('transform: none !important') && css.includes('zoom: 1 !important')],
  ['Governança não alterado', !list.includes('GovernanceChatClient')],
];

let failed = false;
for (const [name, ok] of checks) {
  if (!ok) failed = true;
  console.log(`${ok ? 'OK' : 'ERRO'}: ${name}`);
}
if (failed) process.exit(1);
console.log('Publ.IA Essencial v15.5: validação estrutural concluída.');
