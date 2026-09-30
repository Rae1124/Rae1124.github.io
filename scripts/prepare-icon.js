'use strict';
const fs = require('node:fs');
const path = require('node:path');
const pngToIcoModule = require('png-to-ico');
const pngToIco = pngToIcoModule.default || pngToIcoModule;
async function main(){const source=path.join(__dirname,'..','build','icon-source.png');const target=path.join(__dirname,'..','build','icon.ico');if(!fs.existsSync(source))throw new Error('Missing approved icon source: build/icon-source.png');const ico=await pngToIco(source);if(!Buffer.isBuffer(ico)||ico.length<1024)throw new Error('Icon conversion did not produce a valid ICO buffer.');fs.writeFileSync(target,ico);process.stdout.write(`Prepared ${target}\n`);}
main().catch(error=>{process.stderr.write(`${error.message}\n`);process.exit(1);});
