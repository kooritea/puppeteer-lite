export const Config: IConfig = {
  masterWS: 'ws://localhost:7004',
  auth: () => {
    // 被控端连接socket后会调用这个方法获取认证信息，控制端没做认证的话这里返回空就行
    return ''
  },
}
