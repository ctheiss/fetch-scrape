# fetch-swarm

A no-dependency wrapper to global fetch that adds concurrency and significant performance gains. This library is tuned for hitting a server many times and is dead-simple to use.

<p align="center">
  <a href="https://htmlpreview.github.io/?https://raw.githubusercontent.com/ctheiss/fetch-swarm/main/build/tests/mochawesome.html"><img alt="Test report" src="https://raw.githubusercontent.com/ctheiss/fetch-swarm/main/build/tests.svg"></a>
  <a href="https://htmlpreview.github.io/?https://raw.githubusercontent.com/ctheiss/fetch-swarm/main/build/coverage/index.html"><img alt="Coverage report" src="https://raw.githubusercontent.com/ctheiss/fetch-swarm/main/build/coverage.svg"></a>
  <a href="https://standardjs.com"><img alt="JavaScript Style Guide" src="https://raw.githubusercontent.com/ctheiss/fetch-swarm/main/build/style.svg"></a>
  <a href="https://nodejs.org/dist/latest-v18.x/docs/api/globals.html#fetch"><img alt="Node.js v18.x docs" src="https://raw.githubusercontent.com/ctheiss/fetch-swarm/main/build/node.svg"></a>
</p>

## Features

*   Request throttling
*   Automatic retry on failure
*   Lazy loading and minimal object caching to keep the memory footprint to a minimum
*   No implementation leaks, it just works as expected!

## Usage

Use **npm** to install: `npm install fetch-swarm`

```js
import { Connection } from 'fetch-swarm'

// Creates a session and thread pool; typically you create one connection for each server you're hitting.
const conn = Connection.create()

// Executes a single fetch
const loginResponse = await conn.one('http://cat-videos.net/login?user=fanatic&password=c4tl0v3r')

// Session information is maintained across fetches in the same connection,
// so subsequent fetches will still be logged-in.
const profileUrls = [
 'http://cat-videos.net/profile/mookie',
 'http://cat-videos.net/profile/kenneth',
 'http://cat-videos.net/profile/itchy']

// Asynchronously execute fetches for all profile pages.
// The order is not guaranteed, so you wait only until the first fetch is complete.
for await (const profileResponse of conn.swarm(profileUrls)) {
 // Asynchronously execute fetches for each friend link found on the profile pages.
 // These fetches take precedence over those in the outer loop to minimize overall waiting.
 // Order *does* matter now, so specify that in the options.  Obviously, there may be a small
 // performance hit if the second profile fetch is done but we're still waiting on the first.
 for await (const friendResponse of conn.swarm(profileResponse.friendUrls, { ordered: true })) {
   // Do something intelligent with the responses, like using
   // regex to parse the HTML (see http://stackoverflow.com/a/1732454)
   friendResponse.html.parse()
 }
}
```

<p align="center">
  For more details, please see the documentation for the full <a href="https://htmlpreview.github.io/?https://raw.githubusercontent.com/ctheiss/fetch-swarm/main/build/docs/index.html">API</a>.
</p>