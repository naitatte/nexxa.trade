import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { errors } from 'telegram';
import { Api } from 'telegram/tl/index.js';
import input from 'input';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG = {
  apiId: parseInt(process.env.TELEGRAM_API_ID),
  apiHash: process.env.TELEGRAM_API_HASH,
  targetChatIdentifier: process.env.TELEGRAM_TARGET_CHAT,
  sessionString: process.env.TELEGRAM_SESSION_STRING || '',
};

function isAudioMessage(msg) {
  if (!msg.media || msg.media.className !== 'MessageMediaDocument') {
    return false;
  }
  
  const doc = msg.media.document;
  if (!doc || !doc.attributes) {
    return false;
  }
  
  const audioAttr = doc.attributes.find(a => a.className === 'DocumentAttributeAudio');
  return !!audioAttr;
}

function getAudioKey(msg) {
  if (!isAudioMessage(msg)) {
    return null;
  }
  
  const doc = msg.media.document;
  const audioAttr = doc.attributes.find(a => a.className === 'DocumentAttributeAudio');
  
  if (!audioAttr) {
    return null;
  }
  
  const duration = audioAttr.duration || 0;
  const isVoice = audioAttr.voice || false;
  const fileSize = doc.size || 0;
  
  return `audio:${isVoice ? 'voice' : 'music'}:${duration}:${fileSize}`;
}

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

async function removeDuplicates(client, targetChat) {
  try {
    console.log('[INFO] Obteniendo mensajes del chat...\n');
    
    const me = await client.getMe();
    console.log(`[INFO] Usuario actual: ${me.firstName} ${me.lastName || ''} (@${me.username || 'sin username'})\n`);
    
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
      
      const myMessages = messages.filter(msg => {
        const senderId = (msg.senderId || msg.fromId?.userId)?.toString();
        return senderId && senderId === me.id.toString();
      });
      
      allMessages.push(...myMessages);
      
      if (messages.length < 100) {
        hasMore = false;
      } else {
        offsetId = messages[messages.length - 1].id;
      }
      
      console.log(`[INFO] Mensajes encontrados hasta ahora: ${allMessages.length}`);
    }
    
    console.log(`\n[INFO] Total de mensajes propios encontrados: ${allMessages.length}\n`);
    
    if (allMessages.length === 0) {
      console.log('[INFO] No hay mensajes propios para analizar.');
      return;
    }
    
    console.log('[INFO] Filtrando solo mensajes de audio...\n');
    
    const audioMessages = allMessages.filter(msg => isAudioMessage(msg));
    
    console.log(`[INFO] Total de mensajes de audio encontrados: ${audioMessages.length}\n`);
    
    if (audioMessages.length === 0) {
      console.log('[INFO] No se encontraron mensajes de audio.');
      return;
    }
    
    console.log('[INFO] Analizando audios duplicados...\n');
    
    const audioGroups = new Map();
    
    for (const msg of audioMessages) {
      const key = getAudioKey(msg);
      if (!key) continue;
      
      if (!audioGroups.has(key)) {
        audioGroups.set(key, []);
      }
      audioGroups.get(key).push(msg);
    }
    
    const duplicates = [];
    
    for (const [key, messages] of audioGroups.entries()) {
      if (messages.length > 1) {
        messages.sort((a, b) => (a.date || 0) - (b.date || 0));
        const oldest = messages[0];
        const duplicatesToDelete = messages.slice(1);
        
        const audioAttr = messages[0].media.document.attributes.find(a => a.className === 'DocumentAttributeAudio');
        const audioType = audioAttr?.voice ? 'Nota de voz' : 'Audio';
        const duration = audioAttr?.duration || 0;
        
        duplicates.push({
          key,
          count: messages.length,
          keep: oldest.id,
          delete: duplicatesToDelete.map(m => m.id),
          type: audioType,
          duration: duration
        });
      }
    }
    
    if (duplicates.length === 0) {
      console.log('[INFO] No se encontraron audios duplicados.');
      return;
    }
    
    console.log(`[INFO] Se encontraron ${duplicates.length} grupos de audios duplicados:\n`);
    
    let totalDuplicates = 0;
    for (const dup of duplicates) {
      totalDuplicates += dup.delete.length;
      const durationStr = dup.duration > 0 ? ` (${dup.duration}s)` : '';
      console.log(`  - ${dup.count} ${dup.type}${durationStr} duplicados`);
      console.log(`    Manteniendo: ID ${dup.keep}, Eliminando: ${dup.delete.length} duplicados\n`);
    }
    
    console.log(`[INFO] Total de audios duplicados a eliminar: ${totalDuplicates}\n`);
    console.log('[WARNING] Se eliminarán los audios duplicados, manteniendo solo el más antiguo de cada grupo.');
    console.log('[WARNING] Esta acción NO se puede deshacer.\n');
    
    const answer = await input.text('¿Continuar? Escribe "SI" para confirmar: ');
    
    if (answer !== 'SI') {
      console.log('[INFO] Operación cancelada.');
      return;
    }
    
    console.log('\n[INFO] Eliminando duplicados...\n');
    
    let deletedCount = 0;
    let errorCount = 0;
    let processed = 0;
    
    for (const dup of duplicates) {
      for (const msgId of dup.delete) {
        try {
          await client.deleteMessages(targetChat, [msgId], { revoke: true });
          deletedCount++;
          processed++;
          
          if (processed % 5 === 0) {
            console.log(`[PROGRESO] Audios eliminados: ${deletedCount}/${totalDuplicates}`);
          }
        } catch (error) {
          if (error instanceof errors.FloodWaitError) {
            const waitTime = error.seconds;
            console.warn(`[FLOODWAIT] Esperando ${waitTime} segundos...`);
            await new Promise(resolve => setTimeout(resolve, (waitTime + 1) * 1000));
            continue;
          } else {
            errorCount++;
            console.error(`[ERROR] No se pudo eliminar mensaje ID ${msgId}: ${error.message}`);
          }
        }
      }
    }
    
    console.log(`\n[SUCCESS] Proceso completado:`);
    console.log(`  - Audios duplicados eliminados: ${deletedCount}`);
    console.log(`  - Errores: ${errorCount}`);
    
  } catch (error) {
    console.error('[ERROR] Error al eliminar duplicados:', error.message);
    console.error(error.stack);
  }
}

async function main() {
  console.log('[START] Eliminador de Audios Duplicados\n');

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

    await removeDuplicates(client, targetChat);
  } catch (error) {
    console.error('[ERROR] Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

main().catch(console.error);
