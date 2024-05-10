import { Connection } from '../index.js';

import { expect } from 'chai';

/*
    Please note that many of these tests check the timing of mocked requests.
    Small variations are usually handled by the fact all timings are rounded to the nearest 100ms,
    but it is possible that very slow computers might be the cause of some failures.
*/


// Replace global fetch with a mock that uses the given parameters to define behaviour
// The url is req:<status>/<payload>/<resolve time in ms>
const uri_regex = /^req:(\d{3})\/([^\/]+)\/(\d{1,})$/;
global.fetch = function fake_fetch(resource, options) {
    const m = uri_regex.exec(resource);
    const status = parseInt(m[1]);
    const body = m[2];
    const sleep_ms = parseInt(m[3]);

    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (status === 999) {
                reject(new Error(body));
            } else {
                resolve({
                    body,
                    status,
                    ok: status >= 200 && status <= 299,
                    type: 'basic',
                    url: resource
                });
            }
        }, sleep_ms);
    });
}

function Timer() {
    const start = new Date();
    const response_summaries = [];

    this.add = function(result) {
        // Figure out the number of ms since start, and then round to the closest 100ms
        const duration = Date.now() - start;
        const rounded = Math.round(duration / 100) * 100;
        response_summaries.push(`res:${result.response.status}/${result.response.body}/${rounded.toFixed(0)}`);
    };

    this.validate = function(expected) {
        if (typeof(expected) === 'string' && response_summaries.length === 1) {
            expect(response_summaries[0]).to.equal(expected);
        } else {
            expect(response_summaries).to.have.members(expected);
        }
    };
}

beforeEach(function () {
    this.currentTest.response_timer = new Timer();
});

describe('one (basic)', function() {
    this.timeout(10000);
    this.slow(5000);

    it('should execute one fetch', async function() {
        const conn = new Connection();
        this.test.response_timer.add(await conn.one('req:200/moop1/500'));
        this.test.response_timer.validate('res:200/moop1/500');
    });

    it('should execute two fetches serially', async function() {
        const conn = new Connection();
        this.test.response_timer.add(await conn.one('req:200/moop1/600'));
        this.test.response_timer.add(await conn.one('req:200/moop2/400'));

        this.test.response_timer.validate([
            'res:200/moop1/600',
            'res:200/moop2/1000'
        ]);
    });

    it('should execute five fetches serially', async function() {
        const conn = new Connection();
        this.test.response_timer.add(await conn.one('req:200/moop1/300'));
        this.test.response_timer.add(await conn.one('req:200/moop2/300'));
        this.test.response_timer.add(await conn.one('req:200/moop3/300'));
        this.test.response_timer.add(await conn.one('req:200/moop4/200'));
        this.test.response_timer.add(await conn.one('req:200/moop5/400'));

        this.test.response_timer.validate([
            'res:200/moop1/300',
            'res:200/moop2/600',
            'res:200/moop3/900',
            'res:200/moop4/1100',
            'res:200/moop5/1500'
        ]);
    });
});

describe('swarm (basic)', function() {
    this.timeout(10000);
    this.slow(5000);

    it('should execute a swarm of zero', async function() {
        const conn = new Connection();
        for await (const response of conn.swarm([])) {
            expect.fail();
        }
    });

    it('should execute a swarm of one', async function() {
        const conn = new Connection();
        for await (const response of conn.swarm([ 'req:200/moop1/300' ])) {
            this.test.response_timer.add(response);
        }
        this.test.response_timer.validate([ 'res:200/moop1/300' ]);
    });

    it('should execute a swarm of two concurrently', async function() {
        const conn = new Connection();
        for await (const response of conn.swarm([ 'req:200/moop1/300', 'req:200/moop2/400' ])) {
            this.test.response_timer.add(response);
        }
        this.test.response_timer.validate([ 'res:200/moop1/300', 'res:200/moop2/400' ]);
    });

    it('should execute a swarm of five semi-concurrently', async function() {
        const conn = new Connection();
        for await (const response of conn.swarm([ 'req:200/moop1/700', 'req:200/moop2/300', 'req:200/moop3/300', 'req:200/moop4/500', 'req:200/moop5/200' ])) {
            this.test.response_timer.add(response);
        }
        this.test.response_timer.validate([ 'res:200/moop1/700', 'res:200/moop2/300', 'res:200/moop3/600', 'res:200/moop4/1100', 'res:200/moop5/900' ]);
    });
});