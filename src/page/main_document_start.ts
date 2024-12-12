window._callCodev8ds9v8929n2pvnb2fi3n = async function (code: string): Promise<never> {
  const e = eval(code) as unknown
  if (e instanceof Function) {
    return (e as () => Promise<never>)()
  } else {
    return e as never
  }
}
