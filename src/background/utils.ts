import { Config } from '../config.js'

async function _getAuth(): Promise<string> {
  return Config.auth()
}
let getAuthPromise: Promise<string> | null = null
export async function getAuth() {
  if (!getAuthPromise) {
    getAuthPromise = _getAuth().finally(() => {
      getAuthPromise = null
    })
  }
  return getAuthPromise
}

export async function tryDo({
  handler,
  interval,
  timeout,
}: {
  handler: () => never | Promise<void | never>
  interval: number
  timeout: number
}) {
  if (typeof timeout !== 'number') {
    throw new Error('timeout必须为数字类型')
  }
  try {
    return await handler()
  } catch (e) {
    if (timeout > 0) {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(
            tryDo({
              handler,
              interval,
              timeout: timeout - interval,
            })
          )
        }, interval)
      })
    } else {
      throw e
    }
  }
}
