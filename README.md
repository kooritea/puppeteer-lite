## PuppeteerLite

使用chrome扩展实现类似puppeteer的远程自动控制

> 因为不自己编译chromium无法隐藏CDP协议的痕迹以及puppeteer会有其他奇怪的问题，故有此扩展。

这是被控端扩展的源码，控制端因为写在了其他应用上暂未公开。


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


- 4、使用chrome扩展开发者模式，加载项目根目录


- 5、运行本地测试
```shell
npm run test
```
