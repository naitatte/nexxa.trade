import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import input from 'input';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG = {
  apiId: parseInt(process.env.TELEGRAM_API_ID),
  apiHash: process.env.TELEGRAM_API_HASH,
  phoneNumber: process.env.TELEGRAM_PHONE_NUMBER,
  twoFactorPassword: process.env.TELEGRAM_2FA_PASSWORD,
  sessionString: process.env.TELEGRAM_SESSION_STRING || '',
};

async function authenticateUser(client) {
  console.log('[AUTH] Iniciando autenticación...');

  await client.start({
    phoneNumber: CONFIG.phoneNumber,
    password: async () => {
      if (CONFIG.twoFactorPassword) {
        return CONFIG.twoFactorPassword;
      }
      return await input.text('Ingresa tu contraseña de 2FA (si aplica): ');
    },
    phoneCode: async () => {
      return await input.text('Ingresa el código que recibiste por Telegram: ');
    },
    onError: (err) => {
      console.error('[ERROR] Error durante la autenticación:', err.message);
      process.exit(1);
    },
  });
}

async function listDialogs(client) {
  console.log('[INFO] Obteniendo lista de diálogos...\n');

  const dialogs = await client.getDialogs();

  console.log('─'.repeat(80));
  console.log('LISTA DE CHATS Y GRUPOS');
  console.log('─'.repeat(80));
  console.log();

  dialogs.forEach((dialog, index) => {
    const entity = dialog.entity;
    const isChannel = entity instanceof Api.Channel || entity instanceof Api.ChannelForbidden;
    const isGroup = entity instanceof Api.Chat || entity instanceof Api.ChatForbidden;
    const isUser = entity instanceof Api.User;

    let type = '';
    if (isChannel) type = '[CANAL]';
    else if (isGroup) type = '[GRUPO]';
    else if (isUser) type = '[USUARIO]';
    else type = '[DESCONOCIDO]';

    const title = entity.title || `${entity.firstName || ''} ${entity.lastName || ''}`.trim() || 'Sin nombre';
    const username = entity.username ? `@${entity.username}` : 'Sin username';
    const id = entity.id?.toString() || 'N/A';
    const fullId = isChannel || isGroup ? `-100${id}` : id;

    console.log(`${index + 1}. ${type} ${title}`);
    console.log(`   Username: ${username}`);
    console.log(`   ID: ${fullId}`);
    console.log();
  });

  console.log('─'.repeat(80));
  console.log('[INFO] Usa el ID o el username (con @) en tu archivo .env');
  console.log('─'.repeat(80));
}

async function main() {
  console.log('[START] Listador de Chats de Telegram\n');

  if (!CONFIG.apiId || !CONFIG.apiHash || !CONFIG.phoneNumber) {
    console.error('[ERROR] Faltan variables de configuración requeridas');
    console.error('   Asegúrate de tener TELEGRAM_API_ID, TELEGRAM_API_HASH y TELEGRAM_PHONE_NUMBER en tu .env');
    process.exit(1);
  }

  const client = new TelegramClient(
    new StringSession(CONFIG.sessionString),
    CONFIG.apiId,
    CONFIG.apiHash,
    {
      connectionRetries: 5,
    }
  );

  try {
    await client.connect();
    console.log('[SUCCESS] Conectado a Telegram\n');

    if (!CONFIG.sessionString || !(await client.checkAuthorization())) {
      await authenticateUser(client);
    }

    await listDialogs(client);
  } catch (error) {
    console.error('[ERROR] Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

main().catch(console.error);
