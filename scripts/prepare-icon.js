'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;
const EXPECTED_SHA256 = '5b03bc7a9d6f677aff2790bb26739faac7ebbe4dc4c52d92b68c7234e7cdd438';
async function main(){
  const source = path.join(__dirname,'..','build','icon-source.base64');
  const target = path.join(__dirname,'..','build','icon.ico');
  if(!fs.existsSync(source)) throw new Error('Missing approved icon source: build/icon-source.base64');
  const png = Buffer.from(fs.readFileSync(source,'utf8').trim(),'base64');
  const digest = crypto.createHash('sha256').update(png).digest('hex');
  if(digest !== EXPECTED_SHA256) throw new Error('Approved icon source failed integrity verification.');
  if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Approved icon source is not a PNG.');
  const ico = await pngToIco(png);
  if(!Buffer.isBuffer(ico)||ico.length<1024) throw new Error('Icon conversion did not produce a valid ICO buffer.');
  fs.writeFileSync(target,ico);
  process.stdout.write(`Prepared ${target}\n`);
}
main().catch(error=>{process.stderr.write(`${error.message}\n`);process.exit(1);});
