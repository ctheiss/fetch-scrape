import { Connection } from '../index.js'

import { expect } from 'chai'

describe('real-world (httpbin)', function () {
  beforeEach(function () {
    this.currentTest.startTime = Date.now()
  })

  describe.skip('fetch', function () {
    this.timeout(10000)
    this.slow(5500)

    it('should call a test site 4 times sequentially', async function () {
      for (let i = 0; i < 4; i++) {
        const res = await fetch('https://httpbin.org/delay/1')
        expect(res.statusText).to.equal('OK')
      }
      const duration = Date.now() - this.test.startTime
      expect(duration).to.be.within(4000, 6000)
    })
  })

  describe.skip('one (basic)', function () {
    this.timeout(10000)
    this.slow(5500)

    it.skip('should execute four fetches serially', async function () {
      const conn = await Connection.create()
      for (let i = 0; i < 4; i++) {
        const res = await conn.one('https://httpbin.org/delay/1')
        expect(res.response.statusText).to.equal('OK')
      }
      const duration = Date.now() - this.test.startTime
      expect(duration).to.be.within(4000, 6000)
    })

    it.skip('should handle many redirects', async function () {
      const conn = await Connection.create()
      const res = await conn.one('https://httpbin.org/redirect/6')
      expect(res.response.statusText).to.equal('OK')
      const duration = Date.now() - this.test.startTime
      expect(duration).to.be.below(1000)
    })

    it('should maintain a session via cookies', async function () {
      const conn = await Connection.create()
      const res = await conn.one('https://httpbin.org/cookies/set/king/cole')
      console.dir(await res.response.json())
      expect(res.response.statusText).to.equal('OK')
      const duration = Date.now() - this.test.startTime
      expect(duration).to.be.below(1000)
    })
  })
})

/*
describe('swarm (real-world)', function () {
  it('should create a connection with default values', async function () {
    const conn = await Connection.create()
    expect(conn.concurrency).to.equal(2)
    expect(conn.minMsBetweenRequests).to.equal(150)
    expect(conn.timeoutMs).to.equal(0)
    expect(conn.retry).to.equal(0)
  })

  it('should create a connection with given parameters', async function () {
    const conn = await Connection.create({
      concurrency: 3,
      minMsBetweenRequests: 100,
      timeoutMs: 5000,
      retry: 2
    })
    expect(conn.concurrency).to.equal(3)
    expect(conn.minMsBetweenRequests).to.equal(100)
    expect(conn.timeoutMs).to.equal(5000)
    expect(conn.retry).to.equal(2)
  })

  it('should not be possible to instantiate via new', async function () {
    try {
      const conn = new Connection()
      expect.fail(conn)
    } catch (err) {
      expect(err).to.be.a('error').with.property('message', 'The constructor is not intended to be used; use Connection.create instead')
    }
  })

  it('should not be possible change parameters after creation', async function () {
    const conn = await Connection.create()

    try {
      conn.concurrency = 2
      expect.fail()
    } catch (err) {}

    try {
      conn.minMsBetweenRequests = 2
      expect.fail()
    } catch (err) {}

    try {
      conn.timeoutMs = 2
      expect.fail()
    } catch (err) {}

    try {
      conn.retry = 2
      expect.fail()
    } catch (err) {}
  })
})

describe('one (basic)', function () {
  this.timeout(10000)
  this.slow(5000)

  it('should execute one fetch', async function () {
    const conn = await Connection.create()
    this.test.response_timer.add(await conn.one('req:200/moop1/500'))
    this.test.response_timer.validate('res:200/moop1/500')
  })

  it('should execute two fetches serially', async function () {
    const conn = await Connection.create()
    this.test.response_timer.add(await conn.one('req:200/moop1/600'))
    this.test.response_timer.add(await conn.one('req:200/moop2/400'))

    this.test.response_timer.validate([
      'res:200/moop1/600',
      'res:200/moop2/1000'
    ])
  })

  it('should execute five fetches serially', async function () {
    const conn = await Connection.create()
    this.test.response_timer.add(await conn.one('req:200/moop1/300'))
    this.test.response_timer.add(await conn.one('req:200/moop2/300'))
    this.test.response_timer.add(await conn.one('req:200/moop3/300'))
    this.test.response_timer.add(await conn.one('req:200/moop4/200'))
    this.test.response_timer.add(await conn.one('req:200/moop5/400'))

    this.test.response_timer.validate([
      'res:200/moop1/300',
      'res:200/moop2/600',
      'res:200/moop3/900',
      'res:200/moop4/1100',
      'res:200/moop5/1500'
    ])
  })

  it('should handle a network error', async function () {
    const conn = await Connection.create()
    try {
      await conn.one('req:999/moop1/300')
      expect.fail()
    } catch (err) {
      expect(err).to.be.an('error').with.property('message', 'moop1')
    }
  })
})

describe('swarm (basic)', function () {
  this.timeout(10000)
  this.slow(5000)

  it('should execute a swarm of zero', async function () {
    const conn = await Connection.create()
    for await (const response of conn.swarm([])) {
      expect.fail(response)
    }
  })

  it('should execute a swarm of one', async function () {
    const conn = await Connection.create()
    for await (const response of conn.swarm(['req:200/moop1/300'])) {
      this.test.response_timer.add(response)
    }
    this.test.response_timer.validate(['res:200/moop1/300'])
  })

  it('should execute a swarm of two concurrently', async function () {
    const conn = await Connection.create()
    for await (const response of conn.swarm(['req:200/moop1/300', 'req:200/moop2/400'])) {
      this.test.response_timer.add(response)
    }
    this.test.response_timer.validate(['res:200/moop1/300', 'res:200/moop2/400'])
  })

  it('should execute a swarm of five semi-concurrently', async function () {
    const conn = await Connection.create()
    for await (const response of conn.swarm(['req:200/moop1/700', 'req:200/moop2/300', 'req:200/moop3/300', 'req:200/moop4/500', 'req:200/moop5/200'])) {
      this.test.response_timer.add(response)
    }
    this.test.response_timer.validate(['res:200/moop1/700', 'res:200/moop2/300', 'res:200/moop3/600', 'res:200/moop4/1100', 'res:200/moop5/900'])
  })
})
*/
