type SeverPageEvent = 'page.auth' | 'page.evaluate' | 'page.waitForSelector' | 'page.close'
type SeverBrowserEvent = 'browser.auth' | 'browser.createChildBrowser' | 'browser.createPage'
type SeverEvent = SeverPageEvent | SeverBrowserEvent

interface SocketPack {
  event: SeverEvent
  id?: string
}

interface FromServerPageAuthSocketPack extends SocketPack {
  event: 'page.auth'
}
interface FromServerPageEvaluateSocketPack extends SocketPack {
  event: 'page.evaluate'
  id: string
  data: {
    code: string
  }
}
interface FromServerPageWaitForSelectorSocketPack extends SocketPack {
  event: 'page.waitForSelector'
  id: string
  data: {
    selector: string
  }
}
interface FromServerPageCloseSocketPack extends SocketPack {
  event: 'page.close'
  id: string
}

interface FromServerBrowserAuthSocketPack extends SocketPack {
  event: 'browser.auth'
}
interface FromServerBrowserCreateChildBrowserSocketPack extends SocketPack {
  event: 'browser.createChildBrowser'
  id: string
  data: {
    serverURL: string
  }
}
interface FromServerBrowserCreatePageSocketPack extends SocketPack {
  event: 'browser.createPage'
  id: string
  data: {
    url: string
    pageId: string
  }
}

type FromServerSocketPack =
  | FromServerPageAuthSocketPack
  | FromServerPageEvaluateSocketPack
  | FromServerPageWaitForSelectorSocketPack
  | FromServerPageCloseSocketPack
  | FromServerBrowserAuthSocketPack
  | FromServerBrowserCreateChildBrowserSocketPack
  | FromServerBrowserCreatePageSocketPack

interface IConfig {
  masterWS: string
  auth: () => string | Promise<string>
}
