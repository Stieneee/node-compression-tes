const fs = require('fs');
const path = require('path');
const tar = require('tar-fs');
const getTestSize = require('get-folder-size');
const prettyBytes = require('pretty-bytes');
const Table = require('cli-table');

const zlib = require('zlib');
const zstd = require('node-zstandard');
const nzstd = require('node-zstd');
const simpleZSTD = require('simple-zstd');

const src = path.join(__dirname, 'samples', 'case');
const dump = path.join(__dirname, 'samples', 'case.dump');

let ogSize;

function sleepAsync(time) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), time);
  });
}

async function asyncTestSize(folder) {
  return new Promise((resolve, reject) => {
    getTestSize(folder, (err, size) => {
      if (err) return reject(err);
      return resolve(size);
    });
  });
}

const table = new Table({
  head: ['Package', 'Level', 'Total (ms)', 'Compression Time (ms)', 'Decompress Time (ms)', 'Final Size', ' Ratio'],
  // colWidths: [100, 200],
});

async function printResult(p, level, dst, cTime, dTime) {
  const fSize = fs.statSync(dst).size;
  table.push([p, level, cTime + dTime, cTime, dTime, prettyBytes(fSize), ogSize / fSize]);
}

// GZIP

async function gzipTest(level) {
  // console.log(`GZIP ${level}`);
  const dst = path.join(__dirname, 'samples', 'case.tar.gz');
  let cTime;
  let dTime;

  await new Promise((resolve, reject) => {
    const start = Date.now();
    const gzip = zlib.createGzip({ level });
    tar.pack(src).pipe(gzip).pipe(fs.createWriteStream(dst))
      .on('finish', () => {
        cTime = Date.now() - start;
        resolve();
      })
      .on('error', e => reject(e));
  });

  await new Promise((resolve, reject) => {
    const start = Date.now();
    const gzip = zlib.Unzip();
    fs.createReadStream(dst).pipe(gzip).pipe(tar.extract(dump))
      .on('finish', () => {
        dTime = Date.now() - start;
        resolve();
      })
      .on('error', e => reject(e));
  });

  await printResult('GZIP', level, dst, cTime, dTime);
}

// NODE-ZSTANDARD

async function zstdTest(level) {
  // console.log(`NODE-STANDARD ${level}`);
  const dst = path.join(__dirname, 'samples', 'case.tar.zstd');
  let cTime;
  let dTime;

  await new Promise((resolve, reject) => {
    const start = Date.now();
    zstd.compressStreamToFile(tar.pack(src), dst, level, (err, result) => {
      if (err) return reject(err);
      result.on('end', () => {
        cTime = Date.now() - start;
        resolve();
      });
      result.on('error', (e) => {
        console.error(err);
        reject(e);
      });
    });
  });

  await new Promise((resolve, reject) => {
    const start = Date.now();
    const writeStream = tar.extract(dump);
    zstd.decompressFileToStream(dst, writeStream, (err, result) => {
      if (err) return reject(err);
      result.on('finish', () => {
        dTime = Date.now() - start;
        resolve();
      });
      result.on('error', e => reject(e));
    });
  });

  await printResult('NODE-ZSTANDARD', level, dst, cTime, dTime);
}

// NODE-ZSTD

async function nzstdTest(level) {
  // console.log(`NODE-ZSTD ${level}`);
  const dst = path.join(__dirname, 'samples', 'case.tar.zstd');
  let cTime;
  let dTime;

  await new Promise((resolve, reject) => {
    const start = Date.now();
    tar.pack(src).pipe(nzstd.compressStream({ level })).pipe(fs.createWriteStream(dst))
      .on('finish', () => {
        cTime = Date.now() - start;
        resolve();
      })
      .on('error', e => reject(e));
  });

  await new Promise((resolve, reject) => {
    const start = Date.now();
    fs.createReadStream(dst).pipe(nzstd.decompressStream({ level })).pipe(tar.extract(dump))
      .on('finish', () => {
        dTime = Date.now() - start;
        resolve();
      })
      .on('error', e => reject(e));
  });

  await printResult('NODE-ZSTD', level, dst, cTime, dTime);
}

async function simpleZstdTest(level) {
  // console.log(`SIMPLE-ZSTD ${level}`);
  const dst = path.join(__dirname, 'samples', 'case.tar.zstd');
  let cTime;
  let dTime;

  await new Promise((resolve, reject) => {
    const start = Date.now();
    tar.pack(src).pipe(simpleZSTD.ZSTDCompress(level)).pipe(fs.createWriteStream(dst))
      .on('finish', () => {
        cTime = Date.now() - start;
        resolve();
      })
      .on('error', e => reject(e));
  });

  await new Promise((resolve, reject) => {
    const start = Date.now();
    fs.createReadStream(dst).pipe(simpleZSTD.ZSTDDecompress()).pipe(tar.extract(dump))
      .on('finish', () => {
        dTime = Date.now() - start;
        resolve();
      })
      .on('error', e => reject(e));
  });

  await printResult('SIMPLE-ZSTD', level, dst, cTime, dTime);
}

async function main() {
  ogSize = await asyncTestSize(src);
  console.log('Source File Size', prettyBytes(ogSize));

  await gzipTest(1);
  await sleepAsync(1000);
  await gzipTest(zlib.constants.Z_DEFAULT_COMPRESSION);
  await sleepAsync(1000);
  await gzipTest(9);
  await sleepAsync(1000);

  const tests = [1, 3, 9, 21];

  for (const test of tests) {
    await zstdTest(test);
    await sleepAsync(1000);
    await nzstdTest(test);
    await sleepAsync(1000);
    await simpleZstdTest(test);
    await sleepAsync(1000);
  }


  console.log(table.toString());
}

main().then(() => {
  console.log('done');
}).catch((err) => {
  console.error(err);
});
