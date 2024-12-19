// eslint-disable-next-line @typescript-eslint/require-await
;(async () => {
  window._callCodev8ds9v8929n2pvnb2fi3n = async function (
    code: string,
    ...args: unknown[]
  ): Promise<unknown> {
    try {
      const e = eval(code) as unknown
      if (e instanceof Function) {
        const result = (e as (...args: unknown[]) => Promise<never>)(...args)
        if (result instanceof Promise) {
          result.catch((e) => {
            return {
              _isExecuteScriptError: true,
              message: e instanceof Error ? e.message : String(e),
            }
          })
        }
        return result
      } else {
        return e as never
      }
    } catch (e: unknown) {
      return {
        _isExecuteScriptError: true,
        message: e instanceof Error ? e.message : String(e),
      }
    }
  }
})().catch((e) => {
  return {
    _isExecuteScriptError: true,
    message: e instanceof Error ? e.message : String(e),
  }
})
