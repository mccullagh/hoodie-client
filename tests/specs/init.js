var _ = require('lodash')
var simple = require('simple-mock')
var test = require('tape')

var init = require('../../lib/init')
var getApi = require('../../lib/get-api')
var getState = require('../../lib/get-state')

function findEventHandler (calls, name) {
  var call = _.find(calls, function (call) {
    return call.args[0] === name
  })

  return _.last(call.args)
}

test('"reset" triggered on "signin"', function (t) {
  t.plan(8)

  var signInTestOrder = []
  var existingObjects = [{id: 'foo', createdBy: 'accountid1'}]
  var hoodie = {
    account: {
      id: 'accountid1',
      on: simple.stub(),
      isSignedIn: simple.stub()
    },
    store: {
      findAll: function () {
        return Promise.resolve(existingObjects)
      },
      add: function (objects) {
        t.deepEqual(objects, existingObjects, 'adding existing objects after sign in')
        return Promise.resolve(existingObjects)
      },
      connect: function () {
        t.pass('store.connect is called on "post:signin"')
        signInTestOrder.push('connect')
      },
      reset: function (options) {
        t.isNot(typeof options, 'undefined', 'store.reset options are defined')
        t.isNot(typeof options.name, 'undefined', 'store.reset options has defined name')
        t.pass('store.reset called on "post:signin"')
        signInTestOrder.push('reset')

        return Promise.resolve()
      }
    },
    connectionStatus: {
      on: simple.stub()
    }
  }

  init(hoodie)

  var preSignInHandler = findEventHandler(hoodie.account.on.calls, 'pre:signin')
  var postSignInHandler = findEventHandler(hoodie.account.on.calls, 'post:signin')

  var preHooks = []
  preSignInHandler({hooks: preHooks})

  var postHooks = []
  postSignInHandler({hooks: postHooks})

  t.is(preHooks.length, 1, 'one pre:signin hook registered')
  t.is(postHooks.length, 1, 'one post:signin hook registered')
  preHooks[0]().then(function () {
    // simulate new account.id
    hoodie.account.id = 'accountid2'
  })

  .then(postHooks[0])

  .then(function () {
    t.deepEqual(signInTestOrder, ['reset', 'connect'], 'store.connect was called after store.reset')
  })

  .catch(t.error)
})

test('is "reset" triggered on "post:signout"', function (t) {
  t.plan(4)

  var hoodie = {
    account: {
      id: 0,
      on: simple.stub(),
      isSignedIn: simple.stub()
    },
    store: {
      reset: function (options) {
        t.isNot(typeof options, 'undefined', 'store.reset options are defined')
        t.isNot(typeof options.name, 'undefined', 'store.reset options has defined name')
        t.pass('store.reset called on "signout"')
      }
    },
    connectionStatus: {
      on: simple.stub()
    }
  }

  init(hoodie)
  var signOutHandler = findEventHandler(hoodie.account.on.calls, 'post:signout')
  var hooks = []
  signOutHandler({hooks: hooks})
  t.is(hooks.length, 1, 'one post:signout hook registered')
  hooks[0]()
})

test('"hoodie.store.connect()" is called when "hoodie.account.isSignedIn()" returns "true" ', function (t) {
  t.plan(1)

  var hoodie = {
    account: {
      id: 0,
      on: simple.stub(),
      isSignedIn: simple.stub().returnWith(true)
    },
    store: {
      connect: simple.stub(),
      reset: simple.stub()
    },
    connectionStatus: {
      on: simple.stub()
    }
  }

  init(hoodie)
  t.is(hoodie.store.connect.callCount, 1, 'calls hoodie account.connect once')
})

test('"hoodie.store.connect()" is *not* called when "hoodie.account.isSignedIn()" returns "false"', function (t) {
  t.plan(1)

  var hoodie = {
    account: {
      id: 0,
      on: simple.stub(),
      isSignedIn: simple.stub().returnWith(false)
    },
    store: {
      connect: simple.stub(),
      reset: simple.stub()
    },
    connectionStatus: {
      on: simple.stub()
    }
  }

  init(hoodie)
  t.is(hoodie.store.connect.callCount, 0, 'does not hoodie account.connect')
})

test('hoodie.store gets initialized with options.ajax', function (t) {
  t.plan(1)

  var CustomStoreMock = simple.stub()
  simple.mock(getApi.internals, 'Account', function () {
    return {
      get: function (path) {
        return {
          id: path + '123'
        }
      }
    }
  })
  simple.mock(getApi.internals, 'Store', {
    defaults: function () { return CustomStoreMock }
  })

  var state = getState()
  getApi(state)

  var storeAjaxParam = CustomStoreMock.lastCall.args[1]
  t.is(storeAjaxParam.ajax().headers.authorization, 'Bearer session123',
    'sets ajax authorization header')
})

test('hoodie.store initialization without session', function (t) {
  t.plan(1)

  var CustomStoreMock = simple.stub()
  simple.mock(getApi.internals, 'Account', function () {
    return {
      get: function (path) {
        return undefined
      }
    }
  })
  simple.mock(getApi.internals, 'Store', {
    defaults: function () { return CustomStoreMock }
  })

  var state = getState()
  getApi(state)

  var storeAjaxParam = CustomStoreMock.lastCall.args[1]
  t.is(storeAjaxParam.ajax(), undefined, 'no authorization header without session')
})
