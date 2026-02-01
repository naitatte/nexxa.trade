import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { errors } from 'telegram';
import readline from 'readline';
import input from 'input';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG = {
  apiId: parseInt(process.env.TELEGRAM_API_ID),
  apiHash: process.env.TELEGRAM_API_HASH,
  targetChatIdentifier: process.env.TELEGRAM_TARGET_CHAT,
  sessionString: process.env.TELEGRAM_SESSION_STRING || '',
};

async function resolveChatIdentifier(client, identifier) {
  try {
    if (/^-?\d+$/.test(identifier)) {
      try {
        const dialogs = await client.getDialogs();
        
        const foundDialog = dialogs.find(dialog => {
          const entity = dialog.entity;
          if (!entity.id) return false;
          
          const entityIdStr = entity.id.toString();
          
          if (identifier.startsWith('-100')) {
            return entityIdStr === identifier.slice(4) || 
                   `-100${entityIdStr}` === identifier;
          }
          
          return entityIdStr === identifier || 
                 `-100${entityIdStr}` === identifier ||
                 entityIdStr === identifier.replace('-100', '');
        });
        
        if (foundDialog) {
          return foundDialog.entity;
        }
      } catch (dialogError) {
        console.log(`[INFO] No se encontró el chat en diálogos, intentando método directo...`);
      }
      
      throw new Error(
        `No se pudo encontrar el chat con ID "${identifier}"`
      );
    }

    if (identifier.startsWith('@')) {
      const username = identifier.slice(1);
      return await client.getEntity(username);
    }

    return await client.getEntity(identifier);
  } catch (error) {
    console.error(`[ERROR] Error al resolver el chat "${identifier}":`, error.message);
    throw error;
  }
}

async function deleteMyMessages(client, targetChat) {
  try {
    console.log('[INFO] Obteniendo mensajes del canal...\n');
    
    const me = await client.getMe();
    console.log(`[INFO] Usuario actual: ${me.firstName} ${me.lastName || ''} (@${me.username || 'sin username'})\n`);
    
    // Verificar si es un canal (los canales tienen className 'Channel' y broadcast = true)
    const isChannel = targetChat.className === 'Channel' && targetChat.broadcast;
    
    if (isChannel) {
      console.log('[INFO] Detectado: Este es un CANAL. Los mensajes se publican como el canal, no como usuario.');
      console.log('[INFO] Se obtendrán TODOS los mensajes del canal para eliminar.\n');
    }
    
    let allMessages = [];
    let offsetId = 0;
    let hasMore = true;
    
    while (hasMore) {
      const messages = await client.getMessages(targetChat, {
        limit: 100,
        offsetId: offsetId > 0 ? offsetId : undefined,
      });
      
      if (messages.length === 0) {
        hasMore = false;
        break;
      }
      
      // Para canales: obtener todos los mensajes (se publican como el canal)
      // Para grupos/chats: filtrar solo los mensajes del usuario
      let filteredMessages;
      
      if (isChannel) {
        // En canales, obtener todos los mensajes (excepto los de servicio)
        filteredMessages = messages.filter(msg => msg.id && !msg.action);
      } else {
        // En grupos/chats, filtrar por sender
        filteredMessages = messages.filter(msg => {
          const sender = msg.fromId;
          if (!sender) return false;
          
          const senderId = sender.userId || sender.channelId || sender.chatId;
          return senderId && senderId.toString() === me.id.toString();
        });
      }
      
      allMessages.push(...filteredMessages);
      
      if (messages.length < 100) {
        hasMore = false;
      } else {
        offsetId = messages[messages.length - 1].id;
      }
      
      console.log(`[INFO] Mensajes encontrados hasta ahora: ${allMessages.length}`);
    }
    
    console.log(`\n[INFO] Total de mensajes encontrados: ${allMessages.length}\n`);
    
    if (allMessages.length === 0) {
      console.log('[INFO] No hay mensajes para eliminar.');
      return;
    }
    
    console.log('[WARNING] Estás a punto de eliminar TODOS los mensajes en este chat/canal.');
    console.log('[WARNING] Esta acción NO se puede deshacer.\n');
    console.log(`[INFO] Mensajes a eliminar: ${allMessages.length}\n`);
    
    const answer = await input.text('¿Estás seguro? Escribe "SI" para confirmar: ');
    
    if (answer !== 'SI') {
      console.log('[INFO] Operación cancelada.');
      return;
    }
    
    console.log('\n[INFO] Eliminando mensajes...\n');
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < allMessages.length; i++) {
      const msg = allMessages[i];
      try {
        await client.deleteMessages(targetChat, [msg.id], { revoke: true });
        deletedCount++;
        
        if ((i + 1) % 10 === 0) {
          console.log(`[PROGRESO] Eliminados: ${deletedCount}/${allMessages.length}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        if (error instanceof errors.FloodWaitError) {
          const waitTime = error.seconds;
          console.warn(`[FLOODWAIT] Esperando ${waitTime} segundos...`);
          await new Promise(resolve => setTimeout(resolve, (waitTime + 1) * 1000));
          i--;
          continue;
        } else {
          errorCount++;
          console.error(`[ERROR] No se pudo eliminar mensaje ID ${msg.id}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n[SUCCESS] Proceso completado:`);
    console.log(`  - Mensajes eliminados: ${deletedCount}`);
    console.log(`  - Errores: ${errorCount}`);
    
  } catch (error) {
    console.error('[ERROR] Error al eliminar mensajes:', error.message);
    console.error(error.stack);
  }
}

async function main() {
  console.log('[START] Eliminador de Mensajes Propios\n');

  if (!CONFIG.apiId || !CONFIG.apiHash || !CONFIG.targetChatIdentifier) {
    console.error('[ERROR] Faltan variables de configuración requeridas');
    console.error('   Asegúrate de tener TELEGRAM_API_ID, TELEGRAM_API_HASH y TELEGRAM_TARGET_CHAT en tu .env');
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
      console.error('[ERROR] Sesión no válida. Ejecuta primero el relay para autenticarte.');
      process.exit(1);
    }

    console.log(`[INFO] Resolviendo chat de destino: ${CONFIG.targetChatIdentifier}`);
    const targetChat = await resolveChatIdentifier(client, CONFIG.targetChatIdentifier);
    console.log(`[SUCCESS] Chat de destino resuelto: ${targetChat.title || targetChat.username || 'Chat'}\n`);

    await deleteMyMessages(client, targetChat);
  } catch (error) {
    console.error('[ERROR] Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

main().catch(console.error);
