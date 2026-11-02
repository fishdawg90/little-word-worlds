import fs from 'node:fs';
import path from 'node:path';
import {deflateRawSync} from 'node:zlib';
const root=process.cwd();const dest=path.join(root,'dist','pack-studio');fs.mkdirSync(dest,{recursive:true});
for(const n of ['index.html','game.html','shared','packs','studio','tests','README.md','package.json','package-lock.json'])fs.cpSync(path.join(root,n),path.join(dest,n),{recursive:true});
fs.mkdirSync(path.join(dest,'tools'),{recursive:true});for(const n of ['import-pack.mjs','package.mjs'])fs.copyFileSync('tools/'+n,path.join(dest,'tools',n));
fs.mkdirSync('downloads',{recursive:true});const zip=path.join(root,'downloads','pack-studio.zip');
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(b){let n=0xffffffff;for(const x of b)n=table[(n^x)&255]^(n>>>8);return(n^0xffffffff)>>>0}
function walk(dir,prefix=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name),prefix+e.name+'/'):[prefix+e.name])}
const entries=walk(dest),local=[],central=[];let offset=0;
for(const name of entries){const data=fs.readFileSync(path.join(dest,name)),compressed=deflateRawSync(data),filename=Buffer.from(name),crc=crc32(data);const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt16LE(33,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(compressed.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(filename.length,26);local.push(h,filename,compressed);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(33,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);central.push(c,filename);offset+=h.length+filename.length+compressed.length;}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);fs.writeFileSync(zip,Buffer.concat([...local,directory,end]));console.log('Created downloads/pack-studio.zip ('+entries.length+' files)');
