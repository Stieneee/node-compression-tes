# Node Compression Test

A test of various compressions algorithms and packages in node.

## Test

http://www.mattmahoney.net/dc/textdata.html enwiki8 was used.

Ubuntu 18.04

zstd command line interface 64-bits v1.3.3, by Yann Collet

AMD Ryzen 5 1600X Six-Core Processor @ 3.9 GHz (set by cpufreq-set)

## Results

```
GZIP
c: 7057.488ms
d: 781.072ms
Orignal Size: 100 MB Final Size: 36.5 MB Ratio: 2.736151338868505

NODE-ZSTD 1
c: 743.522ms
d: 301.357ms
Orignal Size: 100 MB Final Size: 40.9 MB Ratio: 2.447505207159981

NODE-ZSTD 3
c: 1211.758ms
d: 290.843ms
Orignal Size: 100 MB Final Size: 35.7 MB Ratio: 2.8021868266971115

SIMPLE-ZSTD 1
c: 514.889ms
d: 366.660ms
Orignal Size: 100 MB Final Size: 40.9 MB Ratio: 2.447504967558549

SIMPLE-ZSTD 3
c: 740.769ms
d: 375.380ms
Orignal Size: 100 MB Final Size: 35.7 MB Ratio: 2.8021865126199708

```

## License

MIT
