const fs = require('fs');
const path = require('path');
const tar = require('tar-fs');
const getTestSize = require('get-folder-size');
const prettyBytes = require('pretty-bytes');

const zlib = require('zlib');
const zstd = require('node-zstandard');
const nzstd = require('node-zstd');
const simpleZSTD = require('simple-zstd');
const compressjs = require('compressjs');

const src = path.join(__dirname, 'samples', 'case');
const dump = path.join(__dirname, 'samples', 'case.dump');

async function asyncTestSize(folder) {
  return new Promise((resolve, reject) => {
    getTestSize(folder, (err, size) => {
      if (err) return reject(err);
      return resolve(size);
    });
  });
}

async function printResult(dst) {
  const ogSize = await asyncTestSize(src);
  const fSize = fs.statSync(dst).size;
  console.log(`Orignal Size: ${prettyBytes(ogSize)} Final Size: ${prettyBytes(fSize)} Ratio: ${ogSize / fSize}\n`);
}

// GZIP

async function gzipTest() {
  console.log('GZIP');
  const dst = path.join(__dirname, 'samples', 'case.tar.gz');

  await new Promise((resolve, reject) => {
    console.time('c');
    const gzip = zlib.createGzip();
    tar.pack(src).pipe(gzip).pipe(fs.createWriteStream(dst))
      .on('finish', () => resolve(console.timeEnd('c')))
      .on('error', e => reject(e));
  });

  await new Promise((resolve, reject) => {
    console.time('d');
    const gzip = zlib.Unzip();
    fs.createReadStream(dst).pipe(gzip).pipe(tar.extract(dump))
      .on('finish', () => resolve(console.timeEnd('d')))
      .on('error', e => reject(e));
  });

  await printResult(dst);
}

// NODE-ZSTANDARD

async function zstdTest(level) {
  console.log(`NODE-STANDARD ${level}`);
  const dst = path.join(__dirname, 'samples', 'case.tar.zstd');

  await new Promise((resolve, reject) => {
    console.time('c');
    zstd.compressStreamToFile(tar.pack(src), dst, level, (err, result) => {
      if (err) return reject(err);
      result.on('finish', () => resolve(console.timeEnd('c')));
      result.on('error', e => reject(e));
    });
  });

  await new Promise((resolve, reject) => {
    console.time('d');
    const writeStream = tar.extract(dump);
    zstd.decompressFileToStream(dst, writeStream, (err, result) => {
      if (err) return reject(err);
      result.on('finish', () => resolve(console.timeEnd('d')));
      result.on('error', e => reject(e));
    });
  });

  await printResult(dst);
}

// NODE-ZSTD

async function nzstdTest(level) {
  console.log(`NODE-ZSTD ${level}`);
  const dst = path.join(__dirname, 'samples', 'case.tar.zstd');

  await new Promise((resolve, reject) => {
    console.time('c');
    tar.pack(src).pipe(nzstd.compressStream({ level })).pipe(fs.createWriteStream(dst))
      .on('finish', () => resolve(console.timeEnd('c')))
      .on('error', e => reject(e));
  });

  await new Promise((resolve, reject) => {
    console.time('d');
    fs.createReadStream(dst).pipe(nzstd.decompressStream({ level })).pipe(tar.extract(dump))
      .on('finish', () => resolve(console.timeEnd('d')))
      .on('error', e => reject(e));
  });

  await printResult(dst);
}

async function simpleZstdTest(level) {
  console.log(`SIMPLE-ZSTD ${level}`);
  const dst = path.join(__dirname, 'samples', 'case.tar.zstd');

  await new Promise((resolve, reject) => {
    console.time('c');
    tar.pack(src).pipe(simpleZSTD.ZSTDCompress(level)).pipe(fs.createWriteStream(dst))
      .on('finish', () => resolve(console.timeEnd('c')))
      .on('error', e => reject(e));
  });

  await new Promise((resolve, reject) => {
    console.time('d');
    fs.createReadStream(dst).pipe(simpleZSTD.ZSTDDecompress()).pipe(tar.extract(dump))
      .on('finish', () => resolve(console.timeEnd('d')))
      .on('error', e => reject(e));
  });

  await printResult(dst);
}

// COMPRESSJS BZIP2

async function bzip2Test(level) {
  console.log(`COMPRESSJS BZIP2 ${level}`);
  const dst = path.join(__dirname, 'samples', 'case.tar.bz2');

  await new Promise((resolve, reject) => {
    const timer = 'compress';
    console.time(timer);
    const readStream = tar.pack(src);
    const writeStream = fs.createWriteStream(dst);
    compressjs.Bzip2.compressFile(readStream, writeStream, level);
    console.timeEnd(timer);
    resolve();
  });

  await new Promise((resolve, reject) => {
    const timer = 'decompress';
    console.time(timer);
    const readStream = fs.createReadStream(dst);
    const writeStream = tar.extract(dump);
    compressjs.Bzip2.decompressFile(readStream, writeStream);
    console.timeEnd(timer);
    resolve();
  });

  await printResult(dst);
}

async function main() {
  await gzipTest();

  // await bzip2Test(1);

  // await zstdTest(1);
  // await zstdTest(3);
  // await zstdTest(9);
  // await zstdTest(13);

  await nzstdTest(1);
  await nzstdTest(3);
  // await nzstdTest(9);
  // await nzstdTest(13);

  await simpleZstdTest(1);
  await simpleZstdTest(3);
  // await simpleZstdTest(9);
  // await simpleZstdTest(13);
}

main().then(() => {
  console.log('done');
}).catch((err) => {
  console.error(err);
});
