interface IConfig {
  masterWS: string
  auth: () => string | Promise<string>
}
