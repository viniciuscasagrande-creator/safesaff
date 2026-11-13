import fs from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
const npm=process.platform==='win32'?'npm.cmd':'npm';
const docker=process.platform==='win32'?'docker.exe':'docker';
function run(cmd,args){const r=spawnSync(cmd,args,{stdio:'inherit',shell:false});if(r.status!==0)process.exit(r.status??1)}
const composeFile=fs.existsSync('config/deploy/docker-compose.local.yml')?'config/deploy/docker-compose.local.yml':'docker-compose.local.yml';
run(docker,['compose','-f',composeFile,'up','-d']);
run(npm,['run','db:local:setup']);
run(npm,['run','db:local:check']);
console.log('\nStack local pronto. Abra http://localhost:3000 e faça login novamente no banco local.\n');
const child=spawn(npm,['run','dev'],{stdio:'inherit',shell:false});
child.on('exit',code=>process.exit(code??0));
