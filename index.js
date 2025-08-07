import {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  EmbedBuilder
} from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = '/home/node404/bots/BanCannon';

const BAN_COUNTS_FILE = path.join(BASE_DIR, 'banCounts.json');
const BAN_EXTRA_CODES_FILE = path.join(BASE_DIR, 'banExtraCodes.json');
const BAN_EXTRA_GUILDS_FILE = path.join(BASE_DIR, 'banExtraServers.json');

let banCounts = {};
let banExtraCodes = new Set();
let banExtraGuilds = new Set();

async function loadData() {
  try {
    if (await fileExists(BAN_COUNTS_FILE)) {
      banCounts = JSON.parse(await fs.readFile(BAN_COUNTS_FILE, 'utf8'));
    }
    if (await fileExists(BAN_EXTRA_CODES_FILE)) {
      banExtraCodes = new Set(JSON.parse(await fs.readFile(BAN_EXTRA_CODES_FILE, 'utf8')));
    }
    if (await fileExists(BAN_EXTRA_GUILDS_FILE)) {
      banExtraGuilds = new Set(JSON.parse(await fs.readFile(BAN_EXTRA_GUILDS_FILE, 'utf8')));
    }

    console.log('🔍 Loaded banExtraCodes:', [...banExtraCodes]);
    console.log('🔍 Loaded banExtraGuilds:', [...banExtraGuilds]);
  } catch (err) {
    console.error('❌ Error loading saved data:', err);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function saveBanCounts() {
  try {
    await fs.writeFile(BAN_COUNTS_FILE, JSON.stringify(banCounts, null, 2));
  } catch (err) {
    console.error('❌ Failed to save banCounts.json:', err);
  }
}

async function saveExtraFiles() {
  try {
    await fs.writeFile(BAN_EXTRA_CODES_FILE, JSON.stringify([...banExtraCodes], null, 2));
    await fs.writeFile(BAN_EXTRA_GUILDS_FILE, JSON.stringify([...banExtraGuilds], null, 2));
  } catch (err) {
    console.error('❌ Failed to save extra files:', err);
  }
}

function getGuildTier(guildId) {
  return banExtraGuilds.has(guildId) ? 'extra' : 'free';
}

function getBanLimitForTier(tier) {
  return tier === 'extra' ? 5 : 2;
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getPermissionDeniedMessage(tier) {
  const messages = [
    "**MISCAST ERROR!**\n> You hath failed to `@` a target. The Ban Cannon sputters, confused and disappointed. Even the scrolls are laughing.",
    "**Arcane Protocol Breach:**\n> No target sigil detected. You must inscribe the name (`@user`) of the one to be banished, lest the cannon sleep forevermore.",
    "**The Beard Rejects You.**\n> You summoned the Ban Cannon without a name. That's like casting *Fireball* with no target and setting your own robe ablaze.",
    "**Insufficient Beard Energy Detected.**\n> The cannon requires a properly tagged victim to lock onto. As it stands, you've cast `Banish()` with null syntax. Rookie mistake.",
    "**Fatal Beard Exception**\n> `@Target` parameter missing. The Cannon reboots in shame. Consult the sacred Patch Notes before embarrassing yourself further.",
    "**Scrying Failed!**\n> No trace of a foe could be divined. You must `@` their true name, lest your spell fizzle like a damp firecracker in a tavern urinal."
  ];

  return tier === 'extra'
    ? getRandomItem(messages)
    : "Nice try, initiate. But without the sacred Beard of Credibility and the Scroll of Passive-Aggressive Patch Notes, the Ban Cannon shall not heed your feeble click.";
}

function scheduleDailyReset() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const delay = nextMidnight - now;

  setTimeout(() => {
    banCounts = {};
    saveBanCounts();
    console.log('🔄 Ban counts reset at midnight.');

    setInterval(() => {
      banCounts = {};
      saveBanCounts();
      console.log('🔄 Ban counts reset at midnight.');
    }, 24 * 60 * 60 * 1000);
  }, delay);
}

async function handleBanCannon(message) {
  const guildId = message.guild.id;
  const guildTier = getGuildTier(guildId);
  const maxBans = getBanLimitForTier(guildTier);

  if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
    return message.reply(getPermissionDeniedMessage(guildTier));
  }

  const user = message.mentions.users.first();
  if (!user) return message.reply(getPermissionDeniedMessage(guildTier));

  const userId = message.author.id;
  banCounts[guildId] = banCounts[guildId] || {};
  banCounts[guildId][userId] = banCounts[guildId][userId] || 0;

  if (banCounts[guildId][userId] >= maxBans) {
    return message.reply(`⚠️ Ban Cannon cooldown: ${maxBans} daily uses reached. Try again tomorrow!`);
  }

  const member = message.guild.members.cache.get(user.id);
  if (!member) return message.reply("🧾 User not found in this server.");
  if (!member.bannable) return message.reply("❌YOU HAVE ATTEMPTED A FORBIDDEN BAN!! THE BEARDS HAVE BEEN NOTIFED!!!");

  try {
    await member.ban({ reason: 'Struck by the Ban Cannon!' });
    banCounts[guildId][userId]++;
    await saveBanCounts();

    const embed = new EmbedBuilder()
      .setTitle('🔨 ARCANE BEARD CANNON DEPLOYED!')
      .setDescription(`**${user.tag} has been beardblasted into nonexistence. RIP.**`)
      .setImage('https://cdn.discordapp.com/attachments/1090553463076831233/1388676139706224801/cannon-blast-ezgif.com-optimize.gif')
      .setColor(0xff0000)
      .setFooter({ text: 'Let this be a warning to all who post without honor.' });

    return message.channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('❌ Ban failed:', err);
    return message.reply('The Cannon failed me... Summon the Architect.');
  }
}

async function handleRedeem(message) {
  const code = message.content.trim().split(' ')[2];
  const guildId = message.guild.id;

  if (!code) return message.reply("🔑 You must provide a code. Try `!bantier redeem YOURCODE`.");
  if (!banExtraCodes.has(code)) return message.reply("❌ Invalid or used BanCannon Extra code.");
  if (banExtraGuilds.has(guildId)) return message.reply("⚡ This server already has BanCannon Extra.");

  banExtraGuilds.add(guildId);
  banExtraCodes.delete(code);
  await saveExtraFiles();

  return message.reply("🎉 This server now wields **BanCannon Extra** — five daily bans, spicy misfire messages, and supreme beard power.");
}

async function handleStatus(message) {
  const tier = getGuildTier(message.guild.id);
  return message.reply(`🧠 This server currently has **BanCannon ${tier === 'extra' ? 'Extra' : 'Free'}**.`);
}

async function handleRedneckCheck(message) {
  const jokes = [
    "You might be a redneck if your house has wheels but your truck don’t.",
    "You might be a redneck if you’ve ever mowed the lawn and found a car.",
    "You might be a redneck if your family tree doesn’t fork.",
    "You might be a redneck if your front porch collapses and kills more than five dogs.",
    "You might be a redneck if your idea of a family reunion is meeting up at the Waffle House.",
    "You might be a redneck if you’ve ever used duct tape as a medical tool.",
    "You might be a redneck if you think a ‘semi-automatic’ is a fancy washing machine.",
    "You might be a redneck if your dog and your pickup truck are both named Earl.",
    "You might be a redneck if you've ever used a mattress as a swimming pool raft.",
    "You might be a redneck if you think ‘Wi-Fi’ is a brand of jerky.",
    "You might be a redneck if your wedding had a bait table instead of a cake table.",
    "You might be a redneck if your lawnmower has a cupholder but your car doesn’t.",
    "You might be a redneck if your Christmas lights are still up — and it’s July.",
    "You might be a redneck if your home security system is a goose with an attitude.",
    "You might be a redneck if you’ve ever barbecued in the rain and called it a ‘storm cookout.’",
    "You might be a redneck if your bathroom reading shelf has more hunting magazines than toilet paper.",
    "You might be a redneck if your idea of a hot tub is a kiddie pool and a kettle.",
    "You might be a redneck if your truck has more stickers than paint.",
    "You might be a redneck if your garage doubles as a chicken coop.",
    "You might be a redneck if your internet goes out every time the microwave runs."
  ];

  const embed = new EmbedBuilder()
    .setTitle('🎯 REDNECK CHECK COMPLETE')
    .setDescription(`**${getRandomItem(jokes)}**`)
    .setImage('https://cdn.discordapp.com/attachments/1090553463076831233/1392365368416403578/200.webp')
    .setColor(0xff5500);

  return message.channel.send({ embeds: [embed] });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('ready', () => {
  console.log(`🔨 Logged in as ${client.user.tag} — The Ban Cannon is ready!`);
  client.user.setPresence({
    activities: [{ name: 'with its Beard.' }],
    status: 'online'
  });
  scheduleDailyReset();
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.guild) return;

  const lower = message.content.toLowerCase();
  if (lower.startsWith('!bancannon')) return await handleBanCannon(message);
  if (lower.startsWith('!bantier redeem')) return await handleRedeem(message);
  if (lower === '!bantier status') return await handleStatus(message);
  if (lower === '!redneckcheck') return await handleRedneckCheck(message);
});

client.on('guildMemberAdd', async member => {
 const welcomeChannel = member.guild.systemChannel ||
  member.guild.channels.cache.find(c => c.name.includes("welcome") && c.isTextBased());

if(!welcomeChannel) return;

 const message = `
  Welcome to ${member.guild.name}, ${member.user}!

  If you found your way here through an invite link contact an admin to get your role to stay.
  If you choose to leave without a valid role you will need to rejoin through the invite link and try again.
  `;

  welcomeChannel.send({ content: message }).catch(console.error);
});

await loadData();
client.login(process.env.BOT_TOKEN);
