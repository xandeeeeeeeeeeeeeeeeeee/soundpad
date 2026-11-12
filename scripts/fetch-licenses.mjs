import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const stage=path.resolve(process.argv[2]);
const ytVersion=execFileSync(path.join(stage,'tools','yt-dlp.exe'),['--version'],{encoding:'utf8',windowsHide:true}).trim();
for(const [url,name] of [
 [`https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`,'Node-LICENSE.txt'],
 [`https://raw.githubusercontent.com/yt-dlp/yt-dlp/${ytVersion}/LICENSE`,'yt-dlp-LICENSE.txt'],
 [`https://raw.githubusercontent.com/yt-dlp/yt-dlp/${ytVersion}/THIRD_PARTY_LICENSES.txt`,'yt-dlp-THIRD_PARTY_LICENSES.txt']
]){const response=await fetch(url);if(!response.ok)throw Error(`${name}: HTTP ${response.status}`);await writeFile(path.join(stage,'licenses',name),await response.text())}
await writeFile(path.join(stage,'licenses','VERSIONS.txt'),`Node.js ${process.version}\nyt-dlp ${ytVersion}\nFFmpeg 6.1.1-essentials_build-www.gyan.dev\n`);
