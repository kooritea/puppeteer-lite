import * as esbuild from 'esbuild'

await esbuild.build({
    entryPoints: ['src/background/index.ts', 'src/page/main_document_start.ts'],
    bundle: true,
    platform: 'node',
    target: 'esnext',
    format: 'esm',
    outdir: 'dist'
})