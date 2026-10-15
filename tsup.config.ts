import { defineConfig } from 'tsup'
export default defineConfig({entry:['apps/server/src/index.ts'],format:['esm'],platform:'node',target:'node24',outDir:'dist/server',noExternal:[/^@court\//],external:['express','cors','helmet','multer','sharp','dotenv/config','zod','zod-to-json-schema'],removeNodeProtocol:false,clean:true})
