import { ClickOptions } from 'puppeteer-core'
import { GotoOptions, KeyboardTypeOptions, WaitForSelectorOptions } from './puppeteer'

type SeverPageEvent =
  | 'page.auth'
  | 'page.evaluate'
  | 'page.waitForSelector'
  | 'page.type'
  | 'page.click'
  | 'page.goto'
  | 'page.close'
type SeverBrowserEvent =
  | 'browser.auth'
  | 'browser.createChildBrowser'
  | 'browser.createPage'
  | 'browser.close'
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
    options?: WaitForSelectorOptions
  }
}
interface FromServerPageTypeSocketPack extends SocketPack {
  event: 'page.type'
  id: string
  data: {
    selector: string
    text: string
    options?: KeyboardTypeOptions
  }
}
interface FromServerPageClickSocketPack extends SocketPack {
  event: 'page.click'
  id: string
  data: {
    selector: string
    options?: ClickOptions
  }
}
interface FromServerPageGotoSocketPack extends SocketPack {
  event: 'page.goto'
  id: string
  data: {
    url: string
    options?: GotoOptions
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
interface FromServerBrowserCloseSocketPack extends SocketPack {
  event: 'browser.close'
  id: string
}

type FromServerSocketPack =
  | FromServerPageAuthSocketPack
  | FromServerPageEvaluateSocketPack
  | FromServerPageWaitForSelectorSocketPack
  | FromServerPageTypeSocketPack
  | FromServerPageClickSocketPack
  | FromServerPageGotoSocketPack
  | FromServerPageCloseSocketPack
  | FromServerBrowserAuthSocketPack
  | FromServerBrowserCreateChildBrowserSocketPack
  | FromServerBrowserCreatePageSocketPack
  | FromServerBrowserCloseSocketPack
