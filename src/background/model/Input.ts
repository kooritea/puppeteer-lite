// source packages/puppeteer-core/src/cdp/Input.ts

import { Protocol } from 'puppeteer-core'
import { _keyDefinitions, KeyDefinition } from 'puppeteer-core/internal/common/USKeyboardLayout.js'
import {
  KeyboardTypeOptions,
  KeyInput,
  MouseButton,
  MouseClickOptions,
  MouseMoveOptions,
  MouseState,
  MouseWheelOptions,
  Point,
} from '../../typings/puppeteer.js'

type KeyDescription = Required<
  Pick<KeyDefinition, 'keyCode' | 'key' | 'text' | 'code' | 'location'>
>

export class ExtKeyboard {
  #pressedKeys = new Set<string>()
  #tabId: number
  _modifiers = 0

  constructor(tabId: number) {
    this.#tabId = tabId
  }

  async down(key: KeyInput): Promise<void> {
    const description = this.#keyDescriptionForString(key)

    const autoRepeat = this.#pressedKeys.has(description.code)
    this.#pressedKeys.add(description.code)
    this._modifiers |= this.#modifierBit(description.key)

    const text = description.text
    await chrome.debugger.sendCommand({ tabId: this.#tabId }, 'Input.dispatchKeyEvent', {
      type: text ? 'keyDown' : 'rawKeyDown',
      modifiers: this._modifiers,
      windowsVirtualKeyCode: description.keyCode,
      code: description.code,
      key: description.key,
      text: text,
      unmodifiedText: text,
      autoRepeat,
      location: description.location,
      isKeypad: description.location === 3,
      commands: undefined,
    })
  }

  #modifierBit(key: string): number {
    if (key === 'Alt') {
      return 1
    }
    if (key === 'Control') {
      return 2
    }
    if (key === 'Meta') {
      return 4
    }
    if (key === 'Shift') {
      return 8
    }
    return 0
  }

  #keyDescriptionForString(keyString: KeyInput): KeyDescription {
    const shift = this._modifiers & 8
    const description = {
      key: '',
      keyCode: 0,
      code: '',
      text: '',
      location: 0,
    }

    const definition = _keyDefinitions[keyString]
    if (!definition) {
      throw new Error(`Unknown key: "${keyString}"`)
    }

    if (definition.key) {
      description.key = definition.key
    }
    if (shift && definition.shiftKey) {
      description.key = definition.shiftKey
    }

    if (definition.keyCode) {
      description.keyCode = definition.keyCode
    }
    if (shift && definition.shiftKeyCode) {
      description.keyCode = definition.shiftKeyCode
    }

    if (definition.code) {
      description.code = definition.code
    }

    if (definition.location) {
      description.location = definition.location
    }

    if (description.key.length === 1) {
      description.text = description.key
    }

    if (definition.text) {
      description.text = definition.text
    }
    if (shift && definition.shiftText) {
      description.text = definition.shiftText
    }

    // if any modifiers besides shift are pressed, no text should be sent
    if (this._modifiers & ~8) {
      description.text = ''
    }

    return description
  }

  async up(key: KeyInput): Promise<void> {
    const description = this.#keyDescriptionForString(key)

    this._modifiers &= ~this.#modifierBit(description.key)
    this.#pressedKeys.delete(description.code)
    await chrome.debugger.sendCommand({ tabId: this.#tabId }, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      modifiers: this._modifiers,
      key: description.key,
      windowsVirtualKeyCode: description.keyCode,
      code: description.code,
      location: description.location,
    })
  }

  async sendCharacter(char: string): Promise<void> {
    await chrome.debugger.sendCommand({ tabId: this.#tabId }, 'Input.insertText', { text: char })
  }

  private charIsKey(char: string): char is KeyInput {
    return !!_keyDefinitions[char as KeyInput]
  }

  async type(text: string, options: Readonly<KeyboardTypeOptions> = {}): Promise<void> {
    const delay = options.delay || undefined
    for (const char of text) {
      if (this.charIsKey(char)) {
        await this.press(char, { delay })
      } else {
        if (delay) {
          await new Promise((f) => {
            return setTimeout(f, delay)
          })
        }
        await this.sendCharacter(char)
      }
    }
  }

  async press(key: KeyInput, options: Readonly<KeyboardTypeOptions> = {}): Promise<void> {
    const { delay = null } = options
    await this.down(key)
    if (delay) {
      await new Promise((f) => {
        return setTimeout(f, options.delay)
      })
    }
    await this.up(key)
  }
}

const enum MouseButtonFlag {
  None = 0,
  Left = 1,
  Right = 1 << 1,
  Middle = 1 << 2,
  Back = 1 << 3,
  Forward = 1 << 4,
}

const MouseButton: {
  [key: string]: MouseButton
} = {
  Left: 'left',
  Right: 'right',
  Middle: 'middle',
  Back: 'back',
  Forward: 'forward',
}

const getButtonFromPressedButtons = (buttons: number): Protocol.Input.MouseButton => {
  if (buttons & MouseButtonFlag.Left) {
    return MouseButton.Left
  } else if (buttons & MouseButtonFlag.Right) {
    return MouseButton.Right
  } else if (buttons & MouseButtonFlag.Middle) {
    return MouseButton.Middle
  } else if (buttons & MouseButtonFlag.Back) {
    return MouseButton.Back
  } else if (buttons & MouseButtonFlag.Forward) {
    return MouseButton.Forward
  }
  return 'none'
}

const getFlag = (button: MouseButton): MouseButtonFlag => {
  switch (button) {
    case MouseButton.Left:
      return MouseButtonFlag.Left
    case MouseButton.Right:
      return MouseButtonFlag.Right
    case MouseButton.Middle:
      return MouseButtonFlag.Middle
    case MouseButton.Back:
      return MouseButtonFlag.Back
    case MouseButton.Forward:
      return MouseButtonFlag.Forward
  }
  throw new Error()
}

export class ExtMouse {
  #keyboard: ExtKeyboard
  #tabId: number

  constructor(keyboard: ExtKeyboard, tabId: number) {
    this.#keyboard = keyboard
    this.#tabId = tabId
  }

  #_state: Readonly<MouseState> = {
    position: { x: 0, y: 0 },
    buttons: MouseButtonFlag.None,
  }
  get #state(): MouseState {
    return Object.assign({ ...this.#_state }, ...this.#transactions) as MouseState
  }

  // Transactions can run in parallel, so we store each of thme in this array.
  #transactions: Array<Partial<MouseState>> = []
  #createTransaction(): {
    update: (updates: Partial<MouseState>) => void
    commit: () => void
    rollback: () => void
  } {
    const transaction: Partial<MouseState> = {}
    this.#transactions.push(transaction)
    const popTransaction = () => {
      this.#transactions.splice(this.#transactions.indexOf(transaction), 1)
    }
    return {
      update: (updates: Partial<MouseState>) => {
        Object.assign(transaction, updates)
      },
      commit: () => {
        this.#_state = { ...this.#_state, ...transaction }
        popTransaction()
      },
      rollback: popTransaction,
    }
  }

  /**
   * This is a shortcut for a typical update, commit/rollback lifecycle based on
   * the error of the action.
   */
  async #withTransaction(
    action: (update: (updates: Partial<MouseState>) => void) => Promise<unknown>
  ): Promise<void> {
    const { update, commit, rollback } = this.#createTransaction()
    try {
      await action(update)
      commit()
    } catch (error) {
      rollback()
      throw error
    }
  }

  async reset(): Promise<void> {
    const actions = []
    for (const [flag, button] of [
      [MouseButtonFlag.Left, MouseButton.Left],
      [MouseButtonFlag.Middle, MouseButton.Middle],
      [MouseButtonFlag.Right, MouseButton.Right],
      [MouseButtonFlag.Forward, MouseButton.Forward],
      [MouseButtonFlag.Back, MouseButton.Back],
    ] as const) {
      if (this.#state.buttons & flag) {
        actions.push(this.up({ button: button }))
      }
    }
    if (this.#state.position.x !== 0 || this.#state.position.y !== 0) {
      actions.push(this.move(0, 0))
    }
    await Promise.all(actions)
  }

  async move(x: number, y: number, options: Readonly<MouseMoveOptions> = {}): Promise<void> {
    const { steps = 1 } = options
    const from = this.#state.position
    const to = { x, y }
    for (let i = 1; i <= steps; i++) {
      await this.#withTransaction((updateState) => {
        updateState({
          position: {
            x: from.x + (to.x - from.x) * (i / steps),
            y: from.y + (to.y - from.y) * (i / steps),
          },
        })
        const { buttons, position } = this.#state
        return chrome.debugger.sendCommand({ tabId: this.#tabId }, 'Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          modifiers: this.#keyboard._modifiers,
          buttons,
          button: getButtonFromPressedButtons(buttons),
          ...position,
        })
      })
    }
  }

  async down(options: Readonly<MouseClickOptions> = {}): Promise<void> {
    const { button = MouseButton.Left, count = 1 } = options
    const flag = getFlag(button)
    if (!flag) {
      throw new Error(`Unsupported mouse button: ${button}`)
    }
    if (this.#state.buttons & flag) {
      throw new Error(`'${button}' is already pressed.`)
    }
    await this.#withTransaction((updateState) => {
      updateState({
        buttons: this.#state.buttons | flag,
      })
      const { buttons, position } = this.#state
      return chrome.debugger.sendCommand({ tabId: this.#tabId }, 'Input.dispatchMouseEvent', {
        type: 'mousePressed',
        modifiers: this.#keyboard._modifiers,
        clickCount: count,
        buttons,
        button,
        ...position,
      })
    })
  }

  async up(options: Readonly<MouseClickOptions> = {}): Promise<void> {
    const { button = MouseButton.Left, count = 1 } = options
    const flag = getFlag(button)
    if (!flag) {
      throw new Error(`Unsupported mouse button: ${button}`)
    }
    if (!(this.#state.buttons & flag)) {
      throw new Error(`'${button}' is not pressed.`)
    }
    await this.#withTransaction((updateState) => {
      updateState({
        buttons: this.#state.buttons & ~flag,
      })
      const { buttons, position } = this.#state
      return chrome.debugger.sendCommand({ tabId: this.#tabId }, 'Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        modifiers: this.#keyboard._modifiers,
        clickCount: count,
        buttons,
        button,
        ...position,
      })
    })
  }

  async click(x: number, y: number, options: Readonly<MouseClickOptions> = {}): Promise<void> {
    const { delay, count = 1 } = options
    if (count < 1) {
      throw new Error('Click must occur a positive number of times.')
    }
    const actions: Array<Promise<void>> = [this.move(x, y)]
    for (let i = 1; i < count; ++i) {
      actions.push(this.down({ ...options, count: i }), this.up({ ...options, count: i }))
    }
    actions.push(this.down({ ...options }))
    if (typeof delay === 'number') {
      await Promise.all(actions)
      actions.length = 0
      await new Promise((resolve) => {
        setTimeout(resolve, delay)
      })
    }
    actions.push(this.up({ ...options }))
    await Promise.all(actions)
  }

  async wheel(options: Readonly<MouseWheelOptions> = {}): Promise<void> {
    const { deltaX = 0, deltaY = 0 } = options
    const { position, buttons } = this.#state
    await chrome.debugger.sendCommand({ tabId: this.#tabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      pointerType: 'mouse',
      modifiers: this.#keyboard._modifiers,
      deltaY,
      deltaX,
      buttons,
      ...position,
    })
  }

  async drag(start: Point, target: Point): Promise<Protocol.Input.DragData> {
    const promise = chrome.debugger.sendCommand(
      { tabId: this.#tabId },
      'Input.dragIntercepted'
    ) as Promise<Protocol.Input.DragData>
    await this.move(start.x, start.y)
    await this.down()
    await this.move(target.x, target.y)
    return await promise
  }

  async dragEnter(target: Point, data: Protocol.Input.DragData): Promise<void> {
    await chrome.debugger.sendCommand({ tabId: this.#tabId }, 'Input.dispatchDragEvent', {
      type: 'dragEnter',
      x: target.x,
      y: target.y,
      modifiers: this.#keyboard._modifiers,
      data,
    })
  }

  async dragOver(target: Point, data: Protocol.Input.DragData): Promise<void> {
    await chrome.debugger.sendCommand({ tabId: this.#tabId }, 'Input.dispatchDragEvent', {
      type: 'dragOver',
      x: target.x,
      y: target.y,
      modifiers: this.#keyboard._modifiers,
      data,
    })
  }

  async drop(target: Point, data: Protocol.Input.DragData): Promise<void> {
    await chrome.debugger.sendCommand({ tabId: this.#tabId }, 'Input.dispatchDragEvent', {
      type: 'drop',
      x: target.x,
      y: target.y,
      modifiers: this.#keyboard._modifiers,
      data,
    })
  }

  async dragAndDrop(start: Point, target: Point, options: { delay?: number } = {}): Promise<void> {
    const { delay = null } = options
    const data = await this.drag(start, target)
    await this.dragEnter(target, data)
    await this.dragOver(target, data)
    if (delay) {
      await new Promise((resolve) => {
        return setTimeout(resolve, delay)
      })
    }
    await this.drop(target, data)
    await this.up()
  }
}
