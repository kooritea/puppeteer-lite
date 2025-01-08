type ClientPageEvent = 'page.close'
type ClientpageNetworkEvent = 'page.network.request' | 'page.network.response'
type ClientBrowserEvent = 'browser.ping' | 'browser.close'
type ClientEvent = ClientPageEvent | ClientpageNetworkEvent | ClientBrowserEvent
