import assert from 'node:assert/strict'

export function Connection (options) {
  this._options = Object.assign({
    concurrency: 2,
    min_ms_between_requests: 0,
    timeout_ms: 0,
    retry: false
  }, options)

  const inflight = new Map()

  this.swarm = async function * (requests, maintainOrder = false) {
    const it = requests[Symbol.iterator]()
    let req = { done: false }
    let res

    while (true) {
      if (!req.done) {
        req = await it.next()
        if (!req.done) {
          const p = bundle(req.value)
          inflight.set(p._id, p)
        }
      }

      if (inflight.size === 0) {
        if (res) yield res
        return
      } else if (inflight.size === this._options.concurrency || req.done) {
        if (res) yield res
        res = await Promise.race(inflight.values())
        inflight.delete(res._id)
      }
    }
  }

  this.one = async function (request) {
    const it = this.swarm([request])
    const res = await it.next()
    assert.ok((await it.next()).done)
    return res.value
  }

  let unique = 1
  function bundle (request) {
    // We need to generate a unique id for each fetch,
    // and add it to the promise and whatever is fulfilled
    // so we can bookkeep appropriately.
    const _id = unique++
    if (unique === Number.MAX_SAFE_INTEGER) unique = 1 // Pretty safe assumption

    // Bundle a fetch with any given data and a unique id
    const p = new Promise((resolve, reject) => {
      fetch(request)
        .then((response) => {
          resolve({
            _id,
            request,
            response
          })
        })
        .catch((err) => {
          err._id = _id
          err.request = request
          reject(err)
        })
    })
    p._id = _id

    return p
  }
}
