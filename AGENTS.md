# AGENTS.md

This repo is an Ocean.xyz pool worker for MDK. It is not a miner controller.

## What runs where

- `mdk-contract.json` is the package index. `WorkerRuntimeV2` loads this directory.
- `src/client.js` polls `https://api.ocean.xyz` for the usernames in device `opts.accounts`.
- `src/telemetry/*.js` is one handler per declared channel. There are no commands.
- DATUM is optional. Set `opts.datumApiUrl`. Put `DATUM_USER` and `DATUM_PASSWORD` in worker `env`, never in the UI.
- `examples/ui/index.html` is a read-only dashboard. It calls the public Ocean API from the browser. It does not talk to the Kernel.

The Kernel does not import this package. A host process constructs `WorkerRuntimeV2` on this directory and registers the runtime key.

## Run the worker

Node `>=24`. `@tetherto/mdk` is a dev dependency because `@tetherto/mdk-worker` is not on npm.

```bash
npm install
npm test
```

Host against the live pool:

```js
const { WorkerRuntimeV2 } = require('@tetherto/mdk/backend/core/mdk-worker')

const runtime = new WorkerRuntimeV2('/path/to/mdk-wrk-minerpool-ocean', {
  workerId: 'ocean-home',
  devices: [{
    deviceId: 'ocean-home',
    config: {
      apiUrl: 'https://api.ocean.xyz',
      accounts: ['bc1q0sql9hyh0dg8r6ggmaknhl2tuhe8pvzkvtdlp2'],
      apiRetry: 1
    }
  }]
})
await runtime.start()
```

Same-machine Kernel, local discovery:

```js
const { getKernel } = require('@tetherto/mdk/backend/core/mdk')
const kernel = await getKernel({ root: process.env.HOME + '/.mdk-ocean', discovery: { mode: 'local' } })
await kernel.registerWorker(runtime.getPublicKey())
```

An inactive Ocean username does not crash the worker. Hashrate and worker count stay `0`. Monthly earnings still load.

Pull one channel:

```js
runtime.handleRequest({
  action: 'telemetry.pull',
  deviceId: 'ocean-home',
  payload: { query: { type: 'hashrate' } }
})
```

History channels require `start` and `end` in milliseconds. Missing either one is `ERR_START_INVALID` or `ERR_END_INVALID`.

## Dashboard

The browser dashboard is not part of this package. It called `api.ocean.xyz` directly and did not use the worker. A UI that reads this worker belongs behind the MDK Gateway, in a separate change.

## Do not

- Do not put DATUM or Bitcoin RPC passwords in telemetry. `health` returns status and alert names only. `datum_config` strips `rpcuser`, `rpcpassword`, `password`, `token`, and `secret`.
- Do not boot this through `worker.js` or `TetherWrkBase`. That MiningOS path was removed.
- Do not expect the MDK site Pools page to work unchanged. It still pulls `ext_data`. This worker serves `stats` and `stats_history`.
