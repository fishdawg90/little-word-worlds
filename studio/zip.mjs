
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
export async function zipFile(file,onProgress=()=>{}){
  if(file.size>0x7fffffff)throw Error('Please choose a file smaller than 2 GB.');
  const cleanName=(file.name.split(/[\\/]/).pop()||'vocabulary.pack.json').replace(/[\x00-\x1f\x7f]/g,'_');
  const name=new TextEncoder().encode(cleanName);if(name.length>65535)throw Error('The filename is too long.');
  let crc=0xffffffff,read=0,lastUpdate=0;
  const meter=new TransformStream({transform(chunk,controller){for(const byte of chunk)crc=crcTable[(crc^byte)&255]^(crc>>>8);read+=chunk.length;const now=Date.now();if(now-lastUpdate>100||read===file.size){onProgress(file.size?read/file.size:1);lastUpdate=now}controller.enqueue(chunk)}});
  let payload,method;
  if(typeof CompressionStream==='function'){
    // Browser "deflate" produces a zlib wrapper; ZIP contains the raw DEFLATE payload.
    const wrapped=await new Response(file.stream().pipeThrough(meter).pipeThrough(new CompressionStream('deflate'))).blob();
    payload=wrapped.slice(2,wrapped.size-4);method=8;
  }else{
    const reader=file.stream().pipeThrough(meter).getReader();while(!(await reader.read()).done){}payload=file;method=0;
  }
  crc=(crc^0xffffffff)>>>0;
  const date=new Date(),year=Math.max(1980,Math.min(2107,date.getFullYear())),dosDate=((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate(),dosTime=(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1);
  const local=new Uint8Array(30),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(8,method,true);l.setUint16(10,dosTime,true);l.setUint16(12,dosDate,true);l.setUint32(14,crc,true);l.setUint32(18,payload.size,true);l.setUint32(22,file.size,true);l.setUint16(26,name.length,true);
  const central=new Uint8Array(46),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(10,method,true);c.setUint16(12,dosTime,true);c.setUint16(14,dosDate,true);c.setUint32(16,crc,true);c.setUint32(20,payload.size,true);c.setUint32(24,file.size,true);c.setUint16(28,name.length,true);
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,1,true);e.setUint16(10,1,true);e.setUint32(12,central.length+name.length,true);e.setUint32(16,local.length+name.length+payload.size,true);
  return {blob:new Blob([local,name,payload,central,name,end],{type:'application/zip'}),filename:cleanName.replace(/\.json$/i,'')+'.zip',compressed:method===8};
}
