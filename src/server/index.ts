import fs from 'node:fs';
import path from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import dotenv from 'dotenv';
import { app } from './app.js';
import { ensureSchema } from './db/migrate.js';
import { ensureSeedData } from './db/seed.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

async function bootstrap() {
  // 1. Initialisation auto du schéma et des données si base configurée
  if (process.env.DATABASE_URL) {
    try {
      console.log('🔄 Initialisation de la base de données...');
      await ensureSchema();
      await ensureSeedData();
    } catch (err) {
      console.error('⚠️ Avertissement : échec lors de l’initialisation DB :', err);
    }
  }

  // 2. En production, servir les fichiers statiques du build client
  const clientDist = path.resolve(process.cwd(), 'dist/client');
  if (fs.existsSync(clientDist)) {
    console.log(`📦 Fichiers frontend détectés dans ${clientDist}, activation du mode SPA.`);
    app.use('/*', serveStatic({ root: './dist/client' }));
    app.get('*', serveStatic({ path: './dist/client/index.html' }));
  }

  // 3. Lancement du serveur Hono
  serve(
    {
      fetch: app.fetch,
      port: PORT,
    },
    (info) => {
      console.log(`🚀 LogiCam Industrial OS démarré sur le port ${info.port}`);
    }
  );
}

bootstrap().catch((err) => {
  console.error('❌ Erreur critique au démarrage du serveur :', err);
  process.exit(1);
});
