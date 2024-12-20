class _DebuggerManager {
  private tabQueue: Array<{
    tabId: number
    promise: Promise<void>
    resolve: () => void
  }> = []
  private attachTab: {
    tabId: number
    promise: Promise<void>
  } | null = null
  private attaching: Array<string> = []

  public async attach(tabId: number): Promise<string> {
    const attachId = `${tabId}.${Date.now() + Math.random()}`
    if (this.attachTab === null) {
      this.attachTab = {
        tabId,
        promise: chrome.debugger.attach({ tabId }, '1.2'),
      }
      this.attaching.push(attachId)
      await this.attachTab.promise
      return attachId
    }
    if (this.attachTab && this.attachTab.tabId === tabId) {
      this.attaching.push(attachId)
      await this.attachTab.promise
      return attachId
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
    this.attaching.splice(this.attaching.indexOf(attachId), 1)
    if (this.attaching.length === 0) {
      await chrome.debugger.detach({ tabId: this.attachTab?.tabId })
      this.attachTab = null
      this.attachNext()
    }
  }

  private attachNext(): void {
    if (this.tabQueue.length > 0) {
      const waitTab = this.tabQueue.shift()
      waitTab?.resolve()
    }
  }

  public removeTab(tabId: number): void {
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
export const DebuggerManager = new _DebuggerManager()
