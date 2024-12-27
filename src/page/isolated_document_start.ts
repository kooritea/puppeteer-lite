function selectXY() {
  const model = document.createElement('div')
  model.style.position = 'fixed'
  model.style.top = '0'
  model.style.left = '0'
  model.style.width = '100vw'
  model.style.height = '100vh'
  model.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'
  model.style.zIndex = '9999'
  model.style.cursor = 'crosshair'
  model.addEventListener('click', function (e) {
    navigator.clipboard.writeText(`${e.x},${e.y}`).catch((e) => {
      console.error(e)
    })
    document.body.style.overflow = ''
    model.remove()
  })
  document.body.appendChild(model)
  document.body.style.overflow = 'hidden'
}
chrome.runtime.onMessage.addListener(function (request: { action: string }) {
  switch (request.action) {
    case 'selectXY': {
      selectXY()
    }
  }
})
