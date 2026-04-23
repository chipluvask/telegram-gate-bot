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
const QR_PATH = path.join(__dirname, 'qr-sacombank.jpg');

if (!BOT_TOKEN) throw new Error('Thiếu BOT_TOKEN trong file .env');

const bot = new Telegraf(BOT_TOKEN);

function inviteUrl(link, username) {
  if (username) return `https://t.me/${username.replace('@', '')}`;
  return link;
}

function adminUrl(username) {
  return `https://t.me/${String(username).replace('@', '')}`;
}

function isPrivateChat(ctx) {
  return ctx.chat?.type === 'private';
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

  const textMatch =
    value.includes('http://') ||
    value.includes('https://') ||
    value.includes('www.') ||
    value.includes('t.me/') ||
    value.includes('telegram.me/') ||
    value.includes('.com') ||
    value.includes('.net') ||
    value.includes('.org') ||
    value.includes('.io') ||
    value.includes('.me') ||
    value.includes('.vn') ||
    value.includes('.xyz') ||
    value.includes('.cc') ||
    value.includes('.gg') ||
    value.includes('.co') ||
    /@\w{5,}/.test(value);

  return textMatch || hasTelegramLinkEntity(msg);
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
  if (fs.existsSync(QR_PATH)) {
    return ctx.replyWithPhoto(Input.fromLocalFile(QR_PATH), {
      caption: text,
      reply_markup: adminKeyboard().reply_markup
    });
  }

  return ctx.reply(text, adminKeyboard());
}

bot.start(async (ctx) => {
  if (!isPrivateChat(ctx)) return;

  await ctx.reply(startMessage(), {
    parse_mode: 'HTML',
    ...startKeyboard()
  });

  await sendCoffee(ctx);
});

bot.action('show_coffee', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isPrivateChat(ctx)) return;
  return sendCoffee(ctx);
});

bot.command('coffee', async (ctx) => {
  if (!isPrivateChat(ctx)) return;
  return sendCoffee(ctx);
});

bot.command('admins', async (ctx) => {
  if (!isPrivateChat(ctx)) return;
  return ctx.reply(adminCaption(), adminKeyboard());
});

bot.command('ping', async (ctx) => {
  console.log('PING CMD:', ctx.chat?.id, ctx.chat?.type);
  return ctx.reply(`pong: ${ctx.chat?.type}`);
});

bot.on('text', async (ctx, next) => {
  if (!isPrivateChat(ctx)) return next();
  if (ctx.message.text.startsWith('/')) return next();

  return ctx.reply(startMessage(), {
    parse_mode: 'HTML',
    ...startKeyboard()
  });
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

  if (!['group', 'supergroup'].includes(chatType)) return;
  if (!msg) return;
  if (msg.from?.is_bot) return;

  const text = msg.text || msg.caption || '';

  if (!text && !hasTelegramLinkEntity(msg)) {
    console.log('Skip: no text and no link entity');
    return;
  }

  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, msg.from.id);
    const isAdmin = ['creator', 'administrator'].includes(member.status);

    console.log('Member status:', member.status);

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

  try {
    console.log('Trying delete message id:', msg.message_id);

    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id);
    console.log('Deleted message:', msg.message_id);

    const reason = isLink && isBanned ? 'both' : isLink ? 'link' : 'banned';
    const notice = await ctx.reply(warningText(reason));
    console.log('Sent notice:', notice.message_id);

    setTimeout(async () => {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, notice.message_id);
        console.log('Deleted notice:', notice.message_id);
      } catch (e) {
        console.error('Delete notice failed:', e.response?.description || e.message);
      }
    }, 8000);
  } catch (e) {
    console.error('Delete moderated message failed:', e.response?.description || e.message);
    console.error('Entities:', msg.entities || msg.caption_entities || []);
  }
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

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));