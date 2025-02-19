let { SyncError } = require('@logux/core')
let bunyan = require('bunyan')

let createReporter = require('../create-reporter')
let HumanFormatter = require('../human-formatter')

class MemoryStream {
  constructor () {
    this.string = ''
  }
  write (chunk) {
    this.string += chunk
  }
}

function clean (str) {
  return str
    .replace(/\r\v/g, '\n')
    .replace(/\d{4}-\d\d-\d\d \d\d:\d\d:\d\d/g, '1970-01-01 00:00:00')
    .replace(/"time":"[^"]+"/g, '"time":"1970-01-01T00:00:00.000Z"')
    .replace(/"hostname":"[^"]+"/g, '"hostname":"localhost"')
}

function check (type, details) {
  let json = new MemoryStream()
  let jsonReporter = createReporter({
    bunyan: bunyan.createLogger({ name: 'test', pid: 21384, stream: json })
  })

  jsonReporter(type, details)
  expect(clean(json.string)).toMatchSnapshot()

  let human = new MemoryStream()
  let humanReporter = createReporter({
    bunyan: bunyan.createLogger({
      pid: 21384,
      name: 'test',
      streams: [
        {
          type: 'raw',
          stream: new HumanFormatter({
            basepath: '/dev/app', color: true, out: human
          })
        }
      ]
    })
  })

  humanReporter(type, details)
  expect(clean(human.string)).toMatchSnapshot()
}

function createError (name, message) {
  let err = new Error(message)
  err.name = name
  err.stack =
    `${ name }: ${ message }\n` +
    `    at Object.<anonymous> (/dev/app/index.js:28:13)\n` +
    `    at Module._compile (module.js:573:32)\n` +
    `    at at runTest (/dev/app/node_modules/jest/index.js:50:10)\n` +
    `    at process._tickCallback (internal/process/next_tick.js:103:7)`
  return err
}

let originEnv = process.env.NODE_ENV
afterEach(() => {
  process.env.NODE_ENV = originEnv
})

it('uses passed bunyan instance', () => {
  let logger = bunyan.createLogger({ name: 'test' })
  let reporter = createReporter({ bunyan: logger })
  expect(reporter.logger).toEqual(logger)
})

it('creates JSON reporter', () => {
  let logger = bunyan.createLogger({ name: 'test' })
  let reporter = createReporter({ reporter: 'json' })
  expect(reporter.logger.streams).toEqual(logger.streams)
})

it('creates human reporter', () => {
  let reporter = createReporter({ reporter: 'human', root: '/dir/' })
  expect(reporter.logger.streams).toHaveLength(1)
  let stream = reporter.logger.streams[0].stream
  expect(stream instanceof HumanFormatter).toBeTruthy()
  expect(stream.basepath).toEqual('/dir/')
  expect(stream.chalk.enabled).toBeFalsy()
})

it('adds trailing slash to path', () => {
  let reporter = createReporter({ reporter: 'human', root: '/dir' })
  expect(reporter.logger.streams[0].stream.basepath).toEqual('/dir/')
})

it('uses color in development', () => {
  let reporter = createReporter({ env: 'development', reporter: 'human' })
  expect(reporter.logger.streams[0].stream.chalk.enabled).toBeTruthy()
})

it('uses colors by default', () => {
  delete process.env.NODE_ENV
  let reporter = createReporter({ reporter: 'human' })
  expect(reporter.logger.streams[0].stream.chalk.enabled).toBeTruthy()
})

it('uses environment variable to detect environment', () => {
  process.env.NODE_ENV = 'production'
  let reporter = createReporter({ reporter: 'human' })
  expect(reporter.logger.streams[0].stream.chalk.enabled).toBeFalsy()
})

it('reports listen', () => {
  check('listen', {
    controlPassword: 'RhBaK0kuOBtqJalq2C4df',
    controlHost: '127.0.0.1',
    controlPort: 31338,
    loguxServer: '0.0.0',
    environment: 'development',
    subprotocol: '0.0.0',
    supports: '0.x',
    backend: 'http://127.0.0.1:3000/logux',
    nodeId: 'server:FnXaqDxY',
    server: false,
    cert: false,
    host: '127.0.0.1',
    port: 31337
  })
})

it('reports listen for production', () => {
  check('listen', {
    controlPassword: 'RhBaK0kuOBtqJalq2C4df',
    controlHost: '127.0.0.1',
    controlPort: 31338,
    loguxServer: '0.0.0',
    environment: 'production',
    subprotocol: '0.0.0',
    supports: '0.x',
    nodeId: 'server:FnXaqDxY',
    server: false,
    cert: true,
    host: '127.0.0.1',
    port: 31337
  })
})

it('reports listen for custom domain', () => {
  check('listen', {
    controlHost: '127.0.0.1',
    controlPort: 31338,
    loguxServer: '0.0.0',
    environment: 'development',
    subprotocol: '0.0.0',
    supports: '0.x',
    nodeId: 'server:FnXaqDxY',
    server: true
  })
})

it('reports connect', () => {
  check('connect', { connectionId: '670', ipAddress: '10.110.6.56' })
})

it('reports authenticated', () => {
  check('authenticated', {
    connectionId: '670',
    subprotocol: '1.0.0',
    nodeId: 'admin:100:uImkcF4z'
  })
})

it('reports authenticated without user ID', () => {
  check('authenticated', {
    connectionId: '670',
    subprotocol: '1.0.0',
    nodeId: 'uImkcF4z'
  })
})

it('reports unauthenticated', () => {
  check('unauthenticated', {
    connectionId: '670',
    subprotocol: '1.0.0',
    nodeId: '100:uImkcF4z'
  })
})

it('reports add', () => {
  check('add', {
    action: {
      type: 'CHANGE_USER',
      id: 100,
      data: {
        name: 'John',
        role: null,
        array: [1, [2], { a: '1', b: { c: 2 }, d: [], e: null }, null]
      }
    },
    meta: {
      id: '1487805099387 100:uImkcF4z 0',
      time: 1487805099387,
      reasons: ['lastValue', 'debug'],
      server: 'server:H1f8LAyzl',
      subprotocol: '1.0.0'
    }
  })
})

it('reports clean', () => {
  check('clean', {
    actionId: '1487805099387 100:uImkcF4z 0'
  })
})

it('reports denied', () => {
  check('denied', {
    actionId: '1487805099387 100:uImkcF4z 0'
  })
})

it('reports unknownType', () => {
  check('unknownType', {
    type: 'CHANGE_SER', actionId: '1487805099387 100:uImkcF4z 0'
  })
})

it('reports unknownType from server', () => {
  check('unknownType', {
    type: 'CHANGE_SER',
    actionId: '1487805099387 server:FnXaqDxY 0'
  })
})

it('reports wrongChannel', () => {
  check('wrongChannel', {
    actionId: '1487805099387 100:uImkcF4z 0',
    channel: 'ser/100'
  })
})

it('reports wrongChannel without name', () => {
  check('wrongChannel', {
    channel: undefined, actionId: '1487805099387 100:uImkcF4z 0'
  })
})

it('reports processed', () => {
  check('processed', {
    actionId: '1487805099387 100:uImkcF4z 0', latency: 500
  })
})

it('reports subscribed', () => {
  check('subscribed', {
    channel: 'user/100', actionId: '1487805099387 100:uImkcF4z 0'
  })
})

it('reports unsubscribed', () => {
  check('unsubscribed', {
    channel: 'user/100', actionId: '1487805099387 100:uImkcF4z 0'
  })
})

it('reports disconnect', () => {
  check('disconnect', { nodeId: '100:uImkcF4z' })
})

it('reports disconnect from unauthenticated user', () => {
  check('disconnect', { connectionId: '670' })
})

it('reports zombie', () => {
  check('zombie', { nodeId: '100:uImkcF4z' })
})

it('reports destroy', () => {
  check('destroy')
})

it('reports EACCES error', () => {
  check('error', { fatal: true, err: { code: 'EACCES', port: 80 } })
})

it('reports EADDRINUSE error', () => {
  check('error', { fatal: true, err: { code: 'EADDRINUSE', port: 31337 } })
})

it('reports LOGUX_UNKNOWN_OPTION error', () => {
  let err = {
    message: 'Unknown option `suprotocol` in server constructor',
    option: 'suprotocol',
    code: 'LOGUX_UNKNOWN_OPTION'
  }
  check('error', { fatal: true, err })
})

it('reports LOGUX_WRONG_OPTIONS error', () => {
  let err = {
    code: 'LOGUX_WRONG_OPTIONS',
    message: 'Missed client subprotocol requirements'
  }
  check('error', { fatal: true, err })
})

it('reports LOGUX_NO_CONTROL_PASSWORD error', () => {
  let err = {
    code: 'LOGUX_NO_CONTROL_PASSWORD',
    message: '`backend` requires also `controlPassword` option'
  }
  check('error', { fatal: true, err })
})

it('reports error', () => {
  check('error', { fatal: true, err: createError('Error', 'Some mistake') })
})

it('reports error from action', () => {
  check('error', {
    actionId: '1487805099387 100:uImkcF4z 0',
    err: createError('Error', 'Some mistake')
  })
})

it('reports sync error', () => {
  let err = new SyncError('unknown-message', 'bad', true)
  check('error', { connectionId: '670', err })
})

it('reports error from client', () => {
  let err = new SyncError('timeout', 5000, true)
  check('clientError', { connectionId: '670', err })
})

it('reports error from node', () => {
  let err = new SyncError('timeout', 5000, false)
  check('clientError', { nodeId: '100:uImkcF4z', err })
})

it('reports useless actions', () => {
  check('useless', {
    action: {
      type: 'ADD_USER',
      id: 100,
      name: 'John'
    },
    meta: {
      id: '1487805099387 100:uImkcF4z 0',
      time: 1487805099387,
      reasons: [],
      server: 'server:H1f8LAyzl',
      subprotocol: '1.0.0'
    }
  })
})
