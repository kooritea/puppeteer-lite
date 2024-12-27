import * as esbuild from 'esbuild'
import * as fs from 'fs'

await esbuild.build({
  entryPoints: [
    'src/background/index.ts',
    'src/page/main_document_start.ts',
    'src/page/isolated_document_start.ts',
    'src/popup/popup.ts',
  ],
  bundle: true,
  platform: 'node',
  target: 'esnext',
  format: 'cjs',
  outdir: 'dist',
})
fs.copyFileSync('src/popup/index.html', 'dist/popup/index.html')
