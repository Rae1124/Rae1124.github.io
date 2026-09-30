'use strict';
const fs=require('node:fs');
const path=require('node:path');

(async()=>{
  const {default:pngToIco}=await import('png-to-ico');
  const root=path.resolve(__dirname,'..');
  const source=path.join(root,'build','icon-source.png');
  const target=path.join(root,'build','icon.ico');
  if(!fs.existsSync(source))throw new Error('Missing build/icon-source.png');
  const ico=await pngToIco(source);
  fs.writeFileSync(target,ico);
  if(!fs.existsSync(target)||fs.statSync(target).size===0)throw new Error('Icon conversion produced an empty file.');
  console.log(`Prepared ${target}`);
})().catch(error=>{console.error(error.message);process.exitCode=1});
