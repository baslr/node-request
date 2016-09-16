'use strict';

const crypto = require('crypto');
const https =  require('https');
const http  =  require('http');

const rawRequest = require('./rawRequest');

const httpAgent  = new http.Agent({  keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });


class Request {
    constructor(opts) {
        if (!opts.headers) opts.headers = {};
        this.opts = opts;
    }

    reqOpts(opts = {headers:{}}) {
        const headers = Object.assign({}, this.opts.headers, opts.headers);
        const reqOpts = Object.assign({}, this.opts,         opts);
        reqOpts.headers = headers;
        if ( isNaN(reqOpts.tries)) reqOpts.tries = 0;
        if ( ! reqOpts.id) reqOpts.id = `${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
        reqOpts.tries++;

        return reqOpts;
    }

    head(opts, cb) { this.doRequest(opts, 'HEAD', cb); }

    get(opts, cb) { this.doRequest(opts, 'GET', cb); }

    post(opts, cb) { this.doRequest(opts, 'POST', cb); }


    doRequest(opts, method, cb) {
        const reqOpts = this.reqOpts(opts);
        reqOpts.method = method;

        rawRequest(reqOpts, (err, status, headers, body) => {
          this.handleResponse(reqOpts, cb, err, status, headers, body);
        });
    }

    handleResponse(reqOpts, cb, err, status, headers, body = Buffer.alloc(0)) {
        // console.log('- - - - - - - - - - - - - - - - - - - - - - - - - -');
        console.log(`${reqOpts.id} - ${reqOpts.method}:${reqOpts.hostname}${reqOpts.path} Tries: ${reqOpts.tries}, Status: ${status}, Length: ${body.length}`);
        // console.log( JSON.stringify(headers, false, 2) );
        // console.log('- - - - - - - - - - - - - - - - - - - - - - - - - -');

        const handler = reqOpts.externalHandler || this;

        if (err) {
            if (handler.onError) {
                handler.onError(reqOpts, cb, err, status, headers, body);
                return;
            } // if

            if (reqOpts.retryOnError) {
                handler[reqOpts.method.toLowerCase()](reqOpts, cb);
            } // if

            console.log('Request: Error', err);
            cb(0, null, null);
            return;
        } // if

        // try status code ranges
        if (200 <= status && status < 300 && handler.on2xx) {
            handler.on2xx(reqOpts, cb, err, status, headers, body);
            return;
        }

        if(300 <= status && status < 400 && handler.on3xx) {
            handler.on3xx(reqOpts, cb, err, status, headers, body);
            return;
        }

        if(400 <= status && status < 500 && handler.on4xx) {
            handler.on4xx(reqOpts, cb, err, status, headers, body);
            return;
        }

        if(500 <= status && status < 600 && handler.on5xx) {
            handler.on5xx(reqOpts, cb, err, status, headers, body);
            return;
        }

        if(600 <= status && handler.on6xx) {
            handler.on6xx(reqOpts, cb, err, status, headers, body);
            return;
        }

        // try one specific status code
        const onStatus = `on${status}`;

        if (handler[onStatus]) {
            handler[onStatus](reqOpts, cb, err, status, headers, body);
            return;
        } // if

        if(500 <= status && status < 600) {
            const enoughtTriesLeft = reqOpts.maxTries ? reqOpts.maxTries >= reqOpts.tries : true;
            if (reqOpts.retryOn5xx && enoughtTriesLeft) {
                handler[reqOpts.method.toLowerCase()](reqOpts, cb);
                return;
            }
        } // if

        cb(status, headers, body);
    } // handleResponse()
} // class

class HttpsRequest extends Request {
    constructor(opts = {}) {
        opts.con = https;
        if (!opts.agent) opts.agent = httpsAgent;
        super(opts);
    }
}

class HttpRequest extends Request {
    constructor(opts = {}) {
        opts.con = http;
        if (!opts.agent) opts.agent = httpAgent;
        super(opts);
    }
}

module.exports.http  = HttpRequest;
module.exports.https = HttpsRequest;
