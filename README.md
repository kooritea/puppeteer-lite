## PuppeteerLite

使用chrome扩展实现类似puppeteer的远程自动控制

> 因为不自己编译chromium无法隐藏CDP协议的痕迹以及puppeteer会有其他奇怪的问题，故有此扩展。

这是被控端扩展的源码，控制端因为写在了其他应用上暂未公开。  
控制端上几乎没有实际的功能逻辑，所以后续大概也不会再公开。  
所有的逻辑都在这个被控端扩展中实现，控制端的的相关调用方法可以参考项目根目录下的test.mjs。


## 使用

- 1、安装依赖
```shell
npm i
```

- 2、写配置文件 src/config.ts


- 3、编译
```shell
npm run build
```

- 4、如需使用page.mouse相关api,请使用--silent-debugger-extension-api启动浏览器，否则xy坐标会不准确

- 5、使用chrome扩展开发者模式，加载项目根目录


- 6、运行本地测试
```shell
npm run test
```

所有可用的指令都在src/typings/server.d.ts里面
