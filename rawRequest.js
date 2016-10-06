'use strict';

const zlib  =  require('zlib');

module.exports = (opts, cb) => {
    let doneCallback = false;

    if (opts.setContentLength && (opts.buffer instanceof Buffer)) {
        opts.headers['content-length'] = opts.buffer.length;
    } // if

    const req = opts.con.request(opts);
  
    req.on('error', (e) => {
        if (doneCallback) {
            console.log('RawRequest: req.on.error already called back');
            return;
        } // if
        doneCallback = true;

        cb(e);
    });

    req.on('response', (res) => {
        const length = Number(res.headers['content-length']);
        let buf;
        let i = 0;
  
        if (length) {
            buf = Buffer.alloc(length);
        } else {
            buf = Buffer.alloc(0);
        }

        res.on('data', (d) => {
            if(length) {
                d.copy(buf, i);
                i += d.length;
            } else {
                buf = Buffer.concat([buf, d]);
            }
        });
        res.on('end', () => {
            if (doneCallback) {
                console.log(`${opts.id} - Request: Response.end already called back`);
                return;
            } // if
            doneCallback = true;

            if (opts.method === 'HEAD') {
                cb(null, res.statusCode, res.headers, buf);
                return;
            } // if

            switch(res.headers['content-encoding']) {
                case 'gzip':
                    zlib.unzip(buf, (err, buf) => {
                        cb(err, res.statusCode, res.headers, buf);
                    });
                    break;

                default:
                    cb(null, res.statusCode, res.headers, buf);
                    break;
            } // switch
        });
    });
  
    if (opts.buffer) {
        req.write(opts.buffer);
        req.end();

    } else if (opts.stream) {
        opts.stream.pipe(req);

    } else if (opts.externalWrite) {
        opts.externalWrite(req);

    } else {
        req.end();
    }
}
