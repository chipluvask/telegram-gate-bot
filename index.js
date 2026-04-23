require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Telegraf, Markup, Input } = require('telegraf');
const BANNED_WORDS = require('./banned-words.json');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const CHANNEL_URL = process.env.CHANNEL_URL || 'https://t.me/+cShBQFBp9uRiMTY1';
const GROUP_URL = process.env.GROUP_URL || 'https://t.me/+jJRAa8yuampkMDBl';
const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || '';
const GROUP_USERNAME = process.env.GROUP_USERNAME || '';
const ADMIN_1 = process.env.ADMIN_1 || '@deplaoreal';
const ADMIN_2 = process.env.ADMIN_2 || '@Otdoreal';

if (!BOT_TOKEN) {
  throw new Error('Thiếu BOT_TOKEN trong biến môi trường');
}

const QR_PATH = path.join(__dirname, 'qr-sacombank.jpg');
const HAS_QR = fs.existsSync(QR_PATH);

const bot = new Telegraf(BOT_TOKEN);

const adminCache = new Map();
const ADMIN_CACHE_TTL = 5 * 60 * 1000;

function inviteUrl(link, username) {
  if (username) return `https://t.me/${String(username).replace('@', '')}`;
  return link;
}

function adminUrl(username) {
  return `https://t.me/${String(username).replace('@', '')}`;
}

function isPrivateChat(ctx) {
  return ctx.chat?.type === 'private';
}

function isGroupChat(ctx) {
  return ['group', 'supergroup'].includes(ctx.chat?.type);
}

function startKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('☕ Mời tôi ly cà phê', 'show_coffee')],
    [Markup.button.url('💬 Liên hệ admin 1', adminUrl(ADMIN_1))],
    [Markup.button.url('💬 Liên hệ admin 2', adminUrl(ADMIN_2))]
  ]);
}

function adminKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.url('💬 Liên hệ admin 1', adminUrl(ADMIN_1))],
    [Markup.button.url('💬 Liên hệ admin 2', adminUrl(ADMIN_2))]
  ]);
}

function startMessage() {
  const channelLink = `<a href="${inviteUrl(CHANNEL_URL, CHANNEL_USERNAME)}">Channel ở đây nè</a>`;
  const groupLink = `<a href="${inviteUrl(GROUP_URL, GROUP_USERNAME)}">Group ở đây luôn</a>`;

  return [
    'Ê, chào bạn 👋',
    '',
    'Muốn vào chơi thì xem 2 chỗ bên dưới nha. Bot không khó tính, chỉ hơi thích chỉ đường thôi.',
    '',
    `1. ${channelLink}`,
    `2. ${groupLink}`,
    '',
    'Cần giao dịch trung gian thì bấm liên hệ admin bên dưới, phí 10k/lượt.'
  ].join('\n');
}

function adminCaption() {
  return [
    '🤝 Cần giao dịch trung gian thì liên hệ 1 trong 2 admin bên dưới.',
    'Phí trung gian: 10k/lượt.',
    '',
    'Bấm vào nút bên dưới để mở chat nha.'
  ].join('\n');
}

function coffeeCaption() {
  return [
    '☕ Vào đến đây là có duyên với bot rồi đó.',
    '',
    'Nếu thấy bot hữu ích thì mời tôi ly cà phê nhé, bot biết ơn theo kiểu rất dễ thương luôn 😌'
  ].join('\n');
}

function normalizeText(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function hasBannedWord(text = '') {
  const normalized = normalizeText(text);
  return BANNED_WORDS.some((word) => normalized.includes(normalizeText(word)));
}

function hasTelegramLinkEntity(msg = {}) {
  const entities = [
    ...(msg.entities || []),
    ...(msg.caption_entities || [])
  ];

  return entities.some((entity) =>
    ['url', 'text_link', 'mention', 'text_mention'].includes(entity.type)
  );
}

function hasLink(text = '', msg = {}) {
  const value = String(text).toLowerCase();

  const urlRegex =
    /(https?:\/\/\S+)|(www\.\S+)|(t\.me\/\S+)|(telegram\.me\/\S+)/i;

  const domainRegex =
    /\b[a-z0-9-]+\.(com|net|org|io|me|vn|xyz|cc|gg|co)\b/i;

  return urlRegex.test(value) || domainRegex.test(value) || hasTelegramLinkEntity(msg);
}

function warningText(reason = 'nội dung không phù hợp') {
  const lines = {
    link: 'Link này bot xin giữ ngoài cửa nha 😌',
    banned: 'Từ này hơi gắt, bot cất giúp rồi nhé.',
    both: 'Nhóm mình nói chuyện xinh thôi, đừng làm bot khó xử 🥹'
  };

  return lines[reason] || 'Nhóm mình nói chuyện xinh thôi, đừng làm bot khó xử 🥹';
}

async function sendCoffee(ctx, text = coffeeCaption()) {
  if (HAS_QR) {
    return ctx.replyWithPhoto(Input.fromLocalFile(QR_PATH), {
      caption: text,
      reply_markup: adminKeyboard().reply_markup
    });
  }

  return ctx.reply(text, adminKeyboard());
}

function getAdminCacheKey(chatId, userId) {
  return `${chatId}:${userId}`;
}

async function isUserAdmin(ctx, userId) {
  const chatId = ctx.chat?.id;
  if (!chatId || !userId) return false;

  const cacheKey = getAdminCacheKey(chatId, userId);
  const cached = adminCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < ADMIN_CACHE_TTL) {
    return cached.isAdmin;
  }

  const member = await ctx.telegram.getChatMember(chatId, userId);
  const isAdmin = ['creator', 'administrator'].includes(member.status);

  adminCache.set(cacheKey, {
    isAdmin,
    timestamp: Date.now()
  });

  return isAdmin;
}

async function safeDeleteMessage(ctx, chatId, messageId) {
  try {
    await ctx.telegram.deleteMessage(chatId, messageId);
    return true;
  } catch (e) {
    console.error('Delete message failed:', e.response?.description || e.message);
    return false;
  }
}

bot.start(async (ctx) => {
  if (!isPrivateChat(ctx)) return;

  try {
    await ctx.reply(startMessage(), {
      parse_mode: 'HTML',
      ...startKeyboard()
    });

    await sendCoffee(ctx);
  } catch (e) {
    console.error('/start failed:', e.response?.description || e.message);
  }
});

bot.action('show_coffee', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    if (!isPrivateChat(ctx)) return;
    await sendCoffee(ctx);
  } catch (e) {
    console.error('show_coffee failed:', e.response?.description || e.message);
  }
});

bot.command('coffee', async (ctx) => {
  if (!isPrivateChat(ctx)) return;

  try {
    await sendCoffee(ctx);
  } catch (e) {
    console.error('/coffee failed:', e.response?.description || e.message);
  }
});

bot.command('admins', async (ctx) => {
  if (!isPrivateChat(ctx)) return;

  try {
    await ctx.reply(adminCaption(), adminKeyboard());
  } catch (e) {
    console.error('/admins failed:', e.response?.description || e.message);
  }
});

bot.command('ping', async (ctx) => {
  try {
    console.log('PING CMD:', ctx.chat?.id, ctx.chat?.type);
    await ctx.reply(`pong: ${ctx.chat?.type}`);
  } catch (e) {
    console.error('/ping failed:', e.response?.description || e.message);
  }
});

bot.on('text', async (ctx, next) => {
  if (!isPrivateChat(ctx)) return next();
  if (ctx.message?.text?.startsWith('/')) return next();

  try {
    return await ctx.reply('Chọn nút bên dưới nha 👇', startKeyboard());
  } catch (e) {
    console.error('Private text reply failed:', e.response?.description || e.message);
  }
});

bot.on('message', async (ctx) => {
  const msg = ctx.message;
  const chatType = ctx.chat?.type;

  console.log(
    'New message:',
    ctx.chat?.id,
    chatType,
    msg?.from?.id,
    msg?.from?.username,
    msg?.text || msg?.caption || '[non-text]'
  );

  if (!isGroupChat(ctx)) return;
  if (!msg) return;
  if (msg.from?.is_bot) return;

  const text = msg.text || msg.caption || '';

  if (!text && !hasTelegramLinkEntity(msg)) {
    console.log('Skip: no text and no link entity');
    return;
  }

  try {
    const isAdmin = await isUserAdmin(ctx, msg.from.id);

    if (isAdmin) {
      console.log('Skip admin message');
      return;
    }
  } catch (e) {
    console.error('Check admin status failed:', e.response?.description || e.message);
    return;
  }

  const isLink = hasLink(text, msg);
  const isBanned = hasBannedWord(text);

  console.log('Moderation check:', {
    text,
    isLink,
    isBanned,
    entities: msg.entities || msg.caption_entities || []
  });

  if (!isLink && !isBanned) {
    console.log('Skip: not violating');
    return;
  }

  const reason = isLink && isBanned ? 'both' : isLink ? 'link' : 'banned';

  try {
    const deleted = await safeDeleteMessage(ctx, ctx.chat.id, msg.message_id);
    if (!deleted) return;

    console.log('Deleted message:', msg.message_id);

    const notice = await ctx.reply(warningText(reason));
    console.log('Sent notice:', notice.message_id);

    setTimeout(async () => {
      await safeDeleteMessage(ctx, ctx.chat.id, notice.message_id);
    }, 8000);
  } catch (e) {
    console.error('Moderation flow failed:', e.response?.description || e.message);
    console.error('Entities:', msg.entities || msg.caption_entities || []);
  }
});

bot.catch((err, ctx) => {
  console.error(
    'Telegraf error:',
    ctx?.updateType,
    err.response?.description || err.message || err
  );
});

console.log('Starting bot...');

bot.launch()
  .then(() => {
    console.log('Bot is running...');
    console.log('Waiting for updates...');
  })
  .catch((err) => {
    console.error('Launch failed:', err.response?.description || err.message);
  });

process.once('SIGINT', () => {
  console.log('Received SIGINT, stopping bot...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('Received SIGTERM, stopping bot...');
  bot.stop('SIGTERM');
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});