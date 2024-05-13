import assert from 'node:assert/strict'

/**
 * Typically you create one connection for each server you're hitting. This object maintains session information, connection pools, fetch priorities, etc.
 * @class
 */
export class Connection {
  static #privacy = Symbol('ensure constructor is private')

  // Define defaults
  #concurrency = 2
  #minMsBetweenRequests = 150
  #timeoutMs = 0
  #retry = 0

  /** @ignore */
  constructor (options, token) {
    if (token !== Connection.#privacy) {
      throw new TypeError('The constructor is not intended to be used; use Connection.create instead')
    }

    this.#concurrency = options?.concurrency ?? this.#concurrency
    this.#minMsBetweenRequests = options?.minMsBetweenRequests ?? this.#minMsBetweenRequests
    this.#timeoutMs = options?.timeoutMs ?? this.#timeoutMs
    this.#retry = options?.retry ?? this.#retry
  }

  /**
   * Create a new connection.
   * 
   * @param {Object} options
   * @param {number} [options.concurrency=2] - The maximum number of concurrent fetches
   * @param {number} [options.minMsBetweenRequests=150] - Every fetch is guaranteed to be separated by at least this many milliseconds (counting from start to start)
   * @param {number} [options.timeoutMs=0] - Stop and fail a fetch if it has not completed after this many milliseconds; timed-out fetched may be retried depending on the other options (0 means no timeout)
   * @param {number} [options.retry=0] - Retry failed fetches this many times before throwing an error; note that (per spec) HTTP failures such as 4xx or 5xx *do not* count as failed fetches
   */
  static async create (options) {
    return new this(options, Connection.#privacy)
  }

  get concurrency () {
    return this.#concurrency
  }

  get minMsBetweenRequests () {
    return this.#minMsBetweenRequests
  }

  get timeoutMs () {
    return this.#timeoutMs
  }

  get retry () {
    return this.#retry
  }

  #inflight = new Map()
  #unique = 1

  /**
   * Execute each request asynchronously.
   * 
   * Subsequent calls to swarm() or one() on the same Connection will be prioritized over earlier calls. This is generally aligned with how fetches are processed (one fetch is inspected, which leads to more fetches whose responses are inspected… etc.)
   * 
   * This function will try hard to finish all fetches, use stop to cancel any pending fetches and/or kill executing fetches.
   * 
   * @param {iterable} requests
   * @param {Object} options
   * @param {boolean} [options.ordered=false] - Whether the responses are guaranteed to be in the same order as the requests
   */
  async * swarm (requests, options) {
    const it = requests[Symbol.iterator]()
    let req = { done: false }
    let res

    while (true) {
      if (!req.done) {
        req = await it.next()
        if (!req.done) {
          const p = this.#bundle(req.value)
          this.#inflight.set(p._id, p)
        }
      }

      if (this.#inflight.size === 0) {
        if (res) yield res
        return
      } else if (this.#inflight.size === this.#concurrency || req.done) {
        if (res) yield res
        res = await Promise.race(this.#inflight.values())
        this.#inflight.delete(res._id)
      }
    }
  }

  async one (request) {
    const it = this.swarm([request])
    const res = await it.next()
    assert.ok((await it.next()).done)
    return res.value
  }

  #bundle (request) {
    // We need to generate a unique id for each fetch,
    // and add it to the promise and whatever is fulfilled
    // so we can bookkeep appropriately.
    const _id = this.#unique++

    /* c8 ignore next */
    if (this.#unique === Number.MAX_SAFE_INTEGER) this.#unique = 1 // Pretty safe assumption

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
