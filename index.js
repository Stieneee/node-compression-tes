require('dotenv').config()
const fs = require('fs');
const path = require('path');
const tar = require('tar-fs');
const getTestSize = require('get-folder-size');

const zlib = require('zlib');
const zstd = require('node-zstandard');
// const nzstd = require('node-zstd');
const simpleZSTD = require('simple-zstd');
const { compressStream, decompressStream } = require('@xingrz/cppzst');

const src = path.join(__dirname, 'samples', 'case');

const plotly = require('plotly')(process.env.PLOTLY_USERNAME, process.env.PLOTLY_API_KEY);

const sleepAsync = (time) => new Promise((resolve) => { setTimeout(() => resolve(), time); });

let ogSize;
let ogSizeMB;

const gzipResults = {
  x: [],
  y: [],
  z: [],
  text: [],
  mode: 'lines',
  name: 'GZIP',
  type: 'scatter3d'
};

const brotliResults = {
  x: [],
  y: [],
  z: [],
  text: [],
  mode: 'lines',
  name: 'BROTLI',
  type: 'scatter3d'
};

const simpleZSTDResults = {
  x: [],
  y: [],
  z: [],
  text: [],
  mode: 'lines',
  name: 'SIMPLE-ZSTD',
  type: 'scatter3d'
};

const nodeZSTANDARDResults = {
  x: [],
  y: [],
  z: [],
  text: [],
  mode: 'lines',
  name: 'NODE-ZSTANDARD',
  type: 'scatter3d'
};

const ccpzstResults = {
  x: [],
  y: [],
  z: [],
  text: [],
  mode: 'lines',
  name: 'CCPZST',
  type: 'scatter3d'
};


async function asyncTestSize(folder) {
  return new Promise((resolve, reject) => {
    getTestSize(folder, (err, size) => {
      if (err) return reject(err);
      return resolve(size);
    });
  });
}

function recordResult(resObj, label, level, dst, cTime, dTime) {
  const fSize = fs.statSync(dst).size;
  const ratio = (ogSize / fSize).toPrecision(3);
  const compressSpeed = (ogSizeMB / (cTime / 1000)).toPrecision(3);
  const decompressSpeed = (ogSizeMB / (dTime / 1000)).toPrecision(3);
  console.log(compressSpeed, decompressSpeed, ratio);

  resObj.x.push(compressSpeed);
  resObj.y.push(decompressSpeed);
  resObj.z.push(ratio);
  resObj.text.push(`${label}:${level}`);
}

// GZIP

async function gzipTest(level) {
  console.log(`GZIP ${level}`);
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
    fs.createReadStream(dst).pipe(gzip).pipe(fs.createWriteStream('/dev/null'))
      .on('finish', () => {
        dTime = Date.now() - start;
        resolve();
      })
      .on('error', e => reject(e));
  });

  recordResult(gzipResults, 'GZIP', level, dst, cTime, dTime);
}

async function brotliTest(level) {
  console.log(`BROTLI ${level}`);
  const dst = path.join(__dirname, 'samples', 'case.tar.br');
  let cTime;
  let dTime;

  await new Promise((resolve, reject) => {
    const start = Date.now();
    const brotli = zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_GENERIC,
        [zlib.constants.BROTLI_PARAM_QUALITY]: level,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: ogSize
      }
    });
    tar.pack(src).pipe(brotli).pipe(fs.createWriteStream(dst))
      .on('finish', () => {
        cTime = Date.now() - start;
        resolve();
      })
      .on('error', e => reject(e));
  });

  await new Promise((resolve, reject) => {
    const start = Date.now();
    const brotli = zlib.createBrotliDecompress({})
    fs.createReadStream(dst).pipe(brotli).pipe(fs.createWriteStream('/dev/null'))
      .on('finish', () => {
        dTime = Date.now() - start;
        resolve();
      })
      .on('error', e => reject(e));
  });

  recordResult(brotliResults, 'BROTLI', level, dst, cTime, dTime);
}

// SIMPLE-ZSTD

async function simpleZstdTest(level) {
  console.log(`SIMPLE-ZSTD ${level}`);
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
    fs.createReadStream(dst).pipe(simpleZSTD.ZSTDDecompress()).pipe(fs.createWriteStream('/dev/null'))
      .on('finish', () => {
        dTime = Date.now() - start;
        resolve();
      })
      .on('error', e => reject(e));
  });

  recordResult(simpleZSTDResults, 'SIMPLE-ZSTD', level, dst, cTime, dTime);
}

// NODE-ZSTANDARD

async function zstdTest(level) {
  console.log(`NODE-ZSTANDARD ${level}`);
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
    zstd.decompressFileToStream(dst, fs.createWriteStream('/dev/null'), (err, result) => {
      if (err) return reject(err);
      result.on('finish', () => {
        dTime = Date.now() - start;
        resolve();
      });
      result.on('error', e => reject(e));
    });
  });

  recordResult(nodeZSTANDARDResults, 'NODE-ZSTANDARD', level, dst, cTime, dTime);
}

// ZSTD-CODEC

async function cppzstTest(level) {
  console.log(`CPPZST ${level}`);
  const dst = path.join(__dirname, 'samples', 'case.tar.zstd');
  let cTime;
  let dTime;

  await new Promise((resolve, reject) => {
    const start = Date.now();
    const gzip = compressStream({ level });
    tar.pack(src).pipe(gzip).pipe(fs.createWriteStream(dst))
      .on('finish', () => {
        cTime = Date.now() - start;
        resolve();
      })
      .on('error', e => reject(e));
  });

  await new Promise((resolve, reject) => {
    const start = Date.now();
    const gzip = decompressStream();
    fs.createReadStream(dst).pipe(gzip).pipe(fs.createWriteStream('/dev/null'))
      .on('finish', () => {
        dTime = Date.now() - start;
        resolve();
      })
      .on('error', e => reject(e));
  });

  recordResult(ccpzstResults, 'CPPZST', level, dst, cTime, dTime);
}

// NODE-ZSTD

// async function nzstdTest(level) {
//   console.log(`NODE-ZSTD ${level}`);
//   const dst = path.join(__dirname, 'samples', 'case.tar.zstd');
//   let cTime;
//   let dTime;

//   await new Promise((resolve, reject) => {
//     const start = Date.now();
//     tar.pack(src).pipe(nzstd.compressStream({ level })).pipe(fs.createWriteStream(dst))
//       .on('finish', () => {
//         cTime = Date.now() - start;
//         resolve();
//       })
//       .on('error', e => reject(e));
//   });

//   await new Promise((resolve, reject) => {
//     const start = Date.now();
//     fs.createReadStream(dst).pipe(nzstd.decompressStream({ level })).pipe(fs.createWriteStream('/dev/null'))
//       .on('finish', () => {
//         dTime = Date.now() - start;
//         resolve();
//       })
//       .on('error', e => reject(e));
//   });

//   await printResult('NODE-ZSTD', level, dst, cTime, dTime);
// }

async function plot() {
  // plot the results using plotly library
  const results = [gzipResults, brotliResults, simpleZSTDResults, nodeZSTANDARDResults, ccpzstResults];
  await new Promise((resolve, reject) => {
    const graphOptions = {
      filename: "Node Compression Test",
      fileopt: "overwrite",
      scene: {
        xaxis: {
          autoreverse: true,
        },
        yaxis: {
          autoreverse: true,
        },
      },
      title: {
        text: 'Node Streaming Compression Test',
      },
      xaxis: {
        title: {
          text: "Compression Speed (MB/s)"
        }
      },
      yaxis: {
        title: {
          text: "Decompression Speed (MB/s)"
        }
      },
      zaxis: {
        title: {
          text: "Ratio"
        }
      }
    };

    plotly.plot(results, graphOptions, function (err, msg) {
      if (err) return reject(err);
      console.log(msg);
      return resolve(msg);
    });
  })
}

async function main() {
  ogSize = await asyncTestSize(src);
  ogSizeMB = ogSize / 1024 / 1024;
  console.log(`Original Size: ${ogSizeMB} MB`);
  // console.log('Source File Size', prettyBytes(ogSize));

  // GZIP

  for (let i = 1; i < 10; i += 1) {
    await gzipTest(i);
    await sleepAsync(1000);
  }

  // BROTLI

  // console.log('BROTLI', zlib.constants.BROTLI_MIN_QUALITY, zlib.constants.BROTLI_MAX_QUALITY);
  for (let i = zlib.constants.BROTLI_MIN_QUALITY; i <= zlib.constants.BROTLI_MAX_QUALITY; i += 1) {
    await brotliTest(i);
    await sleepAsync(1000);
  }

  // ZSTD

  for (let i = 1; i <= 21; i += 1) {
    await simpleZstdTest(i);
    await sleepAsync(1000);

    await zstdTest(i);
    await sleepAsync(1000);

    await cppzstTest(i);
    await sleepAsync(1000);

    // await nzstdTest(i);
    // await sleepAsync(1000);
  }

  plot()
}

main().then(() => {
  console.log('done');
}).catch((err) => {
  console.error(err);
});
