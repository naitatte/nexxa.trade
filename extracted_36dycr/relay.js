import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage, Raw } from 'telegram/events/index.js';
import { Api } from 'telegram/tl/index.js';
import { errors } from 'telegram';
import { CustomFile } from 'telegram/client/uploads.js';
import input from 'input';
import dotenv from 'dotenv';

dotenv.config();

const messageIdMap = new Map();

const CONFIG = {
  apiId: parseInt(process.env.TELEGRAM_API_ID),
  apiHash: process.env.TELEGRAM_API_HASH,
  phoneNumber: process.env.TELEGRAM_PHONE_NUMBER,
  twoFactorPassword: process.env.TELEGRAM_2FA_PASSWORD,
  sourceChatIdentifier: process.env.TELEGRAM_SOURCE_CHAT,
  targetChatIdentifier: process.env.TELEGRAM_TARGET_CHAT,
  sessionString: process.env.TELEGRAM_SESSION_STRING || '',
};

function validateConfiguration() {
  const required = [
    'apiId',
    'apiHash',
    'phoneNumber',
    'sourceChatIdentifier',
    'targetChatIdentifier',
  ];

  const missing = required.filter(key => !CONFIG[key]);

  if (missing.length > 0) {
    console.error('[ERROR] Faltan variables de configuración requeridas:');
    missing.forEach(key => console.error(`   - ${key.toUpperCase()}`));
    console.error('\nPor favor, revisa tu archivo .env');
    process.exit(1);
  }
}

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

  const sessionString = client.session.save();
  console.log('\n[SUCCESS] Autenticación exitosa');
  console.log('\n[INFO] Copia esta sesión y pégalo en tu archivo .env:');
  console.log('─'.repeat(60));
  console.log(`TELEGRAM_SESSION_STRING=${sessionString}`);
  console.log('─'.repeat(60));
  console.log('\n[WARNING] Guarda esta sesión de forma segura. Con ella no necesitarás autenticarte de nuevo.\n');

  return sessionString;
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
        `No se pudo encontrar el chat con ID "${identifier}" en tus diálogos.\n` +
        `Posibles causas:\n` +
        `  - No tienes acceso al chat/grupo/canal\n` +
        `  - El ID es incorrecto\n` +
        `  - El chat fue eliminado o no existe\n\n` +
        `Solución: Ejecuta "npm run list-chats" para ver todos tus chats disponibles y copia el ID correcto.`
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

async function copyMessage(client, message, targetChat, retryCount = 0) {
  if (!client.connected) {
    console.log('[WARN] Cliente desconectado durante copyMessage, esperando reconexión...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (!client.connected && retryCount < 2) {
      return copyMessage(client, message, targetChat, retryCount + 1);
    }
    return null;
  }

  const messageText = message.rawText || message.message || '';
  let messageEntities = message.entities || [];
  
  if ((!messageEntities || messageEntities.length === 0) && message.id && message.peerId) {
    try {
      const fullMessage = await client.getMessages(message.peerId, { ids: [message.id] });
      if (fullMessage.length > 0 && fullMessage[0].entities && fullMessage[0].entities.length > 0) {
        messageEntities = fullMessage[0].entities;
      }
    } catch (e) {
    }
  }
  
  let messagePreview = '[Medios]';
  if (messageText) {
    const text = messageText.trim();
    messagePreview = text.length > 50 ? `${text.substring(0, 50).trim()}...` : text;
  }

  try {
    if (!messageText && !message.media) {
      return null;
    }

    const messageOptions = {
      message: messageText || '',
    };

    if (message.media) {
      if (message.media.className === 'MessageMediaWebPage') {
        messageOptions.linkPreview = true;
      } else {
        try {
          const buffer = await client.downloadMedia(message.media, {});
          
          if (buffer && Buffer.isBuffer(buffer)) {
            let fileName = 'photo.jpg';
            let attributes = [];
            
            if (message.media.className === 'MessageMediaPhoto') {
              fileName = 'photo.jpg';
            } else if (message.media.className === 'MessageMediaDocument') {
              const doc = message.media.document;
              if (doc && doc.attributes) {
                const audioAttr = doc.attributes.find(attr => attr.className === 'DocumentAttributeAudio');
                if (audioAttr && audioAttr.voice) {
                  fileName = 'voice.ogg';
                  messageOptions.voiceNote = true;
                  if (audioAttr.duration) {
                    attributes.push(new Api.DocumentAttributeAudio({
                      voice: true,
                      duration: audioAttr.duration,
                      waveform: audioAttr.waveform
                    }));
                  }
                } else if (audioAttr) {
                  fileName = 'audio.mp3';
                  attributes.push(new Api.DocumentAttributeAudio({
                    duration: audioAttr.duration || 0,
                    title: audioAttr.title,
                    performer: audioAttr.performer
                  }));
                }
                
                const videoAttr = doc.attributes.find(attr => attr.className === 'DocumentAttributeVideo');
                if (videoAttr) {
                  if (videoAttr.roundMessage) {
                    messageOptions.videoNote = true;
                  }
                  attributes.push(new Api.DocumentAttributeVideo({
                    duration: videoAttr.duration || 0,
                    w: videoAttr.w || 0,
                    h: videoAttr.h || 0,
                    roundMessage: videoAttr.roundMessage,
                    supportsStreaming: videoAttr.supportsStreaming
                  }));
                }
                
                const fileNameAttr = doc.attributes.find(attr => attr.className === 'DocumentAttributeFilename');
                if (fileNameAttr && fileNameAttr.fileName) {
                  fileName = fileNameAttr.fileName;
                }
              }
            }
            
            messageOptions.file = new CustomFile(fileName, buffer.length, undefined, buffer);
            if (attributes.length > 0) {
              messageOptions.attributes = attributes;
            }
          } else if (buffer) {
            messageOptions.file = buffer;
          }
        } catch (downloadError) {
          console.warn(`[WARN] No se pudo descargar media, enviando solo texto`);
        }
      }
    }

    if (messageEntities && messageEntities.length > 0) {
      messageOptions.formattingEntities = messageEntities;
    }

    const sentMessage = await client.sendMessage(targetChat, messageOptions);
    console.log(`[SUCCESS] Mensaje copiado: ${messagePreview}`);
    
    if (message.id && sentMessage?.id) {
      messageIdMap.set(message.id.toString(), sentMessage.id);
    }
    
    return sentMessage?.id || true;
  } catch (error) {
    if (error instanceof errors.FloodWaitError) {
      const waitTime = error.seconds;
      console.warn(`[FLOODWAIT] Esperando ${waitTime} segundos...`);
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      return copyMessage(client, message, targetChat, retryCount + 1);
    } else if (error.message?.includes('disconnect') || error.message?.includes('connection') || !client.connected) {
      if (retryCount < 2) {
        console.log('[WARN] Error de conexión durante copyMessage, reintentando...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return copyMessage(client, message, targetChat, retryCount + 1);
      }
    } else if (retryCount < 2) {
      return copyMessage(client, message, targetChat, retryCount + 1);
    } else {
      if (messageText && message.media) {
        try {
          await client.sendMessage(targetChat, { 
            message: messageText,
            formattingEntities: messageEntities.length > 0 ? messageEntities : undefined
          });
          console.log(`[SUCCESS] Mensaje copiado (solo texto): ${messagePreview}`);
          return true;
        } catch (textError) {
          console.error('[ERROR] Error al copiar mensaje:', error.message);
        }
      }
      return false;
    }
  }
}

async function editMessage(client, message, targetChat, targetMessageId) {
  if (!client.connected) {
    console.log('[WARN] Cliente desconectado durante editMessage');
    return false;
  }

  const messageText = message.rawText || message.message || '';
  let messageEntities = message.entities || [];
  
  if ((!messageEntities || messageEntities.length === 0) && message.id && message.peerId) {
    try {
      const fullMessage = await client.getMessages(message.peerId, { ids: [message.id] });
      if (fullMessage.length > 0 && fullMessage[0].entities && fullMessage[0].entities.length > 0) {
        messageEntities = fullMessage[0].entities;
      }
    } catch (e) {
    }
  }
  
  let messagePreview = '[Medios]';
  if (messageText) {
    const text = messageText.trim();
    messagePreview = text.length > 50 ? `${text.substring(0, 50).trim()}...` : text;
  }

  try {
    const editOptions = {
      message: targetMessageId,
      text: messageText,
    };
    
    if (messageEntities && messageEntities.length > 0) {
      editOptions.formattingEntities = messageEntities;
    }
    
    await client.editMessage(targetChat, editOptions);
    console.log(`[SUCCESS] Mensaje editado: ${messagePreview}`);
    return true;
  } catch (error) {
    if (error.message?.includes('MESSAGE_NOT_MODIFIED') || error.message?.includes('not modified')) {
      return true;
    }
    if (error.message?.includes('disconnect') || error.message?.includes('connection')) {
      console.error(`[ERROR] Error de conexión al editar mensaje: ${error.message}`);
    } else {
      console.error(`[ERROR] No se pudo editar mensaje: ${error.message}`);
    }
    return false;
  }
}

async function handleNewMessage(event, client, targetChat) {
  const message = event.message;

  if (message.editDate) {
    return;
  }

  const messageType = message.media ? '[Medios]' : '[Texto]';
  console.log(`[MESSAGE] Nuevo mensaje recibido ${messageType}`);

  await copyMessage(client, message, targetChat);
}

async function deleteMessage(client, targetChat, targetMessageId) {
  if (!client.connected) {
    console.log('[WARN] Cliente desconectado durante deleteMessage');
    return false;
  }

  try {
    await client.deleteMessages(targetChat, [targetMessageId], { revoke: true });
    console.log(`[SUCCESS] Mensaje eliminado en destino (ID: ${targetMessageId})`);
    return true;
  } catch (error) {
    if (error.message?.includes('disconnect') || error.message?.includes('connection')) {
      console.error(`[ERROR] Error de conexión al eliminar mensaje: ${error.message}`);
    } else {
      console.error(`[ERROR] No se pudo eliminar mensaje: ${error.message}`);
    }
    return false;
  }
}

async function handleDeletedMessages(update, client, targetChat, sourceChatId) {
  try {
    const channelId = update.channelId?.toString();
    const chatId = update.chatId?.toString() || update.peerId?.chatId?.toString();
    const updateChatId = channelId || chatId;
    
    if (!updateChatId || updateChatId !== sourceChatId) return;
    
    const deletedIds = update.messages || [];
    
    for (const sourceMessageId of deletedIds) {
      const sourceIdStr = sourceMessageId.toString();
      const targetMessageId = messageIdMap.get(sourceIdStr);
      
      if (targetMessageId) {
        console.log(`[DELETE] Mensaje eliminado detectado en origen (ID: ${sourceIdStr})`);
        await deleteMessage(client, targetChat, targetMessageId);
        messageIdMap.delete(sourceIdStr);
      }
    }
  } catch (error) {
    console.error('[ERROR] Error en handleDeletedMessages:', error.message);
  }
}

async function handleEditedMessage(update, client, targetChat, sourceChatId) {
  try {
    const message = update.message;
    if (!message || !message.id) return;
    
    const messageChatId = (
      message.peerId?.channelId || 
      message.peerId?.chatId
    )?.toString();
    
    if (!messageChatId || messageChatId !== sourceChatId) return;
    
    const sourceMessageId = message.id?.toString();
    const targetMessageId = messageIdMap.get(sourceMessageId);
    
    if (!targetMessageId) {
      return;
    }
    
    const messageText = message.rawText || message.message || '';
    const messagePreview = messageText.substring(0, 50);
    console.log(`[EDIT] Mensaje editado detectado (ID: ${sourceMessageId}): ${messagePreview}...`);
    
    await editMessage(client, message, targetChat, targetMessageId);
  } catch (error) {
    console.error('[ERROR] Error en handleEditedMessage:', error.message);
  }
}

async function syncTodayMessages(client, sourceChat, targetChat, myUserId = null) {
  try {
    if (!client.connected) {
      console.log('[WARN] Cliente desconectado durante syncTodayMessages, omitiendo sincronización');
      return;
    }

    console.log('[INFO] Sincronizando mensajes de hoy...\n');
    
    if (!myUserId) {
      try {
        const me = await client.getMe();
        myUserId = me.id?.toString();
      } catch (e) {
        console.log('[WARN] No se pudo obtener ID de usuario');
        if (e.message?.includes('disconnect') || e.message?.includes('connection')) {
          throw e;
        }
      }
    }
    
    const now = Math.floor(Date.now() / 1000);
    const hours24Ago = now - (24 * 60 * 60);
    
    console.log(`[DEBUG] Ahora (UTC): ${new Date(now * 1000).toISOString()}`);
    console.log(`[DEBUG] Hace 24 horas: ${new Date(hours24Ago * 1000).toISOString()}`);
    console.log(`[DEBUG] Buscando mensajes desde: ${hours24Ago} hasta: ${now}\n`);
    
    const sourceMessages = await client.getMessages(sourceChat, {
      limit: 200,
    });
    
    console.log(`[DEBUG] Mensajes obtenidos del origen: ${sourceMessages.length}`);
    
    if (sourceMessages.length > 0) {
      const firstMsg = sourceMessages[0];
      const lastMsg = sourceMessages[sourceMessages.length - 1];
      console.log(`[DEBUG] Primer mensaje - ID: ${firstMsg.id}, Date: ${firstMsg.date}, Texto: ${(firstMsg.text || '').substring(0, 30)}`);
      console.log(`[DEBUG] Último mensaje - ID: ${lastMsg.id}, Date: ${lastMsg.date}, Texto: ${(lastMsg.text || '').substring(0, 30)}`);
      if (firstMsg.date) {
        console.log(`[DEBUG] Fecha primer mensaje: ${new Date(firstMsg.date * 1000).toISOString()}`);
      }
      if (lastMsg.date) {
        console.log(`[DEBUG] Fecha último mensaje: ${new Date(lastMsg.date * 1000).toISOString()}`);
      }
    }
    
    const recentSourceMessages = sourceMessages.filter(msg => {
      if (!msg.date) {
        console.log(`[DEBUG] Mensaje sin fecha - ID: ${msg.id}, Texto: ${(msg.text || '').substring(0, 30)}`);
        return false;
      }
      return msg.date >= hours24Ago;
    });
    
    console.log(`[DEBUG] Mensajes de las últimas 24h en origen: ${recentSourceMessages.length}`);
    
    recentSourceMessages.forEach((msg, idx) => {
      const text = (msg.text || msg.rawText || '').trim();
      const hasMedia = !!msg.media;
      const hasReply = !!msg.replyTo;
      console.log(`[DEBUG] Mensaje ${idx + 1} - ID: ${msg.id}, Texto: ${text.substring(0, 40)}, Media: ${hasMedia}, Reply: ${hasReply}`);
    });
    console.log();
    
    const targetMessages = await client.getMessages(targetChat, {
      limit: 200,
    });
    
    console.log(`[DEBUG] Mensajes obtenidos del destino: ${targetMessages.length}`);
    
    const recentTargetMessages = targetMessages.filter(msg => {
      if (!msg.date) return false;
      return msg.date >= hours24Ago;
    });
    
    console.log(`[DEBUG] Mensajes de las últimas 24h en destino: ${recentTargetMessages.length}\n`);
    
    const getMediaKey = (msg) => {
      if (!msg.media) return null;
      if (msg.media.className === 'MessageMediaWebPage') return null;
      const doc = msg.media.document;
      if (doc) {
        const audioAttr = doc.attributes?.find(a => a.className === 'DocumentAttributeAudio');
        const videoAttr = doc.attributes?.find(a => a.className === 'DocumentAttributeVideo');
        if (audioAttr?.voice) return `voice:${audioAttr.duration || 0}`;
        if (videoAttr?.roundMessage) return `videonote:${videoAttr.duration || 0}`;
        if (audioAttr) return `audio:${audioAttr.duration || 0}`;
        if (videoAttr) return `video:${videoAttr.duration || 0}`;
        return `doc:${doc.size || 0}`;
      }
      if (msg.media.photo) return `photo:${msg.media.photo.id || 0}`;
      return `media:${msg.date || 0}`;
    };

    const hasRealMedia = (msg) => {
      return !!msg.media && msg.media.className !== 'MessageMediaWebPage';
    };

    const targetMessageKeys = new Set();
    const targetMediaKeys = new Map();
    recentTargetMessages.forEach(msg => {
      const text = (msg.text || msg.rawText || '').trim();
      const hasMedia = hasRealMedia(msg);
      
      if (text) {
        const normalizedText = text.substring(0, 200).trim();
        if (normalizedText) {
          targetMessageKeys.add(`text:${normalizedText}`);
        }
      }
      if (hasMedia && text) {
        const normalizedText = text.substring(0, 200).trim();
        if (normalizedText) {
          targetMessageKeys.add(`media+text:${normalizedText}`);
        }
      } else if (hasMedia && !text) {
        const mediaKey = getMediaKey(msg);
        if (mediaKey) {
          targetMediaKeys.set(mediaKey, (targetMediaKeys.get(mediaKey) || 0) + 1);
        }
      }
    });
    
    console.log(`[DEBUG] Mensajes únicos en destino: ${targetMessageKeys.size}\n`);
    
    const sourceMessageKeys = new Set();
    const sourceMediaKeys = new Map();
    recentSourceMessages.forEach(msg => {
      const text = (msg.text || msg.rawText || '').trim();
      const hasMedia = hasRealMedia(msg);
      const normalizedText = text.substring(0, 200).trim();
      
      if (text) {
        sourceMessageKeys.add(`text:${normalizedText}`);
      }
      if (hasMedia && text) {
        sourceMessageKeys.add(`media+text:${normalizedText}`);
      }
      if (hasMedia && !text) {
        const mediaKey = getMediaKey(msg);
        if (mediaKey) {
          sourceMediaKeys.set(mediaKey, (sourceMediaKeys.get(mediaKey) || 0) + 1);
        }
      }
    });
    
    let deletedCount = 0;
    for (const targetMsg of recentTargetMessages) {
      const msgSenderId = (targetMsg.senderId || targetMsg.fromId?.userId)?.toString();
      if (myUserId && msgSenderId !== myUserId) {
        continue;
      }
      
      const text = (targetMsg.text || targetMsg.rawText || '').trim();
      const hasMedia = hasRealMedia(targetMsg);
      const normalizedText = text.substring(0, 200).trim();
      
      let shouldDelete = false;
      
      if (hasMedia && normalizedText) {
        shouldDelete = !sourceMessageKeys.has(`media+text:${normalizedText}`) && !sourceMessageKeys.has(`text:${normalizedText}`);
      } else if (normalizedText) {
        shouldDelete = !sourceMessageKeys.has(`text:${normalizedText}`) && !sourceMessageKeys.has(`media+text:${normalizedText}`);
      }
      
      if (shouldDelete && normalizedText) {
        const preview = normalizedText.substring(0, 50);
        console.log(`[DELETE-SYNC] Eliminando mensaje huérfano del destino: ${preview}...`);
        try {
          await client.deleteMessages(targetChat, [targetMsg.id], { revoke: true });
          deletedCount++;
        } catch (delErr) {
          console.error(`[ERROR] No se pudo eliminar mensaje huérfano: ${delErr.message}`);
        }
      }
    }
    
    if (deletedCount > 0) {
      console.log(`[INFO] Mensajes huérfanos eliminados: ${deletedCount}\n`);
    }
    
    let syncedCount = 0;
    let skippedCount = 0;
    
    const mediaCountTracker = new Map(targetMediaKeys);
    
    const sortedSourceMessages = [...recentSourceMessages].sort((a, b) => (a.date || 0) - (b.date || 0));
    
    for (const sourceMsg of sortedSourceMessages) {
      const sourceText = (sourceMsg.text || sourceMsg.rawText || '').trim();
      const normalizedSourceText = sourceText.substring(0, 200).trim();
      const hasMedia = hasRealMedia(sourceMsg);
      const sourceMsgId = sourceMsg.id?.toString() || '';
      
      let shouldSync = false;
      
      if (hasMedia && normalizedSourceText) {
        shouldSync = !targetMessageKeys.has(`media+text:${normalizedSourceText}`);
      } else if (hasMedia && !normalizedSourceText) {
        const mediaKey = getMediaKey(sourceMsg);
        const targetCount = mediaCountTracker.get(mediaKey) || 0;
        if (targetCount > 0) {
          mediaCountTracker.set(mediaKey, targetCount - 1);
          shouldSync = false;
        } else {
          shouldSync = true;
        }
      } else if (normalizedSourceText) {
        shouldSync = !targetMessageKeys.has(`text:${normalizedSourceText}`);
      }
      
      if (shouldSync) {
        const preview = normalizedSourceText ? normalizedSourceText.substring(0, 50) : (hasMedia ? '[Medios]' : '[Sin texto]');
        console.log(`[SYNC] Copiando mensaje pendiente (ID: ${sourceMsgId}): ${preview}...`);
        
        const targetMsgId = await copyMessage(client, sourceMsg, targetChat);
        if (targetMsgId && sourceMsgId) {
          messageIdMap.set(sourceMsgId, targetMsgId);
        }
        syncedCount++;
      } else {
        skippedCount++;
        const preview = normalizedSourceText ? normalizedSourceText.substring(0, 30) : (hasMedia ? '[Medios]' : '[Sin texto]');
        console.log(`[SKIP] Mensaje ya existe (ID: ${sourceMsgId}): ${preview}...`);
      }
    }
    
    console.log(`\n[SUCCESS] Sincronización completada:`);
    console.log(`  - Mensajes copiados: ${syncedCount}`);
    console.log(`  - Mensajes ya existentes: ${skippedCount}`);
    console.log(`  - Mensajes huérfanos eliminados: ${deletedCount}\n`);
  } catch (error) {
    if (error.message?.includes('disconnect') || error.message?.includes('connection') || !client.connected) {
      console.error('[ERROR] Error de conexión durante sincronización:', error.message);
      throw error;
    } else {
      console.error('[ERROR] Error al sincronizar mensajes:', error.message);
      console.error('[ERROR] Stack:', error.stack);
    }
  }
}

let sourceChat = null;
let targetChat = null;
let myUserId = null;
let sourceChatId = null;
let isReconnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000;

async function ensureConnection(client) {
  if (client.connected) {
    try {
      await client.getMe();
      return true;
    } catch (error) {
      console.log('[WARN] Conexión inactiva detectada, reconectando...');
      return false;
    }
  }
  return false;
}

async function reconnectClient(client) {
  if (isReconnecting) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return client.connected;
  }

  isReconnecting = true;
  reconnectAttempts++;

  if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
    console.error('[ERROR] Máximo de intentos de reconexión alcanzado. Reiniciando aplicación...');
    isReconnecting = false;
    reconnectAttempts = 0;
    process.exit(1);
  }

  try {
    const delay = Math.min(RECONNECT_DELAY * reconnectAttempts, 30000);
    console.log(`[RECONNECT] Intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} de reconexión (esperando ${delay/1000}s)...`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    if (client.connected) {
      try {
        await client.disconnect();
      } catch (e) {
      }
    }

    await client.connect();
    
    if (!(await client.checkAuthorization())) {
      console.log('[WARNING] Sesión no válida después de reconexión. Reautenticando...');
      await authenticateUser(client);
    }

    const isConnected = await ensureConnection(client);
    
    if (isConnected) {
      console.log('[SUCCESS] Reconexión exitosa');
      reconnectAttempts = 0;
      isReconnecting = false;
      return true;
    } else {
      throw new Error('Conexión no válida después de reconectar');
    }
  } catch (error) {
    console.error(`[ERROR] Error en reconexión: ${error.message}`);
    isReconnecting = false;
    
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      setTimeout(async () => {
        await reconnectClient(client);
      }, RECONNECT_DELAY);
    }
    
    return false;
  }
}

async function setupEventHandlers(client) {
  client.addEventHandler(
    async (event) => {
      try {
        if (!(await ensureConnection(client))) {
          await reconnectClient(client);
          return;
        }

        const message = event.message;
        if (!message) return;
        
        const messageChatId = (
          message.peerId?.channelId || 
          message.peerId?.chatId || 
          message.peerId?.userId
        )?.toString();
        
        if (messageChatId === sourceChatId) {
          await handleNewMessage(event, client, targetChat);
        }
      } catch (error) {
        console.error('[ERROR] Error al procesar nuevo mensaje:', error.message);
        if (error.message?.includes('disconnect') || error.message?.includes('connection')) {
          await reconnectClient(client);
        }
      }
    },
    new NewMessage({})
  );

  client.addEventHandler(
    async (update) => {
      try {
        if (!(await ensureConnection(client))) {
          await reconnectClient(client);
          return;
        }

        if (!update || typeof update.className !== 'string') return;
        
        if (update.className === 'UpdateEditChannelMessage' || update.className === 'UpdateEditMessage') {
          if (update.message) {
            await handleEditedMessage(update, client, targetChat, sourceChatId);
          }
        }
      } catch (error) {
        if (error.message && !error.message.includes('MESSAGE_NOT_MODIFIED')) {
          console.error('[ERROR] Error al procesar edición:', error.message);
          if (error.message?.includes('disconnect') || error.message?.includes('connection')) {
            await reconnectClient(client);
          }
        }
      }
    },
    new Raw({ types: [Api.UpdateEditChannelMessage, Api.UpdateEditMessage] })
  );

  client.addEventHandler(
    async (update) => {
      try {
        if (!(await ensureConnection(client))) {
          await reconnectClient(client);
          return;
        }

        if (!update || typeof update.className !== 'string') return;
        
        if (update.className === 'UpdateDeleteChannelMessages' || update.className === 'UpdateDeleteMessages') {
          await handleDeletedMessages(update, client, targetChat, sourceChatId);
        }
      } catch (error) {
        console.error('[ERROR] Error al procesar eliminación:', error.message);
        if (error.message?.includes('disconnect') || error.message?.includes('connection')) {
          await reconnectClient(client);
        }
      }
    },
    new Raw({ types: [Api.UpdateDeleteChannelMessages, Api.UpdateDeleteMessages] })
  );
}

async function main() {
  console.log('[START] Iniciando Telegram Relay...\n');

  validateConfiguration();

  const client = new TelegramClient(
    new StringSession(CONFIG.sessionString),
    CONFIG.apiId,
    CONFIG.apiHash,
    {
      connectionRetries: 5,
      autoReconnect: true,
      retryDelay: 3000,
    }
  );

  client.addEventHandler(
    async () => {
      console.log('[WARN] Desconexión detectada, iniciando reconexión...');
      setTimeout(async () => {
        await reconnectClient(client);
      }, RECONNECT_DELAY);
    },
    new Raw({ types: [Api.UpdatesTooLong] })
  );

  try {
    await client.connect();
    console.log('[SUCCESS] Conectado a Telegram\n');

    if (!CONFIG.sessionString) {
      await authenticateUser(client);
    } else {
      if (!(await client.checkAuthorization())) {
        console.log('[WARNING] La sesión guardada no es válida. Reautenticando...\n');
        await authenticateUser(client);
      } else {
        console.log('[SUCCESS] Sesión válida encontrada\n');
      }
    }

    console.log(`[INFO] Resolviendo chat de origen: ${CONFIG.sourceChatIdentifier}`);
    sourceChat = await resolveChatIdentifier(client, CONFIG.sourceChatIdentifier);
    console.log(`[SUCCESS] Chat de origen resuelto: ${sourceChat.title || sourceChat.username || 'Chat'}\n`);

    console.log(`[INFO] Resolviendo chat de destino: ${CONFIG.targetChatIdentifier}`);
    targetChat = await resolveChatIdentifier(client, CONFIG.targetChatIdentifier);
    console.log(`[SUCCESS] Chat de destino resuelto: ${targetChat.title || targetChat.username || 'Chat'}\n`);

    const me = await client.getMe();
    myUserId = me.id?.toString();
    console.log(`[INFO] Mi ID de usuario: ${myUserId}\n`);

    await syncTodayMessages(client, sourceChat, targetChat, myUserId);

    if (!(await ensureConnection(client))) {
      await reconnectClient(client);
    }

    console.log('[INFO] Escuchando nuevos mensajes y ediciones...\n');
    console.log('─'.repeat(60));
    console.log(`Origen: ${sourceChat.title || sourceChat.username || CONFIG.sourceChatIdentifier}`);
    console.log(`Destino: ${targetChat.title || targetChat.username || CONFIG.targetChatIdentifier}`);
    console.log('─'.repeat(60));
    console.log('\n[INFO] Relay activo (mensajes nuevos + ediciones + eliminaciones + sync cada 30s + heartbeat cada 60s). Presiona Ctrl+C para detener.\n');

    sourceChatId = sourceChat.id?.toString();

    await setupEventHandlers(client);

    console.log('[INFO] Esperando mensajes... (Presiona Ctrl+C para detener)');

    const heartbeatInterval = setInterval(async () => {
      try {
        if (!(await ensureConnection(client))) {
          console.log('[HEARTBEAT] Conexión perdida, reconectando...');
          await reconnectClient(client);
        } else {
          reconnectAttempts = 0;
        }
      } catch (error) {
        console.error('[ERROR] Error en heartbeat:', error.message);
        await reconnectClient(client);
      }
    }, 60000);

    const syncInterval = setInterval(async () => {
      try {
        if (!(await ensureConnection(client))) {
          console.log('[SYNC] Conexión perdida durante sync, reconectando...');
          await reconnectClient(client);
          return;
        }

        console.log('\n[SYNC] Verificando sincronización...');
        await syncTodayMessages(client, sourceChat, targetChat, myUserId);
      } catch (error) {
        console.error('[ERROR] Error en sincronización periódica:', error.message);
        if (error.message?.includes('disconnect') || error.message?.includes('connection') || !client.connected) {
          await reconnectClient(client);
        }
      }
    }, 30000);
    
    const gracefulShutdown = async (signal) => {
      clearInterval(syncInterval);
      clearInterval(heartbeatInterval);
      console.log(`\n[INFO] Señal ${signal} recibida. Deteniendo relay...`);
      try {
        await client.disconnect();
        console.log('[SUCCESS] Cliente desconectado correctamente');
      } catch (error) {
        console.error('[ERROR] Error al desconectar:', error.message);
      }
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    await new Promise(() => {});
  } catch (error) {
    console.error('[ERROR] Error fatal:', error.message);
    console.error(error.stack);
    try {
      await client.disconnect();
    } catch (disconnectError) {
    }
    process.exit(1);
  }
}

main().catch(console.error);
