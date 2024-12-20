import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 7004 })


const promiseMap = {}

wss.on('connection', function connection(ws) {
  ws.on('error', console.error)

  ws.on('message', function message(_pack) {
    const pack = JSON.parse(_pack)
    if (pack.id && promiseMap[pack.id]) {
      if (pack.isError) {
        promiseMap[pack.id].reject(pack.data)
      } else {
        promiseMap[pack.id].resolve(pack.data)
      }
    }
    switch (pack.event) {
      case 'browser.create': {
        if (pack.data.auth === 'admin') {
          ws.send(JSON.stringify({
            event: 'browser.auth'
          }))
          if (pack.data.pages.length === 0) {
            ws.send(JSON.stringify({
              event: 'browser.createPage',
              data: {
                url: '', // 可选
                pageId: `` // 可选 page实例建立socket时回传用于识别
              }
            }))
          }
        } else {
          ws.close()
        }
        break
      }
      case 'page.create': {
        if (pack.data.auth === 'admin') {
          ws.send(JSON.stringify({
            event: 'page.auth'
          }))
          onPageConnect(ws)
        } else {
          ws.close()
        }
        break
      }
      case 'browser.ping': {
        break
      }
      default: {
        console.log(pack)
      }
    }
  })
})

async function send(ws, event, data) {
  const id = `${Date.now() + Math.random()}`
  const promise = new Promise((resolve, reject) => {
    promiseMap[id] = {
      resolve,
      reject
    }
  })
  ws.send(JSON.stringify({
    event,
    id,
    data
  }))
  // 返回一个promise, puppeteer-lite返回的消息中会携带这里生成的id，代表该条指令操作完成，兑现promise
  return promise
}

async function onPageConnect(ws) {
  try {
    await send(ws, 'page.goto', {
      url: 'https://www.google.com',
    })
    await send(ws, 'page.waitForSelector', {
      selector: 'form[action="/search"] textarea',
    })
    await send(ws, 'page.type', {
      selector: 'form[action="/search"] textarea',
      text: 'kooritea/puppeteer-lite',
      options: {
        delay: 500
      }
    })
    await send(ws, 'page.keyboard.press', {
      key: 'Enter',
      options: {
        delay: 100
      }
    })
    await send(ws, 'page.waitForSelector', {
      selector: '#rso h3',
    })
    const pageData = await send(ws, 'page.evaluate', {
      code: (()=>{
        return Array.from(document.querySelectorAll('#rso h3')).map((item)=>{
          return item.innerText
        })
      }).toString()
    })
    await send(ws, 'page.goto', {
      url: 'https://github.com/kooritea/puppeteer-lite',
    })
  } catch (e) {
    console.error(e)
  }
}