import { Connection } from '../index.js'

import { expect } from 'chai'

/*
    Please note that many of these tests check the timing of mocked requests.
    Small variations are usually handled by the fact all timings are rounded to the nearest 100ms,
    but it is possible that very slow computers might be the cause of some failures.
*/

// Replace global fetch with a mock that uses the given parameters to define behaviour
// The url is req:<status>/<payload>/<resolve time in ms>
const uriRE = /^req:(\d{3})\/([^/]+)\/(\d{1,})$/
global.fetch = function fakeFetch (resource, options) {
  const m = uriRE.exec(resource)
  const status = parseInt(m[1])
  const body = m[2]
  const sleepMs = parseInt(m[3])

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (status === 999) {
        reject(new Error(body))
      } else {
        resolve({
          body,
          status,
          ok: status >= 200 && status <= 299,
          type: 'basic',
          url: resource
        })
      }
    }, sleepMs)
  })
}

function Timer () {
  const start = new Date()
  const responseSummaries = []

  this.add = function (result) {
    // Figure out the number of ms since start, and then round to the closest 100ms
    const duration = Date.now() - start
    const rounded = Math.round(duration / 100) * 100
    responseSummaries.push(`res:${result.response.status}/${result.response.body}/${rounded.toFixed(0)}`)
  }

  this.validate = function (expected) {
    if (typeof (expected) === 'string' && responseSummaries.length === 1) {
      expect(responseSummaries[0]).to.equal(expected)
    } else {
      expect(responseSummaries).to.have.members(expected)
    }
  }
}

beforeEach(function () {
  this.currentTest.response_timer = new Timer()
})

describe('connection', function () {
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
