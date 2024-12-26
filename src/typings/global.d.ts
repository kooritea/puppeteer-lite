import { CDebuggerManager } from 'src/background/Manager/DebuggerManager'
import { Browser } from 'src/background/model/browser.model'

export {}

declare global {
  interface Window {
    _callCodev8ds9v8929n2pvnb2fi3n: (code: string, ...args: unknown[]) => Promise<unknown>
    _callCodeInjected2hd9wihd932h32f: boolean
  }
  // eslint-disable-next-line no-var
  var Browsers: Array<Browser>
  // eslint-disable-next-line no-var
  var DebuggerManager: CDebuggerManager
}
