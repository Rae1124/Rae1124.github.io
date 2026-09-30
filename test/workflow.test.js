const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const yaml=require('js-yaml');
test('Windows build fails on missing artifacts and only packages after verification',()=>{
 assert.ok(fs.existsSync('.github/workflows/build-desktop.yml'),'Windows workflow missing');
 const flow=yaml.load(fs.readFileSync('.github/workflows/build-desktop.yml','utf8'));const job=flow.jobs.build;
 assert.equal(job['runs-on'],'windows-latest');const commands=job.steps.filter(s=>s.run).map(s=>s.run);
 assert.ok(commands.indexOf('npm ci')<commands.indexOf('npm test'));assert.ok(commands.indexOf('npm test')<commands.indexOf('npm run build:win'));
 const upload=job.steps.find(s=>s.uses?.startsWith('actions/upload-artifact@'));assert.equal(upload.with['if-no-files-found'],'error');assert.match(upload.with.path,/Setup.exe/);assert.match(upload.with.path,/Portable.exe/);
});
