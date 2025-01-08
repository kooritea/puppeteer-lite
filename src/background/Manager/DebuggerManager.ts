import { ExecutionContext } from '../handle/ExecutionContext'

interface DebuggerInstance {}

interface DebuggerUseInstance extends DebuggerInstance {
  attachId: string
}

export class CDebuggerManager {
  private DebuggerVersion = '1.2'
  private tabQueue: Array<{
    tabId: number
    promise: Promise<void>
    resolve: () => void
  }> = []
  private attachTab: {
    tabId: number
    promise: Promise<DebuggerInstance>
  } | null = null
  private attaching: Array<string> = []

  private ExecutionContextMap: {
    [tabId: string]: ExecutionContext
  } = {}

  constructor() {
    chrome.debugger.onEvent.addListener(this.debuggerEventHandler.bind(this))
  }

  private debuggerEventHandler(
    source: chrome._debugger.Debuggee,
    method: string,
    _params?: unknown
  ): void {
    if (source.tabId && this.ExecutionContextMap[source.tabId]) {
      this.ExecutionContextMap[source.tabId].onContextChange(method, _params)
    }
  }

  public async attach(tabId: number): Promise<DebuggerUseInstance> {
    const attachId = `${tabId}.${Date.now() + Math.random()}`
    if (this.attachTab === null) {
      this.attachTab = {
        tabId,
        promise: this.getDebuggerInstance(tabId),
      }
      const debuggerInstance = await this.attachTab.promise
      this.attaching.push(attachId)
      return {
        attachId,
        ...debuggerInstance,
      }
    }
    if (this.attachTab && this.attachTab.tabId === tabId) {
      const debuggerInstance = await this.attachTab.promise
      this.attaching.push(attachId)
      return {
        attachId,
        ...debuggerInstance,
      }
    }
    let waitTab = this.tabQueue.find((item) => {
      return item.tabId === tabId
    })
    if (!waitTab) {
      let resolve!: () => void
      const promise = new Promise<void>((_resolve) => {
        resolve = _resolve
      })
      waitTab = {
        tabId,
        promise,
        resolve,
      }
      this.tabQueue.push(waitTab)
    }
    await waitTab.promise
    return this.attach(tabId)
  }

  public async detach(attachId: string): Promise<void> {
    const i = this.attaching.indexOf(attachId)
    if (i > -1) {
      this.attaching.splice(i, 1)
      if (this.attaching.length === 0) {
        if (this.attachTab) {
          await chrome.debugger.sendCommand({ tabId: this.attachTab.tabId }, 'Runtime.disable', {})
          await chrome.debugger.detach({ tabId: this.attachTab.tabId })
        }
        this.attachTab = null
        this.attachNext()
      }
    }
  }

  private async getDebuggerInstance(tabId: number): Promise<DebuggerInstance> {
    await chrome.debugger.attach({ tabId }, this.DebuggerVersion)
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable', {})
    return {}
  }

  private attachNext(): void {
    if (this.tabQueue.length > 0) {
      const waitTab = this.tabQueue.shift()
      waitTab?.resolve()
    }
  }

  public registerTab(tabId: number, executionContext: ExecutionContext): void {
    this.ExecutionContextMap[tabId] = executionContext
  }

  public removeTab(tabId: number): void {
    delete this.ExecutionContextMap[tabId]
    const index = this.tabQueue.findIndex((tab) => {
      return tab.tabId === tabId
    })
    if (index > -1) {
      this.tabQueue.splice(index, 1)
    }
    if (this.attachTab?.tabId === tabId) {
      this.attachTab = null
      this.attaching = []
      this.attachNext()
    }
  }
}

export const DebuggerManager = new CDebuggerManager()
globalThis.DebuggerManager = DebuggerManager
