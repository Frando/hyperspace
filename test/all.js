const test = require('tape')
const tmp = require('tmp-promise')
const hypertrie = require('hypertrie')
const RemoteCorestore = require('../client')
const HyperspaceServer = require('../server')

test('can open a core', async t => {
  const { store, server, cleanup } = await create()

  const core = store.get()
  await core.ready()

  t.same(core.byteLength, 0)
  t.same(core.length, 0)
  t.same(core.key.length, 32)
  t.same(core.discoveryKey.length, 32)

  await cleanup()
  t.end()
})

test('can get a block', async t => {
  const { server, store, cleanup } = await create()

  const core = store.get()
  await core.ready()

  await core.append(Buffer.from('hello world', 'utf8'))
  const block = await core.get(0)
  t.same(block.toString('utf8'), 'hello world')

  await cleanup()
  t.end()
})

test('length/byteLength update correctly on append', async t => {
  const { server, store, cleanup } = await create()

  const core = store.get()
  await core.ready()

  let appendedCount = 0
  core.on('append', () => {
    appendedCount++
  })

  const buf = Buffer.from('hello world', 'utf8')
  let seq = await core.append(buf)
  t.same(seq, 0)
  t.same(core.byteLength, buf.length)
  t.same(core.length, 1)

  seq = await core.append([buf, buf])
  t.same(seq, 1)
  t.same(core.byteLength, buf.length * 3)
  t.same(core.length, 3)

  t.same(appendedCount, 2)

  await cleanup()
  t.end()
})

test('update with current length returns', async t => {
  const { server, store, cleanup } = await create()

  const core = store.get()
  await core.ready()

  const buf = Buffer.from('hello world', 'utf8')
  let seq = await core.append(buf)
  t.same(seq, 0)
  t.same(core.byteLength, buf.length)
  t.same(core.length, 1)

  await core.update(1)
  t.pass('update terminated')

  try {
    await core.update({ ifAvailable: true })
    t.fail('should not get here')
  } catch (err) {
    t.true(err, 'should error with no peers')
  }

  await cleanup()
  t.end()
})

test('seek works correctly', async t => {
  const { server, store, cleanup } = await create()

  const core = store.get()
  await core.ready()

  const buf = Buffer.from('hello world', 'utf8')
  await core.append([buf, buf])

  {
    let { seq, blockOffset } = await core.seek(0)
    t.same(seq, 0)
    t.same(blockOffset, 0)
  }

  {
    let { seq, blockOffset } = await core.seek(5)
    t.same(seq, 0)
    t.same(blockOffset, 5)
  }

  {
    let { seq, blockOffset } = await core.seek(15)
    t.same(seq, 1)
    t.same(blockOffset, 4)
  }

  await cleanup()
  t.end()
})

test('has works correctly', async t => {
  const { server, store, cleanup } = await create()

  const core = store.get()
  await core.ready()

  const buf = Buffer.from('hello world', 'utf8')
  let seq = await core.append(buf)

  const doesHave = await core.has(0)
  const doesNotHave = await core.has(1)
  t.true(doesHave)
  t.false(doesNotHave)

  await core.close()
  await cleanup()
  t.end()
})

test('corestore default get works', async t => {
  const { server, store, cleanup } = await create()

  const ns1 = store.namespace('blah')
  const ns2 = store.namespace('blah2')

  var core = ns1.default()
  await core.ready()

  const buf = Buffer.from('hello world', 'utf8')
  await core.append(buf)

  await core.close()

  core = ns1.default()
  await core.ready()

  t.same(core.length, 1)
  t.true(core.writable)

  core = ns2.default()
  await core.ready()
  t.same(core.length, 0)

  await cleanup()
  t.end()
})

test('can run a hypertrie on remote hypercore', async t => {
  const { server, store, cleanup } = await create()

  await cleanup()
  t.end()
})

async function create () {
  const tmpDir = await tmp.dir({ unsafeCleanup: true })
  const server = new HyperspaceServer({ storage: tmpDir.path })
  await server.ready()

  const store = new RemoteCorestore()
  await store.ready()

  const cleanup = () => Promise.all([
    tmpDir.cleanup(),
    server.close(),
    store.close()
  ])

  return { server, store, cleanup }
}
