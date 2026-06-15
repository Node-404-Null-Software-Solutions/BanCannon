import express from 'express';
import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionsBitField
} from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = __dirname;
const DAILY_LIMITS = {
  free: 2,
  extra: 5
};

const FILES = {
  counts: path.join(DATA_DIR, 'banCounts.json'),
  extraCodes: path.join(DATA_DIR, 'banExtraCodes.json'),
  extraGuilds: path.join(DATA_DIR, 'banExtraServers.json')
};

const COMMANDS = {
  ban: '!bancannon',
  redeem: '!bantier redeem',
  status: '!bantier status',
  redneckCheck: '!redneckcheck'
};

const REMOTE_IMAGES = {
  banBlast: 'https://cdn.discordapp.com/attachments/1090553463076831233/1388676139706224801/cannon-blast-ezgif.com-optimize.gif',
  redneckCheck: 'https://cdn.discordapp.com/attachments/1090553463076831233/1392365368416403578/200.webp'
};

let banCounts = {};
let banExtraCodes = new Set();
let banExtraGuilds = new Set();
let botReady = false;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

function getGuildTier(guildId) {
  return banExtraGuilds.has(guildId) ? 'extra' : 'free';
}

function getBanLimitForTier(tier) {
  return DAILY_LIMITS[tier] ?? DAILY_LIMITS.free;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath, fallback) {
  if (!(await fileExists(filePath))) {
    return fallback;
  }

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to read ${path.basename(filePath)}:`, error);
    return fallback;
  }
}

async function writeJsonFile(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function loadData() {
  banCounts = await readJsonFile(FILES.counts, {});
  banExtraCodes = new Set(await readJsonFile(FILES.extraCodes, []));
  banExtraGuilds = new Set(await readJsonFile(FILES.extraGuilds, []));

  console.log('Loaded ban data:', {
    extraCodes: banExtraCodes.size,
    extraGuilds: banExtraGuilds.size
  });
}

async function saveBanCounts() {
  try {
    await writeJsonFile(FILES.counts, banCounts);
  } catch (error) {
    console.error('Failed to save banCounts.json:', error);
  }
}

async function saveExtraFiles() {
  try {
    await Promise.all([
      writeJsonFile(FILES.extraCodes, [...banExtraCodes]),
      writeJsonFile(FILES.extraGuilds, [...banExtraGuilds])
    ]);
  } catch (error) {
    console.error('Failed to save BanCannon Extra files:', error);
  }
}

function getPermissionDeniedMessage(tier) {
  const extraMessages = [
    '**Miscast Error**\n> No target was provided. The cannon refuses to fire into the void.',
    '**Arcane Protocol Breach**\n> You need to mention a valid target before the cannon will arm.',
    '**Fatal Beard Exception**\n> The cannon tried to lock on and found nothing to ban.',
    '**Scrying Failed**\n> No target sigil detected. Please tag the user you want to ban.'
  ];

  if (tier === 'extra') {
    return randomItem(extraMessages);
  }

  return 'Nice try. You need the proper permissions and a valid target before the cannon will fire.';
}

function scheduleDailyReset() {
  const resetAtMidnight = () => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);

    const delay = nextMidnight.getTime() - now.getTime();

    setTimeout(async () => {
      banCounts = {};
      await saveBanCounts();
      console.log('Daily ban counts reset.');
      resetAtMidnight();
    }, delay);
  };

  resetAtMidnight();
}

function startHealthServer() {
  const app = express();
  const port = Number(process.env.PORT ?? 3000);

  app.get('/healthz', (_req, res) => {
    res.status(botReady ? 200 : 503).json({ ok: botReady, bot: 'BanCannon' });
  });

  app.get('/', (_req, res) => {
    res.type('text').send('BanCannon is running.');
  });

  app.listen(port, () => {
    console.log(`Health server listening on port ${port}`);
  });
}

async function handleBanCannon(message) {
  const guild = message.guild;
  const guildId = guild.id;
  const guildTier = getGuildTier(guildId);
  const maxBans = getBanLimitForTier(guildTier);

  if (!message.member?.permissions?.has(PermissionsBitField.Flags.BanMembers)) {
    return message.reply(getPermissionDeniedMessage(guildTier));
  }

  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return message.reply(getPermissionDeniedMessage(guildTier));
  }

  const authorId = message.author.id;
  banCounts[guildId] ??= {};
  banCounts[guildId][authorId] ??= 0;

  if (banCounts[guildId][authorId] >= maxBans) {
    return message.reply(`Ban Cannon cooldown: you have used all ${maxBans} daily charges. Try again tomorrow.`);
  }

  let targetMember;
  try {
    targetMember = await guild.members.fetch(targetUser.id);
  } catch {
    return message.reply('User not found in this server.');
  }

  if (!targetMember.bannable) {
    return message.reply('I cannot ban that member.');
  }

  try {
    await targetMember.ban({ reason: 'Struck by the Ban Cannon.' });
    banCounts[guildId][authorId] += 1;
    await saveBanCounts();

    const embed = new EmbedBuilder()
      .setTitle('Ban Cannon Deployed')
      .setDescription(`**${targetUser} has been beard-blasted into nonexistence.**`)
      .setImage(REMOTE_IMAGES.banBlast)
      .setColor(0xff0000)
      .setFooter({ text: 'Let this be a warning to all who post without honor.' });

    return message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Ban failed:', error);
    return message.reply('The cannon failed. Please try again or check permissions.');
  }
}

async function handleRedeem(message) {
  const parts = message.content.trim().split(/\s+/);
  const code = parts[2];
  const guildId = message.guild.id;

  if (!code) {
    return message.reply('You must provide a code. Try `!bantier redeem YOURCODE`.');
  }

  if (!banExtraCodes.has(code)) {
    return message.reply('Invalid or already used BanCannon Extra code.');
  }

  if (banExtraGuilds.has(guildId)) {
    return message.reply('This server already has BanCannon Extra.');
  }

  banExtraGuilds.add(guildId);
  banExtraCodes.delete(code);
  await saveExtraFiles();

  return message.reply('This server now has BanCannon Extra: five daily bans and extra misfire messages.');
}

async function handleStatus(message) {
  const tier = getGuildTier(message.guild.id);
  return message.reply(`This server currently has BanCannon ${tier === 'extra' ? 'Extra' : 'Free'}.`);
}

async function handleRedneckCheck(message) {
  const jokes = [
    'You might be a redneck if your house has wheels but your truck does not.',
    'You might be a redneck if you have ever mowed the lawn and found a car.',
    'You might be a redneck if your family tree does not fork.',
    'You might be a redneck if your front porch collapses and takes out more than five dogs.',
    'You might be a redneck if your idea of a family reunion is the Waffle House.',
    'You might be a redneck if you have ever used duct tape as a medical tool.',
    'You might be a redneck if you think a semi-automatic is a fancy washing machine.',
    'You might be a redneck if your dog and your pickup truck are both named Earl.',
    'You might be a redneck if you have ever used a mattress as a swimming pool raft.',
    'You might be a redneck if you think Wi-Fi is a brand of jerky.',
    'You might be a redneck if your wedding had a bait table instead of a cake table.',
    'You might be a redneck if your lawnmower has a cupholder but your car does not.',
    'You might be a redneck if your Christmas lights are still up and it is July.',
    'You might be a redneck if your home security system is a goose with an attitude.',
    'You might be a redneck if you have ever barbecued in the rain and called it a storm cookout.',
    'You might be a redneck if your bathroom reading shelf has more hunting magazines than toilet paper.',
    'You might be a redneck if your idea of a hot tub is a kiddie pool and a kettle.',
    'You might be a redneck if your truck has more stickers than paint.',
    'You might be a redneck if your garage doubles as a chicken coop.',
    'You might be a redneck if your internet goes out every time the microwave runs.'
  ];

  const embed = new EmbedBuilder()
    .setTitle('Redneck Check Complete')
    .setDescription(`**${randomItem(jokes)}**`)
    .setImage(REMOTE_IMAGES.redneckCheck)
    .setColor(0xff5500);

  return message.channel.send({ embeds: [embed] });
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}. Ban Cannon is ready.`);
  botReady = true;

  client.user.setPresence({
    activities: [{ name: 'with its Beard' }],
    status: 'online'
  });

  scheduleDailyReset();
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) {
    return;
  }

  const content = message.content.trim().toLowerCase();

  if (content.startsWith(COMMANDS.ban)) {
    return handleBanCannon(message);
  }

  if (content.startsWith(COMMANDS.redeem)) {
    return handleRedeem(message);
  }

  if (content === COMMANDS.status) {
    return handleStatus(message);
  }

  if (content === COMMANDS.redneckCheck) {
    return handleRedneckCheck(message);
  }
});

client.on('guildMemberAdd', async member => {
  const welcomeChannel =
    member.guild.systemChannel ||
    member.guild.channels.cache.find(channel => channel.isTextBased() && channel.name.toLowerCase().includes('welcome'));

  if (!welcomeChannel) {
    return;
  }

  const message = [
    `Welcome to ${member.guild.name}, ${member.user}!`,
    '',
    'If you found your way here through an invite link, contact an admin to get your role.',
    'If you leave without a valid role, you will need to rejoin through the invite link and try again.'
  ].join('\n');

  welcomeChannel.send({ content: message }).catch(error => {
    console.error('Failed to send welcome message:', error);
  });
});

startHealthServer();
await loadData();
await client.login(process.env.BOT_TOKEN);
