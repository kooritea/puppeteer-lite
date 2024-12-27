function selectXY() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(
      tabs[0].id as number,
      {
        action: 'selectXY',
      },
      function () {
        window.close()
      }
    )
  })
}
document.getElementById('selectXY')?.addEventListener('click', selectXY)
