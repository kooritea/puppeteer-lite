export interface ContextPayload {
  auxData: {
    frameId: string
    isDefault: boolean
    type: 'isolated' | 'default'
  }
  id: number
  name: string
  origin: string
  uniqueId: string
}

export class ExecutionContext {
  public contextPayloadMap: {
    [uniqueId: string]: ContextPayload
  } = {}
  constructor(public tabId: number) {}

  public async executeScript<Params extends unknown[], Result>(
    func: string | ((...args: Params) => Result),
    ...args: Params
  ): Promise<Result> {
    const contextPayload = await this.getDefaultContext()
    return this._executeScript(contextPayload, func, ...args).catch((e) => {
      console.error(e)
      throw e
    })
  }

  private _executeScript<Params extends unknown[], Result>(
    contextPayload: ContextPayload,
    func: string | ((...args: Params) => Result),
    ...args: Params
  ): Promise<Result> {
    return chrome.debugger
      .sendCommand({ tabId: this.tabId }, 'Runtime.callFunctionOn', {
        functionDeclaration: func.toString(),
        executionContextId: contextPayload.id,
        arguments: args.map((item) => {
          return {
            value: item,
          }
        }),
        returnByValue: true,
        awaitPromise: true,
        userGesture: true,
      })
      .then((_data) => {
        const data = _data as {
          exceptionDetails?: {
            exception: {
              description: string
            }
          }
          result: {
            type: string
            value: unknown
          }
        }
        if (data.exceptionDetails) {
          throw new Error(data.exceptionDetails.exception.description)
        } else {
          return data.result.value as Result
        }
      })
      .catch((e) => {
        throw e
      })
  }

  public onContextChange(method: string, _params: unknown): void {
    if (method === 'Runtime.executionContextCreated') {
      const params = _params as {
        context: ContextPayload
      }
      this.contextPayloadMap[params.context.uniqueId] = params.context
    }
    if (method === 'Runtime.executionContextDestroyed') {
      const params = _params as {
        executionContextId: number
        executionContextUniqueId: string
      }
      delete this.contextPayloadMap[params.executionContextUniqueId]
    }
  }

  public async getDefaultContext(): Promise<ContextPayload> {
    for (const uniqueId of Object.keys(this.contextPayloadMap)) {
      if (this.contextPayloadMap[uniqueId].auxData.isDefault) {
        try {
          await this._executeScript(this.contextPayloadMap[uniqueId], () => {})
          return this.contextPayloadMap[uniqueId]
        } catch (e) {
          if (
            e instanceof Error &&
            e.message === '{"code":-32000,"message":"Cannot find context with specified id"}'
          ) {
            delete this.contextPayloadMap[uniqueId]
          }
        }
      }
    }
    throw new Error('not found default ExecutionContext')
  }

  public reset(): void {
    this.contextPayloadMap = {}
  }
}
