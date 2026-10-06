'use strict';
const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{const {default:pngToIco}=await import('png-to-ico');const build=path.join(__dirname,'../build');await fs.mkdir(build,{recursive:true});await fs.writeFile(path.join(build,'icon.ico'),await pngToIco(path.join(build,'icon-source.png')));console.log('Prepared build/icon.ico');})().catch(error=>{console.error(error.message);process.exitCode=1;});
