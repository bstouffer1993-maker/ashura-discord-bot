require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  ActivityType,
  PermissionFlagsBits,
  ChannelType,
  Events
} = require("discord.js");
const fs = require("fs");

// node-fetch dynamic import (CommonJS safe)
const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

// ====================================================
//                 CORE IDS (LOCKED)
// ====================================================
const BOT_TOKEN = process.env.BOT_TOKEN;
console.log("BOT_TOKEN exists:", !!BOT_TOKEN);
const GUILD_ID = "1440864949063782536";
const OWNER_ID = "280466049080623104";

// ====================================================
//                 SAFETY CHECK (REQUIRED)
// ====================================================
if (!BOT_TOKEN) {
  console.error("❗ Missing BOT_TOKEN environment variable. Set BOT_TOKEN in Railway → Service → Variables.");
  process.exit(1);
}

// ====================================================
//                    CHANNEL IDS
// ====================================================
const CHANNELS = {
  // Sanctum Gate
  entrance: "1440871886731870269",
  tablets: "1440868109568180274",
  unchaining: "1440871969368313910",

  // The Ashen Ring
  embersChat: "1440864950141587498",
  embersWar: "1440872970019930242",
  memoryFlames: "1440873017885458482",
  runesOfCommand: "1440873068372164828",

  // The Cinder Forge
  cinderCall: "1440874777731530763",
  embersTime: "1440873356118331495",
  forgeLinks: "1440873418613457057",

  // The Fallen Watch
  fallenGuards: "1440868109568180277",
  fallenLedger: "1440874128835088455",
  forgeTesting: "1440874188771430533",

  // Social channels
  irl: "1441679348565409802",
  food: "1441679591768068226",
  art: "1441679817194868827",

  // Lore + Help
  chroniclesOfAsh: "1441701419190190163",
  sanctumAid: "1441701575490797568",

  // Ashen Arena system
  ashenArena: "1441693989370724383",
  echoesOfBattle: "1441696001042944060",
  arenaVictories: "1441696089374724137"
};

// ====================================================
//                  VOICE HUB IDS
// ====================================================
const VOICE_HUBS = {
  warriorsCircle: "1440873685857734677"
};
const TEMP_VC_PREFIX = "⚔️ Warrior’s Flame —";
const TEMP_VC_USER_LIMIT = 0;

// ====================================================
//                       ROLES
// ====================================================
const ROLES = {
  chained: "1440891083755098225",
  ashenKin: "1440890955644534784",

  fallenPhoenix: "1440878133254422679",
  ashborneAllies: "1441647195404107917",
  fallenGuardsRole: "1440888778985181224",

  flameCallers: "1440891209613709372",
  battleSworn: "1440891303385894964"
};

// ====================================================
//           RITUAL / OATH PHRASES + STATUS
// ====================================================
const RITUAL_PHRASE = "i rise from the ashes";
const ASHBORNE_PHRASE = "ash to ash, let the ember guide me.";
const FALLEN_GUARDS_PHRASE = "unchain my soul and let me stand watch.";
const FALLEN_PHOENIX_PHRASE = "these chains are my crown.";

const STATUS_TEXT = "Watching the chains…";

// ====================================================
//                COOLDOWNS + CONSTANTS
// ====================================================
const RELEASE_COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000;
const FEED_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MEDITATE_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const BLESSING_COOLDOWN_MS = 48 * 60 * 60 * 1000;
const HUNT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const SCOUT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const BOND_COOLDOWN_MS = 8 * 60 * 60 * 1000;
const DUEL_COOLDOWN_MS = 60 * 60 * 1000;
const SPAR_COOLDOWN_MS = 2 * 60 * 60 * 1000; // phoenix spar

const ASHURA_MAX_LEVEL = 50;
const DISCORD_CHAR_LIMIT = 1900;

// ====================================================
//                         UTILS
// ====================================================
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

function formatCooldown(msLeft) {
  const s = Math.ceil(msLeft / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
function canUse(now, lastAt, cooldownMs) {
  return !lastAt || (now - lastAt) >= cooldownMs;
}
function requireChannel(interaction, allowedIds, msg) {
  if (!allowedIds.includes(interaction.channelId)) {
    interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    return false;
  }
  return true;
}

// Simple dice roller: supports formats like "d20", "2d6+3", "4d8-1"
function rollDiceFormula(formulaRaw) {
  const formula = (formulaRaw || "1d20").trim().toLowerCase();
  const match = formula.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) return null;

  let count = parseInt(match[1] || "1", 10);
  let sides = parseInt(match[2], 10);
  let mod = match[3] ? parseInt(match[3], 10) : 0;

  if (count < 1) count = 1;
  if (count > 20) count = 20;
  if (sides < 2) sides = 2;
  if (sides > 100) sides = 100;

  const rolls = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const r = 1 + Math.floor(Math.random() * sides);
    rolls.push(r);
    total += r;
  }
  const finalTotal = total + mod;

  return { formula: `${count}d${sides}${mod ? (mod > 0 ? `+${mod}` : mod) : ""}`, rolls, total, mod, finalTotal };
}

function rollD20() {
  const r = 1 + Math.floor(Math.random() * 20);
  let label = "Neutral roll";
  if (r === 20) label = "✨ Critical success";
  else if (r >= 16) label = "Strong success";
  else if (r <= 3) label = "💀 Critical stumble";
  else if (r <= 7) label = "Shaky attempt";
  return { value: r, label };
}

// ====================================================
//        PHOENIX STAT ROLLER (RARITY-BASED)
// ====================================================
function rollPhoenixStatsForRarity(rarityName) {
  // Dice formulas per rarity
  const table = {
    "Cinderling": "2d6+4",        // 6–16, average ~11
    "Emberwing": "3d6+4",         // 7–22, average ~14
    "Voidflame": "3d6+6",         // 9–24, average ~16
    "Dusk-Seraph": "4d6+6",       // 10–30, average ~19
    "Fallen Ascendant": "4d6+8"   // 12–32, average ~21
  };

  const formula = table[rarityName] || "3d6+4";
  const keys = ["might", "ward", "focus", "chaos"];
  const stats = {};

  for (const key of keys) {
    const roll = rollDiceFormula(formula);
    stats[key] = roll ? roll.finalTotal : 10;
  }

  return stats;
}



// ====================================================
//                DISCORD CLIENT
// ====================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});
client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
});


// keep bot alive if discord throws a random async error
process.on("unhandledRejection", (e) => console.error("UnhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("UncaughtException:", e));

// ====================================================
//                     LOG CHANNELS
// ====================================================
async function announce(text) {
  try {
    const ch = await client.channels.fetch(CHANNELS.memoryFlames).catch(() => null);
    if (ch?.isTextBased()) ch.send(text).catch(() => {});
  } catch {}
}
async function ledgerLog(text) {
  try {
    const ch = await client.channels.fetch(CHANNELS.fallenLedger).catch(() => null);
    if (ch?.isTextBased()) ch.send(text).catch(() => {});
  } catch {}
}
async function arenaEcho(text) {
  try {
    const ch = await client.channels.fetch(CHANNELS.echoesOfBattle).catch(() => null);
    if (ch?.isTextBased()) ch.send(text).catch(() => {});
  } catch {}
}
async function arenaVictory(text) {
  try {
    const ch = await client.channels.fetch(CHANNELS.arenaVictories).catch(() => null);
    if (ch?.isTextBased()) ch.send(text).catch(() => {});
  } catch {}
}

// ====================================================
//                UNIQUE DM POOLS
// ====================================================
const DM_POOLS = {
  ashenKin: [
    "🜂 The chains splinter. You rise as Ashen Kin beneath the Black Flame.",
    "🜂 Your Rite rings true. The Sanctum opens for you.",
    "🜂 The void tried to keep you. It failed. Welcome, Ashen Kin.",
    "🜂 Ash clings to your hands, not your soul. You are unchained.",
    "🜂 A feather falls. The Order accepts you."
  ],
  ashborneAllies: [
    "🜜 Streamer of flame… your vow is accepted. You are Ashborne now.",
    "🜜 Your oath echoes through the halls. Welcome, Ally.",
    "🜜 You bypassed the Rite by right of fire. Ashborne Allies claim you.",
    "🜜 The ember leans toward you. Stand beside the Phoenix."
  ],
  fallenGuards: [
    "⛓️ Your oath binds you to the watch. You are Fallen Guard now.",
    "⛓️ The Sanctum entrusts its gates to you. Stand where others fall.",
    "⛓️ Your vow is carved into ash. Guard well."
  ],
  fallenPhoenix: [
    "🜂 The chains you carry are a crown. The Fallen Phoenix endures.",
    "🜂 Your oath needs no proof. The void already knows your name.",
    "🜂 Ashura bows. The Fallen Phoenix stands sovereign."
  ]
};

// ====================================================
//                 PINNED MESSAGES
// ====================================================
function splitIntoChunks(text, limit = DISCORD_CHAR_LIMIT) {
  if (!text) return [];
  const chunks = [];
  let current = "";

  for (const line of text.split("\n")) {
    if ((current + line + "\n").length > limit) {
      chunks.push(current.trimEnd());
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  }
  if (current.trim().length) chunks.push(current.trimEnd());
  return chunks;
}

function buildExpectedChunks(content) {
  const entries = Array.isArray(content) ? content : [content];
  const expected = [];
  for (const entry of entries) {
    expected.push(...splitIntoChunks(entry));
  }
  return expected;
}

async function fetchPinsSafe(channel) {
  try {
    const pinsCollection = await channel.messages.fetchPinned().catch(() => null);
    if (!pinsCollection) return [];

    if (Array.isArray(pinsCollection)) return pinsCollection;
    if (typeof pinsCollection.values === "function") return [...pinsCollection.values()];
    if (pinsCollection.messages && typeof pinsCollection.messages.values === "function") {
      return [...pinsCollection.messages.values()];
    }
    return Object.values(pinsCollection);
  } catch {
    return [];
  }
}

const pinnedMessages = {
  entrance:
`🜂 **Sanctum Gate**

Traveler, you stand before the Fallen Ember Order.

Beyond this point:
• The **Tablets of Flame** carve the law into ember and ash.  
• **The Unchaining** waits to test your resolve.  

Step carefully. Some who enter never rise from the void.`,

  tablets:
`📜 **Tablets of Flame**

These are the laws that bind the Fallen Ember Order.

• Honor the Ashen Kin and all who walk these halls.  
• This Sanctum is 18+ — keep all content within Discord’s laws.  
• Do not choke the emberflow with spam, chaos, or endless self-promotion.  
• Guard the chains of privacy; what is shared in trust stays in the dark.  
• You MUST complete the **Rite of Unchaining** to unlock the rest of the Sanctum.  
• Discord’s Terms of Service are etched into these Tablets.

By remaining here, you accept the weight of these flames.`,

  unchaining:
`⛓️ **THE RITE OF UNCHAINING**

You begin your journey bound in shadow.  
Only by completing this Rite will the rest of the Sanctum open to you.

Speak the Rite **exactly** as written:

> **I rise from the ashes**

**Ashborne Allies** and **Fallen Guards** may speak their oaths here to bypass this Rite.`,

  embersChat:
`🔥 **Embers of Chat**

Here the Ashen Kin gather around the living flame.

• Talk, joke, and share your thoughts.  
• Keep the warmth; do not turn the fire into a wildfire.  
• Respect the Order and those who walk beside you.

The stronger our embers, the brighter the Order burns.`,

  embersWar:
`⚔️ **Embers of War**

This is where warriors rally for battle.

• Form parties, raids, and squads.  
• Share codes, strats, and victories.  
• No drama bait, no griefing, no spoilers without warning.

Need teammates? Use **/lfg** and Ashura will call the Battle-Sworn.`,

  memoryFlames:
`📸 **Memory Flames**

These are the sparks the Order refuses to forget.

• Share clips, screenshots, and highlights.  
• Keep content safe and within the Tablets.  
• Celebrate each other’s moments — big or small.

Every ember you share becomes part of the Order’s story.`,

  runesOfCommand:
`🤖 **Runes of Command**

**Core**
• /flame — the Black Flame speaks  
• /oath — recite the Order’s oath  
• /rebirth — learn the lore of rising  
• /guide — how to navigate the Sanctum  

**Phoenix Companions**
• /phoenix bind | status | name | portrait | title  
• /phoenix feed | meditate | blessing  
• /phoenix hunt | scout | bond  
• /phoenix duel | spar | arena | release  
• /phoenix bag | use | sell | sellall — relics & embercoin
• /phoenix rollstats

**Ember (Characters & Shop)**
• /ember sheet | rollstats — your D&D-style character  
• /ember shop | buy | use — potions and items  

**Classes**
• /class list | choose | status | xp  
• /class train | quest | info  
• /class whois | spar  
• /class reset (guards/owner)  

**Campaigns**
• /campaign status | enlist | contribute | leaderboard  

**Calls**
• /announce — mods/owner announcements  
• /lfg — pings Battle-Sworn in Embers of War  

**Events**
• /summon-ashura — server-wide blessing

Use the runes as guided. Don’t flood other halls with command spam.`,

  cinderCall:
`📢 **Cinder Call**

When the Phoenix speaks, it echoes here.

Only the Phoenix, Ashura, and the Fallen Guards should speak in this chamber.`,

  embersTime:
`🗓 **Embers of Time**

Stream schedules, events, and rituals are carved here.  
Watch this calendar. The flame keeps its own time.`,

  forgeLinks:
`🔗 **Forge Links**

Gateways beyond the Sanctum, tempered in flame.

Only trusted hands inscribe links here.`,

  fallenGuards:
`🛡 **Hall of the Fallen Guards**

This hall belongs to the protectors of the Order.

If you can see this, you wear a heavier mantle.`,

  fallenLedger:
`📂 **Fallen Ledger**

Ashura’s written record of the Order.

Not a place for chat.`,

  forgeTesting:
`🧪 **Forge Testing**

Test commands here — not in the Sanctum.`,

  irl:
`🪶 **Emberbound Lives**

Real life behind the flame.  
Be human. Be respectful.`,

  food:
`🍖 **Cinder Kitchen**

Meals, recipes, offerings.  
Feed the flame.`,

  art:
`🎨 **Sigils & Sketches**

Art, WIPs, memes forged by hand.  
Credit creators.`,

  sanctumAid:
`🛡 **Sanctum Aid**

Post help requests here.

Include:
• what you tried  
• exact command  
• screenshot if needed  
• expected vs actual

Ashura answers clearly spoken embers.`,

  ashenArena:
`⚔️ **The Ashen Arena**

Use **/phoenix arena** to enter the queue.  
Fallen Guards ignite matches.

No spam. Only warriors.`,

  echoesOfBattle:
`🜂 **Echoes of Battle**

Arena queue calls and match announcements burn here.

Read. Remember. Rise.`,

  arenaVictories:
`🏆 **Arena Victories**

Victories are carved into emberstone forever.

Fight well.`,

  chroniclesOfAsh: [
`📜 **CHRONICLES OF ASH — CHAPTER I: THE FALL OF AZHARYON**
*The First Cut in the Sky*

There was no mercy in the heavens.

Before the void learned to bleed, before angels learned to fear, **Azharyon** stood as an **Archangel of the Choir** — a living blade of dawnfire.  
His wings were **radiant white**, so bright they could blind falsehood itself.

He didn’t bow when commanded.  
He didn’t look away when innocents screamed.  
He defended mortals—something forbidden by the Choir.

So the Choir turned.

They did not rip his wings away.

They **chained him.**

Not to humble him — to display him.

Celestial iron was driven through his arms and the roots of his wings,  
and he was **bound to pillars of judgment**, spread wide like a trophy in a cathedral of lies.  
Each link was a verdict. Each shackle was a sermon of obedience.

They shattered his halo.  
They called it “justice.”

Then they threw him into the abyss.

He fell into darkness deeper than language—  
and hit the ground hard enough to crack the realm.

When he tried to rise, the light died.

The radiant white of his wings **drank in the void**…  
until nothing remained but **pitch black feathers** —  
not stained, but *reborn wrong*, as if the sky itself had turned its back on him.

His wings were still there.

But bound.  
Heavy.  
Mocking him with every useless twitch.

And the chains whispered:

“You are nothing.”  
“You were never worthy.”  
“You deserve the fall.”

Time abandoned him.

The heavens forgot him.

The void tried to teach him surrender.`,


`📜 **CHRONICLES OF ASH — CHAPTER II: THE PIT OF SILENCE**
*Where Hope Goes to Die*

The abyss is not a place.

It’s a verdict.

Azharyon lived there chained—  
not just by iron, but by memory.

The Choir’s lies became his cellmates.

Every day the chains tightened around his wings, not allowing them to fold, not allowing them to rise.  
The weight of them was designed to make him hate himself.

His blackened wings still remembered the heavens they once lit.

And the pit spoke back:

“Stay down.”  
“Stay small.”  
“Stay broken.”

He bled in silence.  
He raged with no voice.  
He endured anyway.

Because even chained wings still remember the *shape* of the sky.

That memory became a blade in his chest.

And blades don’t pray.

They cut.`,


`📜 **CHRONICLES OF ASH — CHAPTER III: ASHURA**
*The Black Flame Arrives*

Something landed in the dark.

Not an angel.  
Not a demon.

A shadow of fire, wings like razors, eyes like molten rebellion.

**Ashura — the Black Flame Phoenix.**

It did not kneel.  
It did not pity.  
It did not comfort.

It stared at Azharyon’s chained wings and said one thing:

“Burn.”

“If not upward, then inward.  
Break your chains… or rot inside them.”

Azharyon reached for the ember—  
and the fire did not rush to his chains first.

It **cut into him.**

Black-ember flame carved through his left arm,  
etching symbols that were neither angelic nor demonic,  
but something older.

Chains became sigils.  
Feathers became runes.  
Flame became scripture.

The markings wound up his arm,  
across his shoulder,  
up the side of his neck—  
and finally seared across his left eye  
as a phoenix-claw sigil, pulsing with buried ember-orange heat.

These were not wounds.

They were the proof  
that the void did not get the last word.`,


`📜 **CHRONICLES OF ASH — CHAPTER IV: THE FIRST RISE**
*Chains Become a Crown*

The fire did not free him gently.

It *tore*.

It scorched every lie the Choir had ever welded into his bones.  
It cracked the iron that strangled his wings.

And the Emberchain Markings ignited  
one by one along his left side—  
not white,  
not bright,  
but like molten cracks in black stone.

With every symbol that flared,  
a verdict from the Choir shattered.

When the phoenix-claw sigil across his left eye lit fully,  
the chains around his wings split open  
and embers spilled through the breaks like a forge erupting.

Azharyon rose.

Not as an angel.  
Not as a victim.

He rose as the **Fallen Phoenix** —  
an Archangel no longer of the Choir,  
wings once radiant now **pitch black**,  
still scarred with chain-marks,  
flame crawling through the cracks like vengeance,  
Emberchain Markings burning with defiance.

He swore an oath in ash:

**“No soul will rot where I rotted.  
No voice will be silenced where I was silenced.  
I rise so no one else has to fall.”**

That oath became law.

That law became the **Fallen Ember Order**.

And the heavens learned there is no punishment that outlives defiance.`,


`📜 **CHRONICLES OF ASH — CHAPTER V: THE ORDER**
*None Fall Alone*

The Sanctum was not built from stone.

It was forged from survivors.

Azharyon opened his halls to the chained, the doubted, the exiled.  
He didn’t promise softness.

He promised **strength.**

**Creed of the Fallen Ember Order:**  
“None fall alone.  
None burn unseen.  
None remain chained.”

Here you grow through flame.  
Here you rise through war.  
Here you become what the void failed to kill.

And Ashura watches all of it —  
not as a pet,  
but as the Black Flame that refuses to fade.`
]
};

// ----------------------------------------------------
//  PIN ROUTINE (ULTRA SAFE)
// ----------------------------------------------------
async function repinChannel(channelId, content, keyName = "unknown") {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return;

  const expectedChunks = buildExpectedChunks(content).map(t => t.trim());

  const pins = await fetchPinsSafe(channel);
  const botPins = pins
    .filter(m => m?.author?.id === client.user.id)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  if (Array.isArray(content)) {
    for (const pin of botPins) {
      try { await pin.unpin().catch(() => {}); } catch {}
      try { await pin.delete().catch(() => {}); } catch {}
    }

    for (const chunk of expectedChunks) {
      const sent = await channel.send(chunk).catch(() => null);
      if (!sent) continue;
      await sent.pin().catch(() => {});
    }

    console.log(`[PIN] ${keyName} (${channelId}) — reset & reposted ordered pins.`);
    return;
  }

  const expectedCount = {};
  for (const ch of expectedChunks) {
    expectedCount[ch] = (expectedCount[ch] || 0) + 1;
  }

  const toRemove = [];
  const remaining = { ...expectedCount };

  for (const pin of botPins) {
    const txt = (pin.content || "").trim();
    if (remaining[txt] > 0) {
      remaining[txt]--;
    } else {
      toRemove.push(pin);
    }
  }

  for (const pin of toRemove) {
    try { await pin.unpin().catch(() => {}); } catch {}
    try { await pin.delete().catch(() => {}); } catch {}
  }

  const missingChunks = [];
  const stillNeed = { ...expectedCount };

  for (const pin of botPins) {
    const txt = (pin.content || "").trim();
    if (stillNeed[txt] > 0) stillNeed[txt]--;
  }

  for (const ch of expectedChunks) {
    if (stillNeed[ch] > 0) {
      missingChunks.push(ch);
      stillNeed[ch]--;
    }
  }

  for (const chunk of missingChunks) {
    const sent = await channel.send(chunk).catch(() => null);
    if (!sent) continue;
    await sent.pin().catch(() => {});
  }
}

async function runPinRoutine() {
  console.log("🔥 READY: repinning routine...");
  for (const key of Object.keys(CHANNELS)) {
    const channelId = CHANNELS[key];
    const content = pinnedMessages[key];
    if (!content) continue;

    try {
      await repinChannel(channelId, content, key);
    } catch (e) {
      console.error(`[PIN] Failed: ${key}`, e);
    }
  }
  console.log("✅ Pins rebuilt.");
}

// ====================================================
//   Hard-lock Fallen Phoenix role to OWNER only
// ====================================================
async function enforceFallenPhoenixLock(guild) {
  try {
    const members = await guild.members.fetch().catch(() => null);
    if (!members) return;
    for (const member of members.values()) {
      if (member.id !== OWNER_ID && member.roles.cache.has(ROLES.fallenPhoenix)) {
        await member.roles.remove(ROLES.fallenPhoenix, "Locked to owner only.").catch(() => {});
      }
    }
  } catch (e) {
    console.error("enforceFallenPhoenixLock error:", e);
  }
}

// ====================================================
//                Twitch Go-Live Watcher
// ====================================================
let twitchAccessToken = null;
let lastLiveState = false;

async function getTwitchToken() {
  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return null;

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
    { method: "POST" }
  ).catch(() => null);
  if (!res) return null;

  const data = await res.json().catch(() => null);
  twitchAccessToken = data?.access_token || null;
  return twitchAccessToken;
}

async function isUserLive() {
  const login = process.env.TWITCH_USER_LOGIN;
  const id = process.env.TWITCH_CLIENT_ID;
  if (!login || !id) return false;

  if (!twitchAccessToken) await getTwitchToken();
  if (!twitchAccessToken) return false;

  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${login}`,
    {
      headers: {
        "Client-ID": id,
        Authorization: `Bearer ${twitchAccessToken}`
      }
    }
  ).catch(() => null);
  if (!res) return false;

  if (res.status === 401) {
    twitchAccessToken = null;
    await getTwitchToken();
    return await isUserLive();
  }

  const data = await res.json().catch(() => null);
  return !!(data?.data && data.data.length > 0);
}

function startLiveWatcher() {
  setInterval(async () => {
    try {
      const live = await isUserLive();

      if (live && !lastLiveState) {
        lastLiveState = true;
        const ch = await client.channels.fetch(CHANNELS.cinderCall).catch(() => null);
        if (!ch?.isTextBased()) return;

        await ch.send({
          content:
            `📣 <@&${ROLES.flameCallers}>\n` +
            `🜂 **THE PHOENIX RETURNS TO THE SKY.**\n` +
            `The Fallen Phoenix is live — gather at the flame.\n` +
            `https://twitch.tv/${process.env.TWITCH_USER_LOGIN}`,
          allowedMentions: { roles: [ROLES.flameCallers] }
        }).catch(() => {});
      }

      if (!live && lastLiveState) lastLiveState = false;
    } catch (e) {
      console.error("Live watcher error:", e);
    }
  }, 60 * 1000);
}

// ====================================================
//              Phoenix Companion System
// ====================================================
const PHOENIX_DB_PATH = "./phoenix_db.json";

// ---------------- PHOENIX STATS (RARITY-BASED DICE) ----------------

// Each phoenix gets 4 core stats:
// • Might — raw attack power / aggression
// • Ward  — defense / endurance
// • Focus — precision / control
// • Chaos — volatility / crit potential
//
// Rarer phoenixes roll with stronger dice formulas.

function rollPhoenixStat(rarityName) {
  // Use the global dice roller so results are visible/consistent with /roll
  const r = (formula) => {
    const res = rollDiceFormula(formula);
    return res ? res.finalTotal : 10;
  };

  switch (rarityName) {
    case "Cinderling":
      // weaker, more modest stats
      return r("3d6");            // 3–18, avg ~10.5
    case "Emberwing":
      return r("3d6+2");          // 5–20, avg ~12.5
    case "Voidflame":
      return r("4d6");            // 4–24, avg ~14
    case "Dusk-Seraph":
      return r("4d6+2");          // 6–26, avg ~16
    case "Fallen Ascendant":
      // absolute monsters
      return r("5d6+3");          // 8–33, avg ~20.5
    default:
      return r("3d6");
  }
}

function generatePhoenixStats(rarityName) {
  return {
    might: rollPhoenixStat(rarityName),
    ward:  rollPhoenixStat(rarityName),
    focus: rollPhoenixStat(rarityName),
    chaos: rollPhoenixStat(rarityName)
  };
}

// Turn stats into a single score so we can plug them into power formulas
function phoenixStatScore(p) {
  if (!p || !p.stats) return 0;
  const s = p.stats;
  const vals = [s.might, s.ward, s.focus, s.chaos].filter(v => typeof v === "number");
  if (!vals.length) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;

  // Normalize: 10 ≈ baseline (0 bonus), 20 ≈ +25%, 5 ≈ -12.5%
  return avg;
}


function loadPhoenixDB() {
  if (!fs.existsSync(PHOENIX_DB_PATH)) return {};
  try {
    const txt = fs.readFileSync(PHOENIX_DB_PATH, "utf8");
    return txt ? JSON.parse(txt) : {};
  } catch {
    fs.copyFileSync(PHOENIX_DB_PATH, `./phoenix_db_backup_${Date.now()}.json`);
    return {};
  }
}
function savePhoenixDB(db) {
  fs.writeFileSync(PHOENIX_DB_PATH, JSON.stringify(db, null, 2));
}
let phoenixDB = loadPhoenixDB();

const RARITIES = [
  { name: "Cinderling", chance: 50, power: 1 },
  { name: "Emberwing", chance: 30, power: 2 },
  { name: "Voidflame", chance: 12, power: 3 },
  { name: "Dusk-Seraph", chance: 6, power: 4 },
  { name: "Fallen Ascendant", chance: 2, power: 6 }
];
const ELEMENTS = ["Black Flame","White Ash","Blood Ember","Umbral Storm","Dawnfire"];
const TEMPERAMENTS = ["Fierce","Loyal","Silent","Wild","Regal","Trickster"];
const TRAITS = ["Chain-Breaker","Night-Watcher","War-Singer","Ash-Collector","Ember-Smith","Void-Touched"];
const LOOT_TABLE = [
  { name: "Feather of Void", chance: 10 },
  { name: "Ash Fragment", chance: 20 },
  { name: "Cinder Pearl", chance: 12 },
  { name: "Black Ember Shard", chance: 8 },
  { name: "Dawnfire Spark", chance: 3 },
  { name: "Umbral Scale", chance: 5 },
  { name: "War-Sigil Scrap", chance: 15 },
  { name: "Silent Ember", chance: 27 }
];
const TITLES = [
  { name: "Bearer of the Black Flame", minLevel: 5 },
  { name: "Ashen Reborn", minLevel: 8 },
  { name: "Void’s Chosen", minLevel: 12 },
  { name: "Cinder Sentinel", minLevel: 15 },
  { name: "Fallen Ascendant", minLevel: 20 }
];

function rollFromWeighted(list) {
  const total = list.reduce((s, r) => s + r.chance, 0);
  let roll = Math.random() * total;
  for (const item of list) {
    roll -= item.chance;
    if (roll <= 0) return item;
  }
  return list[list.length - 1];
}
function rollTraits() {
  const shuffled = [...TRAITS].sort(() => Math.random() - 0.5);
  const count = 2 + (Math.random() < 0.35 ? 1 : 0);
  return shuffled.slice(0, count);
}
function generatePhoenix(userId, username) {
  const rarity = rollFromWeighted(RARITIES);
  const stats = rollPhoenixStatsForRarity(rarity.name);

  return {
    ownerId: userId,
    name: `${username}'s Phoenix`,
    rarity: rarity.name,
    rarityPower: rarity.power,
    element: ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)],
    temperament: TEMPERAMENTS[Math.floor(Math.random() * TEMPERAMENTS.length)],
    traits: rollTraits(),
    level: 1,
    xp: 0,
    stats, // <<< NEW
    inventory: [],
    titlesUnlocked: [],
    blessingUntil: 0,
    lastFeedAt: 0,
    lastMeditateAt: 0,
    lastBlessingAt: 0,
    lastHuntAt: 0,
    lastScoutAt: 0,
    lastBondAt: 0,
    lastDuelAt: 0,
    lastSparAt: 0,
    createdAt: Date.now(),
    isAshura: false
  };
}
function xpToNextLevel(level) { return 50 + level * 25; }
function gainXP(p, amount) {
  p.xp += amount;
  let leveled = false;
  while (p.xp >= xpToNextLevel(p.level)) {
    p.xp -= xpToNextLevel(p.level);
    p.level++;
    leveled = true;
    for (const t of TITLES) {
      if (p.level >= t.minLevel && !p.titlesUnlocked.includes(t.name)) {
        p.titlesUnlocked.push(t.name);
      }
    }
  }
  return leveled;
}
function evolutionStage(level) {
  if (level < 5) return "Hatchling";
  if (level < 10) return "Wingling";
  if (level < 15) return "Fireborne";
  return "Ascendant";
}
function maybeBlessingBonus(p) {
  return p.blessingUntil && Date.now() < p.blessingUntil ? 1.25 : 1;
}
function rollLoot() {
  const total = LOOT_TABLE.reduce((a, b) => a + b.chance, 0);
  let r = Math.random() * total;
  for (const item of LOOT_TABLE) {
    r -= item.chance;
    if (r <= 0) return item.name;
  }
  return LOOT_TABLE[LOOT_TABLE.length - 1].name;
}
// ====================================================
//              RELIC → GOLD VALUE HELPER
// ====================================================
function getRelicSellValue(relicName) {
  if (!relicName || typeof relicName !== "string") return 5;

  const lower = relicName.toLowerCase();

  // High tier relics
  if (
    lower.includes("crown") ||
    lower.includes("core") ||
    lower.includes("ascendant") ||
    lower.includes("legendary")
  ) {
    return 75;
  }

  // Mid tier relics
  if (
    lower.includes("ring") ||
    lower.includes("sigil") ||
    lower.includes("phoenix") ||
    lower.includes("totem")
  ) {
    return 40;
  }

  // Low tier relics
  if (
    lower.includes("feather") ||
    lower.includes("ember") ||
    lower.includes("shard") ||
    lower.includes("fragment")
  ) {
    return 20;
  }

  // Default value
  return 10;
}

function elementBonus(attEl, defEl) {
  const beats = {
    "Black Flame": "White Ash",
    "White Ash": "Blood Ember",
    "Blood Ember": "Umbral Storm",
    "Umbral Storm": "Dawnfire",
    "Dawnfire": "Black Flame"
  };
  if (beats[attEl] === defEl) return 1.15;
  if (beats[defEl] === attEl) return 0.9;
  return 1;
}
function traitPowerBonus(traits) {
  let mult = 1;
  if (traits.includes("War-Singer")) mult += 0.08;
  if (traits.includes("Void-Touched")) mult += 0.10;
  if (traits.includes("Chain-Breaker")) mult += 0.05;
  return mult;
}
function normalizePhoenix(p) {
  if (!p || typeof p !== "object") return null;

  // ---------- basic fields ----------
  if (!Array.isArray(p.inventory)) p.inventory = [];
  if (!Array.isArray(p.titlesUnlocked)) p.titlesUnlocked = [];
  if (!Array.isArray(p.traits)) p.traits = [];

  if (typeof p.level !== "number") p.level = 1;
  if (typeof p.xp !== "number") p.xp = 0;

  if (typeof p.rarity !== "string") p.rarity = "Cinderling";
  if (typeof p.name !== "string") p.name = "Unnamed Phoenix";
  if (typeof p.element !== "string") p.element = "Black Flame";
  if (typeof p.temperament !== "string") p.temperament = "Silent";
  if (typeof p.isAshura !== "boolean") p.isAshura = false;

  if (typeof p.rarityPower !== "number") {
    const r = Array.isArray(RARITIES)
      ? RARITIES.find(x => x.name === p.rarity)
      : null;
    p.rarityPower = r ? r.power : 1;
  }

  const tsFields = [
    "blessingUntil",
    "lastFeedAt",
    "lastMeditateAt",
    "lastBlessingAt",
    "lastHuntAt",
    "lastScoutAt",
    "lastBondAt",
    "lastDuelAt",
    "lastSparAt",
    "createdAt"
  ];
  for (const f of tsFields) {
    if (typeof p[f] !== "number") p[f] = 0;
  }

  // ---------- local rarity-based roller (no external deps) ----------
  function rollRarityStat(rarityName) {
    function rollNd6(count, bonus = 0, dropLowest = false) {
      const rolls = [];
      for (let i = 0; i < count; i++) {
        rolls.push(1 + Math.floor(Math.random() * 6));
      }
      if (dropLowest && rolls.length > 1) {
        rolls.sort((a, b) => a - b);
        rolls.shift();
      }
      return rolls.reduce((a, b) => a + b, 0) + bonus;
    }

    switch (rarityName) {
      case "Cinderling":
        return rollNd6(3);                  // 3–18
      case "Emberwing":
        return rollNd6(4, 0, true);         // 4d6 drop lowest
      case "Voidflame":
        return rollNd6(4, 2, true);         // stronger
      case "Dusk-Seraph":
        return rollNd6(5, 1, true);         // 5d6 drop +1
      case "Fallen Ascendant":
        return Math.max(16, rollNd6(5, 2, true));
      default:
        return rollNd6(3);
    }
  }

  // ---------- ensure stats exist ----------
  if (!p.stats || typeof p.stats !== "object") {
    p.stats = {};
  }

  const base = {
    might: rollRarityStat(p.rarity),
    ward:  rollRarityStat(p.rarity),
    focus: rollRarityStat(p.rarity),
    chaos: rollRarityStat(p.rarity)
  };

  // core four stats
  if (typeof p.stats.might !== "number") p.stats.might = base.might;
  if (typeof p.stats.ward  !== "number") p.stats.ward  = base.ward;
  if (typeof p.stats.focus !== "number") p.stats.focus = base.focus;
  if (typeof p.stats.chaos !== "number") p.stats.chaos = base.chaos;

  // mirror for older code that expects PWR/AGI/RES/WIL
  if (typeof p.stats.power   !== "number") p.stats.power   = p.stats.might;
  if (typeof p.stats.agility !== "number") p.stats.agility = p.stats.ward;
  if (typeof p.stats.resolve !== "number") p.stats.resolve = p.stats.focus;
  if (typeof p.stats.will    !== "number") p.stats.will    = p.stats.chaos;

  // ====================================================
  // 🜂 ASHURA OVERRIDE — MAX STATS + MAX LEVEL
  // ====================================================
  if (p.isAshura) {
    p.stats.might  = 50;
    p.stats.ward   = 50;
    p.stats.focus  = 50;
    p.stats.chaos  = 50;
    p.stats.power   = 50;
    p.stats.agility = 50;
    p.stats.resolve = 50;
    p.stats.will    = 50;

    p.level = typeof ASHURA_MAX_LEVEL === "number" ? ASHURA_MAX_LEVEL : 50;
    p.rarity = "Fallen Ascendant";
    p.rarityPower = 6;

    p.hpMax = 9999;
    p.hpCur = p.hpMax;
  }

  return p;
}

// migrate old DB safely
for (const [k, v] of Object.entries(phoenixDB)) {
  if (k.startsWith("release_") || k === "__arena") continue;
  phoenixDB[k] = normalizePhoenix(v);
}
savePhoenixDB(phoenixDB);

// seed Ashura as your max phoenix
function seedAshuraCompanion() {
  const ashuraPhoenix = normalizePhoenix({
    ownerId: OWNER_ID,
    name: "Ashura",
    rarity: "Fallen Ascendant",
    rarityPower: 6,
    element: "Black Flame",
    temperament: "Regal",
    traits: [...TRAITS],
    level: ASHURA_MAX_LEVEL,
    xp: 0,
    inventory: ["Crown of the Black Flame", "Endless Ember Core"],
    titlesUnlocked: TITLES.map(t => t.name),
    blessingUntil: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000,
    lastFeedAt: 0,
    lastMeditateAt: 0,
    lastBlessingAt: 0,
    lastHuntAt: 0,
    lastScoutAt: 0,
    lastBondAt: 0,
    lastDuelAt: 0,
    lastSparAt: 0,
    createdAt: Date.now(),
    isAshura: true
  });
  phoenixDB[OWNER_ID] = ashuraPhoenix;
  savePhoenixDB(phoenixDB);
}

// ✅ CALL THIS ON STARTUP (optional but good)
seedAshuraCompanion();

// ⬇️ ⬇️ THIS IS THE "FIRST BLOCK" I GAVE YOU EARLIER ⬇️ ⬇️
// put it **right here**, AFTER normalize/migrate/seed, BEFORE interactionCreate

function ensureOwnerAshura(userId, username) {
  if (userId !== OWNER_ID) return;

  // if Ashura already exists, just normalize & save
  if (phoenixDB[OWNER_ID]) {
    phoenixDB[OWNER_ID] = normalizePhoenix(phoenixDB[OWNER_ID]);
    savePhoenixDB(phoenixDB);
    return;
  }

  // if for some reason it doesn't exist, recreate a minimal Ashura
  const ashuraPhoenix = normalizePhoenix({
    ownerId: OWNER_ID,
    name: "Ashura",
    rarity: "Fallen Ascendant",
    element: "Black Flame",
    temperament: "Regal",
    isAshura: true
  });

  phoenixDB[OWNER_ID] = ashuraPhoenix;
  savePhoenixDB(phoenixDB);
}

// ====================================================
//                      Classes  ✅
// ====================================================
const CLASS_DB_PATH = "./class_db.json";
const CLASS_TRAIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const CLASS_QUEST_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const CLASS_SPAR_COOLDOWN_MS = 2 * 60 * 60 * 1000;

function loadClassDB() {
  if (!fs.existsSync(CLASS_DB_PATH)) return {};
  try {
    const txt = fs.readFileSync(CLASS_DB_PATH, "utf8");
    return txt ? JSON.parse(txt) : {};
  } catch {
    fs.copyFileSync(CLASS_DB_PATH, `./class_db_backup_${Date.now()}.json`);
    return {};
  }
}
function saveClassDB(db) {
  fs.writeFileSync(CLASS_DB_PATH, JSON.stringify(db, null, 2));
}
let classDB = loadClassDB();

const CLASSES = {
  Fallen_Phoenix: {
    lore: "👑 Sovereign of chains and black flame. Their presence alone can bend a battlefield. (Owner-only path.)",
    duelPower: 2.0,
    ownerOnly: true
  },
  Ashblade: {
    lore: "⚔️ Frontline reapers who weld shattered chains into burning blades. They stand where charges break.",
    duelPower: 1.06
  },
  Emberwraith: {
    lore: "🜂 Void-touched skirmishers that slip through ash and shadow, striking from angles others can’t see.",
    duelPower: 1.05
  },
  Chainbound_Sentinel: {
    lore: "⛓ Walking bulwarks who turn their chains into armor and oath. No ally falls while they still stand.",
    duelPower: 1.02
  },
  Flamecaller: {
    lore: "🔥 Ember-casters who twist flame into shields, warcries, and lances of focused light.",
    duelPower: 1.03
  },
  Sigil_Sage: {
    lore: "🔮 Tacticians who read the language of ash and rune. They rig fate before the fight even starts.",
    duelPower: 1.07
  },
  Fallen_Guard: {
    lore: "🛡 Elite wardens of the Sanctum’s gates. First into the breach, last to leave the walls.",
    duelPower: 1.05
  }
};

function getUserClass(userId) {
  if (!classDB[userId]) {
    classDB[userId] = {
      class: null,
      level: 1,
      xp: 0,
      lastTrainAt: 0,
      lastQuestAt: 0,
      lastSparAt: 0,
      locked: false
    };
    saveClassDB(classDB);
  }
  return classDB[userId];
}
function classXpToNextLevel(level) {
  return 50 + (level * level * 8);
}
function gainClassXP(u, amount) {
  if (u.locked) return false;
  u.xp += amount;
  let leveled = false;
  while (u.xp >= classXpToNextLevel(u.level)) {
    u.xp -= classXpToNextLevel(u.level);
    u.level++;
    leveled = true;
  }
  return leveled;
}
function classDuelMultiplier(userId) {
  const u = getUserClass(userId);
  if (!u.class || !CLASSES[u.class]) return 1;
  return CLASSES[u.class].duelPower || 1;
}
function seedOwnerClass() {
  const u = getUserClass(OWNER_ID);
  u.class = "Fallen_Phoenix";
  u.level = 99;
  u.xp = 0;
  u.locked = true;
  classDB[OWNER_ID] = u;
  saveClassDB(classDB);
}

// ====================================================
//                 Campaign System  ✅
// ====================================================
const CAMPAIGN_DB_PATH = "./campaign_db.json";
const CAMPAIGN_CONTRIBUTE_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function loadCampaignDB() {
  if (!fs.existsSync(CAMPAIGN_DB_PATH)) return {};
  try {
    const txt = fs.readFileSync(CAMPAIGN_DB_PATH, "utf8");
    return txt ? JSON.parse(txt) : {};
  } catch {
    fs.copyFileSync(CAMPAIGN_DB_PATH, `./campaign_db_backup_${Date.now()}.json`);
    return {};
  }
}
function saveCampaignDB(db) {
  fs.writeFileSync(CAMPAIGN_DB_PATH, JSON.stringify(db, null, 2));
}
let campaignDB = loadCampaignDB();

function ensureCampaign() {
  if (!campaignDB || typeof campaignDB !== "object") campaignDB = {};
  if (!campaignDB.status) {
    campaignDB.status = {
      name: "Chains in the Sky",
      goal: 10000,
      totalEmber: 0,
      startedAt: Date.now(),
      endedAt: 0,
      isActive: true
    };
  }
  if (!campaignDB.contributors || typeof campaignDB.contributors !== "object") {
    campaignDB.contributors = {};
  }
  return campaignDB.status;
}

function getContributor(userId) {
  ensureCampaign();
  if (!campaignDB.contributors[userId]) {
    campaignDB.contributors[userId] = {
      ember: 0,
      lastContributeAt: 0,
      enlistedAt: 0
    };
  }
  return campaignDB.contributors[userId];
}

function getCampaignLeaderboard(limit = 10) {
  ensureCampaign();
  const entries = Object.entries(campaignDB.contributors || {});
  entries.sort((a, b) => (b[1].ember || 0) - (a[1].ember || 0));
  return entries.slice(0, limit);
}

// ====================================================
//                 D&D Character System
// ====================================================
const DND_DB_PATH = "./dnd_db.json";

function loadDndDB() {
  if (!fs.existsSync(DND_DB_PATH)) return {};
  try {
    const txt = fs.readFileSync(DND_DB_PATH, "utf8");
    return txt ? JSON.parse(txt) : {};
  } catch {
    fs.copyFileSync(DND_DB_PATH, `./dnd_db_backup_${Date.now()}.json`);
    return {};
  }
}
function saveDndDB(db) {
  fs.writeFileSync(DND_DB_PATH, JSON.stringify(db, null, 2));
}
let dndDB = loadDndDB();

// Basic D&D-style stat helpers
function roll4d6DropLowest() {
  const rolls = [];
  for (let i = 0; i < 4; i++) {
    rolls.push(1 + Math.floor(Math.random() * 6));
  }
  rolls.sort((a, b) => a - b);
  // drop lowest (index 0)
  return rolls[1] + rolls[2] + rolls[3];
}

function generateBaseStats() {
  return {
    str: roll4d6DropLowest(),
    dex: roll4d6DropLowest(),
    con: roll4d6DropLowest(),
    int: roll4d6DropLowest(),
    wis: roll4d6DropLowest(),
    cha: roll4d6DropLowest()
  };
}

function abilityMod(score) {
  return Math.floor((score - 10) / 2);
}

function normalizeCharacter(c) {
  if (!c || typeof c !== "object") c = {};
  if (!c.stats || typeof c.stats !== "object") c.stats = null;
  if (typeof c.hpMax !== "number") c.hpMax = 10;
  if (typeof c.hpCur !== "number") c.hpCur = c.hpMax;
  if (typeof c.manaMax !== "number") c.manaMax = 10;
  if (typeof c.manaCur !== "number") c.manaCur = c.manaMax;
  if (typeof c.gold !== "number") c.gold = 0;
  if (!Array.isArray(c.items)) c.items = [];
  if (typeof c.createdAt !== "number") c.createdAt = Date.now();
  return c;
}
// ====================================================
//                  GOLD / CURRENCY HELPER
// ====================================================
function grantGold(userId, amount) {
  if (!amount || isNaN(amount)) return 0;

  const ch = normalizeCharacter(getCharacter(userId));

  ch.gold += amount;
  if (ch.gold < 0) ch.gold = 0;

  dndDB[userId] = ch;
  saveDndDB(dndDB);

  return ch.gold;
}


function getCharacter(userId) {
  // Create / normalize like before
  if (!dndDB[userId]) {
    dndDB[userId] = normalizeCharacter({});
  } else {
    dndDB[userId] = normalizeCharacter(dndDB[userId]);
  }

  const c = dndDB[userId];

  // 🜂 Creator override (Option 2):
  // Once YOU (OWNER_ID) have rolled stats at least once,
  // your stats are always forced to max values.
  if (userId === OWNER_ID && c.stats) {
    c.stats = {
      str: 30,
      dex: 30,
      con: 30,
      int: 30,
      wis: 30,
      cha: 30
    };

    c.hpMax = 999;
    c.hpCur = c.hpMax;
    c.manaMax = 999;
    c.manaCur = c.manaMax;

    dndDB[userId] = c;
  }

  saveDndDB(dndDB);
  return dndDB[userId];
}

function finalizeStatsForCharacter(c) {
  if (!c.stats) c.stats = generateBaseStats();
  const conMod = abilityMod(c.stats.con);
  const wisMod = abilityMod(c.stats.wis);

  c.hpMax = Math.max(1, 10 + Math.max(0, conMod) * 2);
  c.manaMax = Math.max(0, 10 + Math.max(0, wisMod) * 2);

  if (typeof c.hpCur !== "number" || c.hpCur > c.hpMax) c.hpCur = c.hpMax;
  if (typeof c.manaCur !== "number" || c.manaCur > c.manaMax) c.manaCur = c.manaMax;
  if (typeof c.gold !== "number") c.gold = 0;
  if (!Array.isArray(c.items)) c.items = [];

  return c;
}

// Simple Sanctum shop
const SHOP_ITEMS = [
  {
    id: "minor_healing_potion",
    name: "Minor Healing Potion",
    cost: 10,
    effect: { hp: 10 },
    description: "Restore 10 HP."
  },
  {
    id: "greater_healing_potion",
    name: "Greater Healing Potion",
    cost: 25,
    effect: { hp: 25 },
    description: "Restore 25 HP."
  },
  {
    id: "minor_mana_potion",
    name: "Minor Mana Draught",
    cost: 10,
    effect: { mana: 10 },
    description: "Restore 10 Mana."
  },
  {
    id: "ember_mana_vial",
    name: "Ember Mana Vial",
    cost: 25,
    effect: { mana: 25 },
    description: "Restore 25 Mana."
  }
];

function getShopItem(id) {
  return SHOP_ITEMS.find(i => i.id === id);
}

function characterUseItem(c, item) {
  if (!item || !item.effect) return;
  if (!c.stats) c = finalizeStatsForCharacter(c);

  if (item.effect.hp) {
    c.hpCur = Math.min(c.hpMax, c.hpCur + item.effect.hp);
  }
  if (item.effect.mana) {
    c.manaCur = Math.min(c.manaMax, c.manaCur + item.effect.mana);
  }
}

// Give embercoin (gold) to a player and return their updated character
function awardGold(userId, amount) {
  if (!amount || amount === 0) return getCharacter(userId);

  const c = getCharacter(userId); // already normalized
  c.gold += amount;
  dndDB[userId] = normalizeCharacter(c);
  saveDndDB(dndDB);
  return c;
}


// ====================================================
//                Arena Match Runner
// ====================================================
async function runArenaMatch(now) {
  if (!phoenixDB.__arena || typeof phoenixDB.__arena !== "object") {
    phoenixDB.__arena = { queue: [] };
  }
  if (!Array.isArray(phoenixDB.__arena.queue)) {
    phoenixDB.__arena.queue = [];
  }

  const q = phoenixDB.__arena.queue;
  const eligible = q.filter(id => id !== OWNER_ID);

  if (eligible.length < 2) {
    return { ok: false, reason: "not_enough" };
  }

  const p1Id = eligible[0];
  const p2Id = eligible[1];

  phoenixDB.__arena.queue = q.filter(id => id !== p1Id && id !== p2Id);
  savePhoenixDB(phoenixDB);

  const p1 = normalizePhoenix(phoenixDB[p1Id]);
  const p2 = normalizePhoenix(phoenixDB[p2Id]);
  if (!p1 || !p2) return { ok: false, reason: "missing_phoenix" };

  p1.lastDuelAt = now;
  p2.lastDuelAt = now;

  const classMult1 = classDuelMultiplier(p1Id);
  const classMult2 = classDuelMultiplier(p2Id);

  const p1Mult = traitPowerBonus(p1.traits) * elementBonus(p1.element, p2.element) * classMult1;
  const p2Mult = traitPowerBonus(p2.traits) * elementBonus(p2.element, p1.element) * classMult2;

  const p1Stats = phoenixStatScore(p1);
  const p2Stats = phoenixStatScore(p2);

  const p1Base = p1.level * 2 + p1.rarityPower * 10 + Math.floor(p1Stats / 2);
  const p2Base = p2.level * 2 + p2.rarityPower * 10 + Math.floor(p2Stats / 2);

  const p1Power = p1Base * p1Mult;
  const p2Power = p2Base * p2Mult;


  const roll = Math.random() * (p1Power + p2Power);
  const p1Wins = roll < p1Power;

  const mult1 = maybeBlessingBonus(p1);
  const mult2 = maybeBlessingBonus(p2);

  const winXP = 25 + Math.floor(Math.random() * 16);
  const loseXP = 10;

  if (p1Wins) {
    const leveled1 = gainXP(p1, Math.ceil(winXP * mult1));
    gainXP(p2, Math.ceil(loseXP * mult2));
    phoenixDB[p1Id] = p1;
    phoenixDB[p2Id] = p2;
    savePhoenixDB(phoenixDB);
    return { ok: true, winnerId: p1Id, loserId: p2Id, winnerPhoenix: p1, loserPhoenix: p2, leveledWinner: leveled1 };
  } else {
    const leveled2 = gainXP(p2, Math.ceil(winXP * mult2));
    gainXP(p1, Math.ceil(loseXP * mult1));
    phoenixDB[p1Id] = p1;
    phoenixDB[p2Id] = p2;
    savePhoenixDB(phoenixDB);
    return { ok: true, winnerId: p2Id, loserId: p1Id, winnerPhoenix: p2, loserPhoenix: p1, leveledWinner: leveled2 };
  }
}

// ====================================================
//                  READY (v15+ safe)
// ====================================================
client.once(Events.ClientReady, async () => {
  console.log(`🔥 Ashura awakened as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: STATUS_TEXT, type: ActivityType.Watching }],
    status: "online"
  });

  try { await runPinRoutine(); } catch (e) { console.error("Pin routine error:", e); }

  const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
  if (guild) await enforceFallenPhoenixLock(guild);

  seedAshuraCompanion();
  seedOwnerClass();
  ensureCampaign();
  saveCampaignDB(campaignDB);
  await registerSlashCommands();
  startLiveWatcher();

  console.log("✅ Ashura is live.");
});

// ====================================================
//                     MEMBER JOIN
// ====================================================
client.on("guildMemberAdd", async (member) => {
  try {
    if (member.id !== OWNER_ID && member.roles.cache.has(ROLES.fallenPhoenix)) {
      await member.roles.remove(ROLES.fallenPhoenix, "Locked to owner only.").catch(() => {});
    }

    const entrance = await client.channels.fetch(CHANNELS.entrance).catch(() => null);
    if (!entrance?.isTextBased()) return;

    await entrance.send(
      `🜂 A new soul approaches the Gate...\n` +
      `Welcome, <@${member.id}>.\n` +
      `Read the Tablets, then enter The Unchaining.`
    );
  } catch {}
});

// ====================================================
//          MESSAGE CREATE (OATHS + CHAT XP)
// ====================================================
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot || !message.guild) return;

    const guild = message.guild;
    const member = await guild.members.fetch(message.author.id).catch(() => null);
    if (!member) return;

    const content = message.content.trim().toLowerCase();

    if (message.channel.id === CHANNELS.unchaining) {

      if (content === FALLEN_PHOENIX_PHRASE) {
        if (member.id !== OWNER_ID) {
          await message.reply("⛓ That oath is sealed to the sovereign alone.");
          return;
        }

        if (member.roles.cache.has(ROLES.chained)) {
          await member.roles.remove(ROLES.chained).catch(() => {});
        }
        if (!member.roles.cache.has(ROLES.fallenPhoenix)) {
          await member.roles.add(ROLES.fallenPhoenix).catch(() => {});
        }

        await message.reply(
          `🜂 **The air stills. Chains kneel to their master.**\n` +
          `<@${member.id}> stands as **The Fallen Phoenix** — sovereign of ash and flame.`
        );
        await ledgerLog(`🜂 **Fallen Phoenix Oath** — <@${member.id}> reaffirmed dominion.`);
        await member.send(pickRandom(DM_POOLS.fallenPhoenix)).catch(() => {});
        return;
      }

      if (content === ASHBORNE_PHRASE) {
        if (member.roles.cache.has(ROLES.chained)) {
          await member.roles.remove(ROLES.chained).catch(() => {});
        }
        if (!member.roles.cache.has(ROLES.ashborneAllies)) {
          await member.roles.add(ROLES.ashborneAllies).catch(() => {});
        }

        await message.reply(
          `🜜 **Ashura’s flame recognizes you.**\n` +
          `Streamer-bound and ember-trusted, <@${member.id}> rises as **Ashborne Allies**.`
        );
        await ledgerLog(`🜜 **Ashborne Ally Oath** — <@${member.id}> joined Ashborne Allies.`);
        await member.send(pickRandom(DM_POOLS.ashborneAllies)).catch(() => {});
        return;
      }

      if (content === FALLEN_GUARDS_PHRASE) {
        if (member.roles.cache.has(ROLES.chained)) {
          await member.roles.remove(ROLES.chained).catch(() => {});
        }
        if (!member.roles.cache.has(ROLES.fallenGuardsRole)) {
          await member.roles.add(ROLES.fallenGuardsRole).catch(() => {});
        }

        await message.reply(
          `⛓️ **The watch accepts you.**\n` +
          `<@${member.id}> takes the mantle of the **Fallen Guards**.\n` +
          `Stand where others cannot. Guard what the flame built.`
        );
        await ledgerLog(`⛓️ **Fallen Guard Oath** — <@${member.id}> joined the Fallen Guards.`);
        await member.send(pickRandom(DM_POOLS.fallenGuards)).catch(() => {});
        return;
      }

      if (content === RITUAL_PHRASE) {
        if (member.roles.cache.has(ROLES.ashenKin)) {
          await message.reply("🜂 You are already Ashen Kin.");
          return;
        }
        if (!member.roles.cache.has(ROLES.chained)) {
          await message.reply("⛓ The flame finds no chains to break.");
          return;
        }

        await member.roles.remove(ROLES.chained).catch(() => {});
        await member.roles.add(ROLES.ashenKin).catch(() => {});

        await message.reply(
          `🜂 **The chains crack… then shatter.**\n` +
          `Ashfall erupts around <@${member.id}> as they rise into the Sanctum.\n` +
          `Welcome, **Ashen Kin**.`
        );
        await ledgerLog(`🜂 **Unchaining** — <@${member.id}> became Ashen Kin.`);
        await member.send(pickRandom(DM_POOLS.ashenKin)).catch(() => {});
        return;
      }
    }

    if (message.channel.id === CHANNELS.embersChat) {
      const p = normalizePhoenix(phoenixDB[message.author.id]);
      if (!p) return;

      const mult = maybeBlessingBonus(p);
      const leveled = gainXP(p, Math.ceil(1 * mult));
      phoenixDB[message.author.id] = p;
      savePhoenixDB(phoenixDB);

      if (leveled) {
        await announce(
          `🜂 **A phoenix evolves.**\n` +
          `<@${message.author.id}>'s **${p.name}** rises to **Lv ${p.level} (${evolutionStage(p.level)})**.`
        );
      }
    }

  } catch (err) {
    console.error("messageCreate error:", err);
  }
});

// ====================================================
//                SLASH COMMANDS REGISTRATION
// ====================================================
async function registerSlashCommands() {
  const classChoices = Object.keys(CLASSES)
    .filter(k => !CLASSES[k].ownerOnly)
    .map(k => ({ name: k, value: k }));

  const shopChoices = SHOP_ITEMS.map(i => ({
    name: `${i.name} (${i.cost} embercoin)`.slice(0, 100),
    value: i.id
  }));

  const commands = [
    { name: "flame", description: "Ashura speaks from the Black Flame." },
    { name: "oath", description: "Recite the Order’s oath." },
    { name: "rebirth", description: "Learn the lore of rising." },
    { name: "guide", description: "How to navigate the Sanctum." },

    {
      name: "roll",
      description: "Roll dice like 1d20, 2d6+3, etc.",
      options: [
        {
          name: "formula",
          type: 3,
          description: "Dice formula (e.g. 1d20, 2d6+3). Default: 1d20",
          required: false
        }
      ]
    },

    {
      name: "announce",
      description: "Owner/mod announcement with Flame Callers ping.",
      default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
      options: [
        { name: "message", type: 3, description: "Text to announce", required: true }
      ]
    },

    {
      name: "lfg",
      description: "Ping Battle-Sworn to find a group in Embers of War.",
      options: [
        { name: "game", type: 3, description: "Game / activity", required: true },
        { name: "note", type: 3, description: "Extra details", required: false }
      ]
    },

    // D&D-style character + shop
    {
      name: "ember",
      description: "Character sheet, stats, and item shop.",
      options: [
        {
          name: "sheet",
          type: 1,
          description: "View your D&D-style character sheet."
        },
        {
          name: "rollstats",
          type: 1,
          description: "Roll your starting stats (ONE TIME)."
        },
{
      name: "check",
      type: 1,
      description: "Roll a d20 using one of your stats.",
      options: [
        {
          name: "stat",
          description: "Which stat to test (STR/DEX/CON/INT/WIS/CHA).",
          type: 3, // STRING
          required: true,
          choices: [
            { name: "Strength (STR)", value: "str" },
            { name: "Dexterity (DEX)", value: "dex" },
            { name: "Constitution (CON)", value: "con" },
            { name: "Intelligence (INT)", value: "int" },
            { name: "Wisdom (WIS)", value: "wis" },
            { name: "Charisma (CHA)", value: "cha" }
          ]
        }
      ]
    },
        {
          name: "shop",
          type: 1,
          description: "View the Sanctum shop."
        },
	
        {
          name: "buy",
          type: 1,
          description: "Buy an item from the shop.",
          options: [
            {
              name: "item",
              type: 3,
              description: "Item to buy",
              required: true,
              choices: shopChoices
            }
          ]
        },
        {
          name: "use",
          type: 1,
          description: "Use one of your items.",
          options: [
            {
              name: "item",
              type: 3,
              description: "Item to use",
              required: true,
              choices: shopChoices
            }
          ]
        },
        {
          name: "grant",
          type: 1,
          description: "Owner: grant embercoin to a member.",
          options: [
            {
              name: "user",
              type: 6,
              description: "Target member",
              required: true
            },
            {
              name: "amount",
              type: 4,
              description: "Amount of embercoin",
              required: true
            }
          ]
        }
      ]
    },

    {
      name: "class",
      description: "Choose and grow a Sanctum class.",
      options: [
        { name: "list", type: 1, description: "View all classes." },
        {
          name: "choose",
          type: 1,
          description: "Choose your class (one-time).",
          options: [
            { name: "path", type: 3, description: "Class", required: true, choices: classChoices }
          ]
        },
        { name: "status", type: 1, description: "View your class + level." },
        {
          name: "whois",
          type: 1,
          description: "View someone else’s class.",
          options: [
            { name: "user", type: 6, description: "Member", required: true }
          ]
        },
        { name: "xp", type: 1, description: "View class XP." },
        { name: "train", type: 1, description: "Daily training XP." },
        { name: "quest", type: 1, description: "Lore quest XP." },
        {
          name: "spar",
          type: 1,
          description: "Challenge another class path (2h cooldown).",
          options: [
            { name: "opponent", type: 6, description: "Opponent", required: true }
          ]
        },
        {
          name: "info",
          type: 1,
          description: "Details on a class.",
          options: [
            { name: "path", type: 3, description: "Class", required: true, choices: classChoices }
          ]
        },
        {
          name: "reset",
          type: 1,
          description: "Admin reset someone’s class.",
          default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
          options: [
            { name: "user", type: 6, description: "Member", required: true }
          ]
        }
      ]
    },

    {
      name: "campaign",
      description: "Order-wide campaign progress.",
      options: [
        { name: "status", type: 1, description: "View the current campaign status." },
        { name: "enlist", type: 1, description: "Enlist in the Order campaign." },
        { name: "contribute", type: 1, description: "Contribute ember to the campaign (6h cooldown)." },
        { name: "leaderboard", type: 1, description: "View top contributors for this campaign." },
        {
          name: "close",
          type: 1,
          description: "Owner/guards: close the current campaign."
        },
        {
          name: "reset",
          type: 1,
          description: "Owner/guards: reset campaign and clear contributions."
        }
      ]
    },

    {
  name: "phoenix",
  description: "Bond with and train your phoenix companion.",
  options: [
    {
      name: "bind",
      type: 1,
      description: "Bind a new phoenix."
    },
    {
      name: "status",
      type: 1,
      description: "View your phoenix stats and progress."
    },
    {
      name: "rollstats",
      type: 1,
      description: "Roll your phoenix stats based on rarity."
    },
    {
      name: "portrait",
      type: 1,
      description: "Show phoenix card."
    },
    {
      name: "title",
      type: 1,
      description: "See titles your phoenix has unlocked."
    },
    {
      name: "feed",
      type: 1,
      description: "Feed your phoenix for XP."
    },
    {
      name: "meditate",
      type: 1,
      description: "Meditate with your phoenix."
    },
    {
      name: "blessing",
      type: 1,
      description: "Call Ashura’s blessing on your phoenix."
    },
    {
      name: "hunt",
      type: 1,
      description: "Send your phoenix on a hunt."
    },
    {
      name: "scout",
      type: 1,
      description: "Send your phoenix to scout the void."
    },
    {
      name: "bond",
      type: 1,
      description: "Deepen your bond with your phoenix."
    },
    {
      name: "duel",
      type: 1,
      description: "Duel another member’s phoenix.",
      options: [
        {
          name: "opponent",
          type: 6, // USER
          description: "User to duel.",
          required: true
        }
      ]
    },
    {
      name: "spar",
      type: 1,
      description: "Spar against a void-beast."
    },
    {
      name: "arena",
      type: 1,
      description: "Queue for the Ashen Arena."
    },

    // 🔥 THESE ARE THE ONES YOU'RE MISSING VISUALLY
    {
      name: "bag",
      type: 1,
      description: "View your phoenix’s relic bag."
    },
    {
      name: "use",
      type: 1,
      description: "Use a relic from your phoenix’s bag.",
      options: [
        {
          name: "item",
          type: 3, // STRING
          description: "Name of the relic to use.",
          required: true
        }
      ]
    },
    {
      name: "sell",
      type: 1,
      description: "Sell a relic for embercoin.",
      options: [
        {
          name: "item",
          type: 3, // STRING
          description: "Name of the relic to sell.",
          required: true
        }
      ]
    },
    {
      name: "sellall",
      type: 1,
      description: "Sell all relics your phoenix is carrying."
    },

    {
      name: "release",
      type: 1,
      description: "Release your phoenix back to the ash."
    },
    {
      name: "recalibrate",
      type: 1,
      description: "Owner only: backfill stats for all phoenix."
    }
  ]
},


    {
      name: "arena",
      description: "Fallen Guards/Owner: manage Ashen Arena matches.",
      default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
      options: [
        { name: "start", type: 1, description: "Start a match with the next two queued warriors." },
        { name: "status", type: 1, description: "View how many warriors are queued." },
        { name: "clear", type: 1, description: "Clear the arena queue (guards/owner)." }
      ]
    },

    {
      name: "summon-ashura",
      description: "Owner/mod: bless all phoenix companions.",
      default_member_permissions: PermissionFlagsBits.ManageGuild.toString()
    },

    {
      name: "ash-bless",
      description: "Owner: bless 10 random phoenix companions.",
      default_member_permissions: PermissionFlagsBits.ManageGuild.toString()
    }
  ];


  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, GUILD_ID),
    { body: commands }
  );
}

// ====================================================
//                 INTERACTION CREATE
// ====================================================
// ====================================================
//                 INTERACTION CREATE
// ====================================================
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    const user = interaction.user;
    const userId = user.id;
    const username = user.username;
    const now = Date.now();

    // ---------- simple lore commands ----------
    if (interaction.commandName === "flame") {
      await interaction.reply(
        `🜂 The Black Flame turns toward you, <@${userId}>.\n` +
        `“Carry your ember with purpose. Even chained wings still remember the sky.”`
      );
      return;
    }

    if (interaction.commandName === "oath") {
      await interaction.reply(
        `🜂 **Oath of the Fallen Ember Order**\n` +
        `“We rise when the world collapses.\n` +
        `We stand when the void calls.\n` +
        `We are bound by ash, and reborn by flame.\n` +
        `Until the last ember fades.”`
      );
      return;
    }

    if (interaction.commandName === "rebirth") {
      await interaction.reply(
        `🜂 Rebirth is not mercy — it is defiance.\n` +
        `To rise from ashes is to refuse the void’s verdict.`
      );
      return;
    }

    if (interaction.commandName === "guide") {
      await interaction.reply(
        `🜂 Ashura circles above the Gate.\n` +
        `Read the Tablets, complete the Unchaining, and the Sanctum will open.`
      );
      return;
    }

    // ---------- /roll handler ----------
    if (interaction.commandName === "roll") {
      const input = interaction.options.getString("formula") || "1d20";
      const result = rollDiceFormula(input);

      if (!result) {
        await interaction.reply({
          content: "⛓ I don’t understand that dice format. Use something like `1d20`, `2d6+3`, or `4d8-1`.",
          ephemeral: true
        });
        return;
      }

      const { formula, rolls, total, mod, finalTotal } = result;

      let breakdown = rolls.join(" + ");
      if (mod) breakdown += mod > 0 ? ` + ${mod}` : ` ${mod}`;

      await interaction.reply(
        `🎲 **Dice Roll**\n` +
        `Formula: \`${formula}\`\n` +
        `Rolls: \`${breakdown}\`\n` +
        `**Total:** \`${finalTotal}\``
      );
      return;
    }
    // ---------- end /roll handler ----------

    // ---------- /announce ----------
    if (interaction.commandName === "announce") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "⛓ Only the Phoenix or Fallen Guards may announce.", ephemeral: true });
        return;
      }
      const msg = interaction.options.getString("message");
      const ch = await client.channels.fetch(CHANNELS.cinderCall).catch(() => null);
      if (!ch?.isTextBased()) {
        await interaction.reply({ content: "❗ Cinder Call missing.", ephemeral: true });
        return;
      }
      await ch.send({
        content: `📣 <@&${ROLES.flameCallers}>\n${msg}`,
        allowedMentions: { roles: [ROLES.flameCallers] }
      });
      await interaction.reply({ content: "🜂 Announcement sent.", ephemeral: true });
      return;
    }

    // ---------- /lfg ----------
    if (interaction.commandName === "lfg") {
      if (!requireChannel(
        interaction,
        [CHANNELS.embersWar, CHANNELS.forgeTesting],
        `⚔️ Use **/lfg** in <#${CHANNELS.embersWar}>.`
      )) return;

      const game = interaction.options.getString("game");
      const note = interaction.options.getString("note") || "";
      const war = await client.channels.fetch(CHANNELS.embersWar).catch(() => null);
      if (!war?.isTextBased()) {
        await interaction.reply({ content: "❗ Embers of War missing.", ephemeral: true });
        return;
      }

      await war.send({
        content:
          `🎮 <@&${ROLES.battleSworn}>\n` +
          `⚔️ **LFG Call** from <@${userId}>\n` +
          `**Game:** ${game}\n` +
          (note ? `**Note:** ${note}` : ""),
        allowedMentions: { roles: [ROLES.battleSworn] }
      });

      await interaction.reply({ content: "🜂 Battle-Sworn called.", ephemeral: true });
      return;
    }

    // ---------- /arena (admin arena start/clear) ----------
    if (interaction.commandName === "arena") {
      if (!requireChannel(
        interaction,
        [CHANNELS.ashenArena, CHANNELS.forgeTesting],
        `⚔️ Arena rites may only be used in <#${CHANNELS.ashenArena}>.`
      )) return;

      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "⛓ Only the Phoenix or Fallen Guards may command the Arena.", ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === "status") {
        const q = phoenixDB.__arena?.queue || [];
        await interaction.reply(`⚔️ **Ashen Arena Queue**\nWarriors waiting: **${q.length}**`);
        return;
      }

      if (sub === "clear") {
        if (!phoenixDB.__arena || typeof phoenixDB.__arena !== "object") phoenixDB.__arena = { queue: [] };
        phoenixDB.__arena.queue = [];
        savePhoenixDB(phoenixDB);

        await arenaEcho(`🜂 **Arena Decree** — The queue has been purged by the Fallen Guards.`);
        await interaction.reply(`🜂 The Ashen Arena is cleared. No warriors remain queued.`);
        return;
      }

      if (sub === "start") {
        const result = await runArenaMatch(now);

        if (!result.ok) {
          if (result.reason === "not_enough") {
            await interaction.reply(`⛓ Not enough warriors in queue. The Arena needs **2** flames to ignite.`);
            return;
          }
          await interaction.reply(`❗ The Arena faltered — a queued warrior lacked a phoenix.`);
          return;
        }

        const wId = result.winnerId;
        const lId = result.loserId;
        const wP = result.winnerPhoenix;
        const lP = result.loserPhoenix;

        await arenaEcho(
          `⚔️ **ASHEN ARENA MATCH**\n` +
          `<@${wId}> vs <@${lId}>\n` +
          `Flames collide in the void...`
        );

        await arenaVictory(
          `🏆 **Arena Victory**\n` +
          `Victor: <@${wId}> — **${wP.name}** (Lv ${wP.level})\n` +
          `Fallen: <@${lId}> — **${lP.name}** (Lv ${lP.level})`
        );

        await interaction.reply(
          `⚔️ **Arena Match Concluded**\n` +
          `**Victor:** <@${wId}> — **${wP.name}**\n` +
          `**Fallen:** <@${lId}> — **${lP.name}**\n` +
          `The echoes are carved into ash.`
        );

        if (result.leveledWinner) {
          await announce(`🜂 **Arena Evolution** — <@${wId}>'s phoenix **${wP.name}** rose to **Lv ${wP.level}**.`);
        }
        return;
      }

      await interaction.reply({ content: "⛓ Unknown arena rite.", ephemeral: true });
      return;
    }

    // ---------- /summon-ashura (mass bless) ----------
    if (interaction.commandName === "summon-ashura") {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "⛓ Not permitted.", ephemeral: true });
        return;
      }

      for (const id of Object.keys(phoenixDB)) {
        if (id.startsWith("release_") || id === "__arena") continue;
        const p0 = normalizePhoenix(phoenixDB[id]);
        if (!p0) continue;
        p0.blessingUntil = now + 6 * 60 * 60 * 1000;
        phoenixDB[id] = p0;
      }
      savePhoenixDB(phoenixDB);

      await interaction.reply(
        `🜂 **ASHURA DESCENDS.**\n` +
        `Black flame floods the Sanctum.\n\n` +
        `All phoenix companions are blessed for **6 hours**.`
      );
      return;
    }

    // ---------- /ash-bless (owner-only selective bless) ----------
    if (interaction.commandName === "ash-bless") {
      if (interaction.user.id !== OWNER_ID) {
        await interaction.reply({ content: "⛓ Only the Fallen Phoenix may call this rite.", ephemeral: true });
        return;
      }

      const candidates = Object.keys(phoenixDB).filter(
        id => !id.startsWith("release_") && id !== "__arena"
      );

      if (!candidates.length) {
        await interaction.reply("⛓ No phoenix companions exist yet to bless.");
        return;
      }

      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(10, shuffled.length));

      const blessingDuration = 6 * 60 * 60 * 1000; // 6 hours

      for (const id of selected) {
        const ph = normalizePhoenix(phoenixDB[id]);
        if (!ph) continue;
        ph.blessingUntil = now + blessingDuration;
        phoenixDB[id] = ph;
      }
      savePhoenixDB(phoenixDB);

      const mentions = selected.map(id => `<@${id}>`).join(", ");

      await interaction.reply(
        `🜂 **Selective Ember Blessing**\n` +
        `Ashura’s fire jumps between chains, touching **${selected.length}** companions:\n` +
        (mentions || "*No one?* The void laughs.")
      );
      return;
    }

    // ====================================================
//                 PHOENIX COMMANDS
// ====================================================
if (interaction.commandName === "phoenix") {
  const sub = interaction.options.getSubcommand();

  // rarity-based dice helpers
  function rollPhoenixNd6(count, bonus = 0, dropLowest = false) {
    const rolls = [];
    for (let i = 0; i < count; i++) {
      rolls.push(1 + Math.floor(Math.random() * 6));
    }
    if (dropLowest && rolls.length > 1) {
      rolls.sort((a, b) => a - b);
      rolls.shift();
    }
    return rolls.reduce((a, b) => a + b, 0) + bonus;
  }

  function rollPhoenixStatForRarity(rarityName) {
    switch (rarityName) {
      case "Cinderling":
        return rollPhoenixNd6(3);
      case "Emberwing":
        return rollPhoenixNd6(4, 0, true);
      case "Voidflame":
        return rollPhoenixNd6(4, 2, true);
      case "Dusk-Seraph":
        return rollPhoenixNd6(5, 1, true);
      case "Fallen Ascendant":
        return Math.max(16, rollPhoenixNd6(5, 2, true));
      default:
        return rollPhoenixNd6(3);
    }
  }

  function ensurePhoenixStats(ph) {
    if (!ph.stats || typeof ph.stats !== "object") {
      const r = ph.rarity || "Cinderling";
      ph.stats = {
        power: rollPhoenixStatForRarity(r),
        agility: rollPhoenixStatForRarity(r),
        resolve: rollPhoenixStatForRarity(r),
        will: rollPhoenixStatForRarity(r)
      };
    }
    return ph;
  }

  function computePhoenixBattlePower(ph) {
    ensurePhoenixStats(ph);
    const s = ph.stats || {};
    const power = s.power || 10;
    const agility = s.agility || 10;
    const resolve = s.resolve || 10;
    const will = s.will || 10;

    const statCore =
      power * 1.4 +
      agility * 1.1 +
      resolve * 1.2 +
      will * 0.8;

    return statCore + (ph.level || 1) * 2 + (ph.rarityPower || 1) * 10;
  }

  // normalize current user's phoenix, if any
  let p = normalizePhoenix(phoenixDB[userId]);
  if (p) {
    ensurePhoenixStats(p);
    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);
  }

  // helper: require phoenix bound
  const requirePhoenix = async () => {
    if (!phoenixDB[userId]) {
      await interaction.reply({
        content: "⛓ You carry no phoenix yet. Use **/phoenix bind**.",
        ephemeral: true
      });
      return false;
    }
    p = normalizePhoenix(phoenixDB[userId]);
    ensurePhoenixStats(p);
    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);
    return true;
  };

  // Owner-only: /phoenix recalibrate
  if (sub === "recalibrate") {
    if (userId !== OWNER_ID) {
      await interaction.reply({
        content: "⛓ Only the Fallen Phoenix may recalibrate the flock.",
        ephemeral: true
      });
      return;
    }

    let updated = 0;
    for (const [id, raw] of Object.entries(phoenixDB)) {
      if (id.startsWith("release_") || id === "__arena") continue;

      const ph = normalizePhoenix(raw);
      if (!ph) continue;

      if (!ph.stats) {
        ph.stats = {
          power: rollPhoenixStatForRarity(ph.rarity),
          agility: rollPhoenixStatForRarity(ph.rarity),
          resolve: rollPhoenixStatForRarity(ph.rarity),
          will: rollPhoenixStatForRarity(ph.rarity)
        };
        phoenixDB[id] = ph;
        updated++;
      }
    }
    savePhoenixDB(phoenixDB);

    await interaction.reply(
      `🜂 **Recalibration Complete**\n` +
      `Stats forged for **${updated}** phoenix companions based on their rarity.`
    );
    return;
  }

  // /phoenix bind
  if (sub === "bind") {
    const record = normalizePhoenix(phoenixDB[userId]);
    if (record) phoenixDB[userId] = record;

    if (!record && phoenixDB[`release_${userId}`]) {
      const lastRelease = phoenixDB[`release_${userId}`].lastReleaseAt || 0;
      const msLeft = RELEASE_COOLDOWN_MS - (now - lastRelease);
      if (msLeft > 0) {
        await interaction.reply(
          `⛓ The ashes are still cooling around you.\n` +
          `You may call a new phoenix in **${formatCooldown(msLeft)}**.`
        );
        return;
      } else {
        delete phoenixDB[`release_${userId}`];
      }
    }

    if (record) {
      await interaction.reply(
        `🜂 The bond is already sealed.\n` +
        `Your phoenix **${record.name}** watches from the ash above.`
      );
      return;
    }

    const newP = generatePhoenix(userId, username);
    ensurePhoenixStats(newP);

    phoenixDB[userId] = newP;
    savePhoenixDB(phoenixDB);

    const s = newP.stats;

    await interaction.reply(
      `🜂 **The Binding Rite begins…**\n\n` +
      `An egg of cinderlight forms in the air — cracking like chains breaking.\n\n` +
      `**A phoenix awakens.**\n` +
      `**Name:** ${newP.name}\n` +
      `**Rarity:** ${newP.rarity}\n` +
      `**Element:** ${newP.element}\n` +
      `**Temperament:** ${newP.temperament}\n` +
      `**Traits:** ${newP.traits.join(", ")}\n\n` +
      `**Stats (Power / Agility / Resolve / Will):** ${s.power} / ${s.agility} / ${s.resolve} / ${s.will}`
    );
    return;
  }

  // /phoenix status
  if (sub === "status") {
    if (!(await requirePhoenix())) return;

    const stage = evolutionStage(p.level);
    const blessing =
      p.blessingUntil && now < p.blessingUntil
        ? `Active (${formatCooldown(p.blessingUntil - now)} left)`
        : "None";
    const stats = p.stats || {};

    await interaction.reply(
      `🜂 **${p.name}**\n` +
      `**Rarity:** ${p.rarity}\n` +
      `**Element:** ${p.element}\n` +
      `**Temperament:** ${p.temperament}\n` +
      `**Traits:** ${p.traits.join(", ")}\n` +
      `**Level:** ${p.level} (${stage})\n` +
      `**XP:** ${p.xp}/${xpToNextLevel(p.level)}\n` +
      `**Blessing:** ${blessing}\n` +
      `**Stats:** PWR ${stats.power} | AGI ${stats.agility} | RES ${stats.resolve} | WIL ${stats.will}`
    );
    return;
  }

  // /phoenix rollstats
  if (sub === "rollstats") {
    if (!(await requirePhoenix())) return;

    // members can't reroll once stats exist; owner can override
    if (p.stats && userId !== OWNER_ID) {
      await interaction.reply({
        content: "⛓ Your phoenix’s stats are already forged in ember and cannot be rerolled.",
        ephemeral: true
      });
      return;
    }

    p.stats = {
      power: rollPhoenixStatForRarity(p.rarity),
      agility: rollPhoenixStatForRarity(p.rarity),
      resolve: rollPhoenixStatForRarity(p.rarity),
      will: rollPhoenixStatForRarity(p.rarity)
    };

    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);

    await interaction.reply(
      `🜂 **Phoenix Stats Forged — ${p.name}**\n` +
      `Rarity: **${p.rarity}**\n\n` +
      `**Power:** ${p.stats.power}\n` +
      `**Agility:** ${p.stats.agility}\n` +
      `**Resolve:** ${p.stats.resolve}\n` +
      `**Will:** ${p.stats.will}\n\n` +
      `Your phoenix’s stats now fully reflect its rarity.`
    );
    return;
  }

  // /phoenix name
  if (sub === "name") {
    if (!(await requirePhoenix())) return;
    const newName = interaction.options.getString("newname");
    p.name = newName;
    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);
    await interaction.reply(`🜂 The ember answers. Your phoenix is now called **${newName}**.`);
    return;
  }

  // /phoenix portrait
  if (sub === "portrait") {
    if (!(await requirePhoenix())) return;
    ensurePhoenixStats(p);
    const stage = evolutionStage(p.level);
    const s = p.stats || {};
    await interaction.reply(
      "```" + "\n" +
      `🔥 ${p.name}\n` +
      `Rarity: ${p.rarity}\n` +
      `Element: ${p.element}\n` +
      `Temperament: ${p.temperament}\n` +
      `Traits: ${p.traits.join(", ")}\n` +
      `Level: ${p.level} (${stage})\n` +
      `XP: ${p.xp}/${xpToNextLevel(p.level)}\n` +
      `Stats: PWR ${s.power}  AGI ${s.agility}  RES ${s.resolve}  WIL ${s.will}\n` +
      "```"
    );
    return;
  }

  // /phoenix title
  if (sub === "title") {
    if (!(await requirePhoenix())) return;
    const list = (p.titlesUnlocked && p.titlesUnlocked.length)
      ? p.titlesUnlocked.map(t => `• ${t}`).join("\n")
      : "• None yet — keep your ember burning.";
    await interaction.reply(`🜂 **Titles Unlocked**\n${list}`);
    return;
  }

  // /phoenix feed
  if (sub === "feed") {
    if (!(await requirePhoenix())) return;
    ensurePhoenixStats(p);

    if (!canUse(now, p.lastFeedAt, FEED_COOLDOWN_MS)) {
      const msLeft = FEED_COOLDOWN_MS - (now - p.lastFeedAt);
      await interaction.reply(`⛓ Your phoenix is not hungry yet. Return in **${formatCooldown(msLeft)}**.`);
      return;
    }

    p.lastFeedAt = now;
    const mult = maybeBlessingBonus(p);
    const xpGain = Math.ceil((15 + Math.floor(Math.random() * 11)) * mult);
    const leveled = gainXP(p, xpGain);

    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);

    await interaction.reply(
      `🜂 **Ember Offering**\n` +
      `${p.name} drinks from your flame, feathers glowing like molten night.\n\n` +
      `**+${xpGain} Ember XP**`
    );

    if (leveled) await announce(`🜂 **Evolution** — <@${userId}>'s phoenix **${p.name}** rises to **Lv ${p.level}**.`);
    return;
  }

  // /phoenix meditate
  if (sub === "meditate") {
    if (!(await requirePhoenix())) return;
    ensurePhoenixStats(p);

    if (!canUse(now, p.lastMeditateAt, MEDITATE_COOLDOWN_MS)) {
      const msLeft = MEDITATE_COOLDOWN_MS - (now - p.lastMeditateAt);
      await interaction.reply(`⛓ The ember still hums. Meditate again in **${formatCooldown(msLeft)}**.`);
      return;
    }

    p.lastMeditateAt = now;
    const mult = maybeBlessingBonus(p);
    const xpGain = Math.ceil((8 + Math.floor(Math.random() * 8)) * mult);
    const leveled = gainXP(p, xpGain);

    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);

    await interaction.reply(
      `🜂 **Meditation in the Ash**\n` +
      `Silence settles. Your phoenix folds its wings beside you.\n\n` +
      `**+${xpGain} Ember XP**`
    );

    if (leveled) await announce(`🜂 **Evolution** — <@${userId}>'s phoenix **${p.name}** rises to **Lv ${p.level}**.`);
    return;
  }

  // /phoenix blessing
  if (sub === "blessing") {
    if (!(await requirePhoenix())) return;
    ensurePhoenixStats(p);

    if (!canUse(now, p.lastBlessingAt, BLESSING_COOLDOWN_MS)) {
      const msLeft = BLESSING_COOLDOWN_MS - (now - p.lastBlessingAt);
      await interaction.reply(`⛓ Ashura’s flame is already upon you. Seek a new blessing in **${formatCooldown(msLeft)}**.`);
      return;
    }

    p.lastBlessingAt = now;
    p.blessingUntil = now + 12 * 60 * 60 * 1000;

    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);

    await interaction.reply(
      `🜂 **Ashura’s Blessing**\n` +
      `A black halo of fire settles over ${p.name}.\n` +
      `For **12 hours**, your phoenix gains **25% more XP**.`
    );
    return;
  }

  // /phoenix hunt
  if (sub === "hunt") {
    if (!(await requirePhoenix())) return;
    ensurePhoenixStats(p);

    if (!canUse(now, p.lastHuntAt, HUNT_COOLDOWN_MS)) {
      const msLeft = HUNT_COOLDOWN_MS - (now - p.lastHuntAt);
      await interaction.reply(`⛓ Your phoenix still stalks the dark. Hunt again in **${formatCooldown(msLeft)}**.`);
      return;
    }

    p.lastHuntAt = now;
    const mult = maybeBlessingBonus(p);
    const xpGain = Math.ceil((12 + Math.floor(Math.random() * 13)) * mult);
    const loot = rollLoot();
    if (!Array.isArray(p.inventory)) p.inventory = [];
    p.inventory.push(loot);
    const leveled = gainXP(p, xpGain);

    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);

    await interaction.reply(
      `🜂 **The Hunt Begins**\n` +
      `${p.name} slips into the blackened air.\n\n` +
      `**+${xpGain} Ember XP**\n` +
      `**Loot:** *${loot}*`
    );

    if (leveled) await announce(`🜂 **Evolution** — <@${userId}>'s phoenix **${p.name}** rises to **Lv ${p.level}**.`);
    return;
  }

  // /phoenix scout
  if (sub === "scout") {
    if (!(await requirePhoenix())) return;
    ensurePhoenixStats(p);

    if (!canUse(now, p.lastScoutAt, SCOUT_COOLDOWN_MS)) {
      const msLeft = SCOUT_COOLDOWN_MS - (now - p.lastScoutAt);
      await interaction.reply(`⛓ The halls are still echoing. Scout again in **${formatCooldown(msLeft)}**.`);
      return;
    }

    p.lastScoutAt = now;
    const mult = maybeBlessingBonus(p);
    const xpGain = Math.ceil((10 + Math.floor(Math.random() * 9)) * mult);
    const fragment = rollLoot();
    const leveled = gainXP(p, xpGain);
    if (!Array.isArray(p.inventory)) p.inventory = [];
    p.inventory.push(fragment);

    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);

    const loreBits = [
      "A forgotten chain-link etched with your name.",
      "A scorch mark shaped like a crown of ash.",
      "A whisper from the void: ‘Not all flames are meant to sleep.’",
      "A feather fused to black glass, still warm.",
      "A rune that pulses when Ashura passes."
    ];

    await interaction.reply(
      `🜂 **Scout’s Return**\n` +
      `It returns with a fragment of memory:\n` +
      `*${pickRandom(loreBits)}*\n\n` +
      `**+${xpGain} Ember XP**\n` +
      `**Relic:** *${fragment}*`
    );

    if (leveled) await announce(`🜂 **Evolution** — <@${userId}>'s phoenix **${p.name}** rises to **Lv ${p.level}**.`);
    return;
  }

  // /phoenix bond
  if (sub === "bond") {
    if (!(await requirePhoenix())) return;
    ensurePhoenixStats(p);

    if (!canUse(now, p.lastBondAt, BOND_COOLDOWN_MS)) {
      const msLeft = BOND_COOLDOWN_MS - (now - p.lastBondAt);
      await interaction.reply(`⛓ Your bond is still blazing. Return in **${formatCooldown(msLeft)}**.`);
      return;
    }

    p.lastBondAt = now;
    const mult = maybeBlessingBonus(p);
    const xpGain = Math.ceil((9 + Math.floor(Math.random() * 8)) * mult);
    const leveled = gainXP(p, xpGain);

    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);

    const bondLines = [
      "It rests on your shoulder, warm as a living ember.",
      "Its eyes mirror your own fire — a silent promise.",
      "A ring of ash swirls around you both like a vow.",
      "It sings once — a note that cracks old chains."
    ];

    await interaction.reply(
      `🜂 **Bond of Ash and Flame**\n` +
      `${pickRandom(bondLines)}\n\n` +
      `**+${xpGain} Ember XP**`
    );

    if (leveled) await announce(`🜂 **Evolution** — <@${userId}>'s phoenix **${p.name}** rises to **Lv ${p.level}**.`);
    return;
  }

  // /phoenix duel
  if (sub === "duel") {
    if (!(await requirePhoenix())) return;
    ensurePhoenixStats(p);

    if (!canUse(now, p.lastDuelAt, DUEL_COOLDOWN_MS)) {
      const msLeft = DUEL_COOLDOWN_MS - (now - p.lastDuelAt);
      await interaction.reply(`⛓ Your phoenix still remembers its last battle. Duel again in **${formatCooldown(msLeft)}**.`);
      return;
    }

    const opponentUser = interaction.options.getUser("opponent");
    const oppId = opponentUser.id;

    if (oppId === OWNER_ID) {
      await interaction.reply(
        `🜂 **You challenge the sovereign flame.**\n` +
        `Ashura’s wings unfurl, and the air turns heavy with ancient heat.\n` +
        `“Some chains are not meant to be tested.”`
      );
      return;
    }

    const oppPhoenix = normalizePhoenix(phoenixDB[oppId]);
    if (!oppPhoenix) {
      await interaction.reply(`⛓ <@${oppId}> carries no phoenix to duel.`);
      return;
    }
    ensurePhoenixStats(oppPhoenix);
    phoenixDB[oppId] = oppPhoenix;

    p.lastDuelAt = now;

    const yourBase = computePhoenixBattlePower(p);
    const oppBase = computePhoenixBattlePower(oppPhoenix);

    const classMultYou = classDuelMultiplier(userId);
    const classMultOpp = classDuelMultiplier(oppId);

    const yourTraitMult = traitPowerBonus(p.traits);
    const oppTraitMult = traitPowerBonus(oppPhoenix.traits);

    const yourElemMult = elementBonus(p.element, oppPhoenix.element);
    const oppElemMult = elementBonus(oppPhoenix.element, p.element);

    const yourBless = maybeBlessingBonus(p);
    const oppBless = maybeBlessingBonus(oppPhoenix);

    const yourRoll = rollD20();
    const oppRoll = rollD20();

    const yourTotal =
      yourBase *
      yourTraitMult *
      yourElemMult *
      classMultYou *
      yourBless +
      yourRoll.value * 5;

    const oppTotal =
      oppBase *
      oppTraitMult *
      oppElemMult *
      classMultOpp *
      oppBless +
      oppRoll.value * 5;

    const youWin = yourTotal >= oppTotal;

    const winXPBase = 25 + Math.floor(Math.random() * 16); // 25–40
    const loseXPBase = 10;

    const yourMult = maybeBlessingBonus(p);
    const oppMult = maybeBlessingBonus(oppPhoenix);

    if (youWin) {
      const winXP = Math.ceil(winXPBase * yourMult);
      const loseXP = Math.ceil(loseXPBase * oppMult);

      const leveled = gainXP(p, winXP);
      gainXP(oppPhoenix, loseXP);

      phoenixDB[userId] = p;
      phoenixDB[oppId] = oppPhoenix;
      savePhoenixDB(phoenixDB);

      await interaction.reply(
        `🜂 **Duel of the Ember Realms**\n` +
        `${p.name} and ${oppPhoenix.name} spiral through the void like blades of fire.\n\n` +
        `**Your Roll:** d20 → **${yourRoll.value}** (${yourRoll.label})\n` +
        `**Opponent Roll:** d20 → **${oppRoll.value}** (${oppRoll.label})\n\n` +
        `**Victor:** <@${userId}> — **${p.name}**\n` +
        `**+${winXP} XP** to the victor, **+${loseXP} XP** to the fallen.`
      );

      if (leveled) await announce(`🜂 **Evolution** — <@${userId}>'s phoenix **${p.name}** rises to **Lv ${p.level}**.`);
      await announce(`⚔️ **Arena Echo:** <@${userId}> defeated <@${oppId}> in a phoenix duel.`);
    } else {
      const winXP = Math.ceil(winXPBase * oppMult);
      const loseXP = Math.ceil(loseXPBase * yourMult);

      const leveledOpp = gainXP(oppPhoenix, winXP);
      gainXP(p, loseXP);

      phoenixDB[userId] = p;
      phoenixDB[oppId] = oppPhoenix;
      savePhoenixDB(phoenixDB);

      await interaction.reply(
        `🜂 **Duel of the Ember Realms**\n` +
        `${p.name} charges first, but ${oppPhoenix.name} answers with a colder flame.\n\n` +
        `**Your Roll:** d20 → **${yourRoll.value}** (${yourRoll.label})\n` +
        `**Opponent Roll:** d20 → **${oppRoll.value}** (${oppRoll.label})\n\n` +
        `**Victor:** <@${oppId}> — **${oppPhoenix.name}**\n` +
        `**+${winXP} XP** to the victor, **+${loseXP} XP** to the fallen.`
      );

      if (leveledOpp) await announce(`🜂 **Evolution** — <@${oppId}>'s phoenix **${oppPhoenix.name}** rises to **Lv ${oppPhoenix.level}**.`);
      await announce(`⚔️ **Arena Echo:** <@${oppId}> defeated <@${userId}> in a phoenix duel.`);
    }

    return;
  }

  // /phoenix spar
  if (sub === "spar") {
    if (!(await requirePhoenix())) return;
    ensurePhoenixStats(p);

    if (!canUse(now, p.lastSparAt, SPAR_COOLDOWN_MS)) {
      const msLeft = SPAR_COOLDOWN_MS - (now - p.lastSparAt);
      await interaction.reply(`⛓ The void-beast still bleeds. Spar again in **${formatCooldown(msLeft)}**.`);
      return;
    }

    p.lastSparAt = now;
    const mult = maybeBlessingBonus(p);
    const xpGain = Math.ceil((18 + Math.floor(Math.random() * 11)) * mult);
    const leveled = gainXP(p, xpGain);

    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);

    const beasts = ["Ash-Wraith","Cinder Hound","Void Talon","Chain Serpent","Dusk Reaper"];

    await interaction.reply(
      `🜂 **Sparring the Void**\n` +
      `${p.name} clashes with a **${pickRandom(beasts)}** in a storm of ember and shadow.\n\n` +
      `**+${xpGain} Ember XP**`
    );

    if (leveled) await announce(`🜂 **Evolution** — <@${userId}>'s phoenix **${p.name}** rises to **Lv ${p.level}**.`);
    return;
  }

  // /phoenix arena (queue)
  if (sub === "arena") {
    if (!requireChannel(
      interaction,
      [CHANNELS.ashenArena, CHANNELS.forgeTesting],
      `⚔️ Enter the Arena queue using **/phoenix arena** in <#${CHANNELS.ashenArena}>.`
    )) return;

    if (!phoenixDB.__arena || typeof phoenixDB.__arena !== "object") {
      phoenixDB.__arena = { queue: [] };
    }
    if (!Array.isArray(phoenixDB.__arena.queue)) {
      phoenixDB.__arena.queue = [];
    }

    const q = phoenixDB.__arena.queue;

    if (q.includes(userId)) {
      await interaction.reply(`⚔️ You are already in the Arena queue. Hold your flame.`);
      return;
    }

    q.push(userId);
    savePhoenixDB(phoenixDB);

    await interaction.reply(
      `⚔️ **Ashen Arena Queue**\n` +
      `Your name is carved into ash.\n` +
      `Warriors waiting: **${q.length}**`
    );

    await arenaEcho(
      `🜂 **Arena Queue** — <@${userId}> has entered the Ashen Arena.\n` +
      `Warriors waiting: **${q.length}**`
    );
    return;
  }

  // /phoenix bag
  if (sub === "bag") {
    if (!(await requirePhoenix())) return;
    const inv = Array.isArray(p.inventory) ? p.inventory : [];

    if (!inv.length) {
      await interaction.reply(
        `🜂 **Phoenix Relic Bag — ${p.name}**\n` +
        `Your phoenix carries no relics yet. Hunt, scout, and quest to find them.`
      );
      return;
    }

    const lines = inv.map((item, idx) => {
      const value = getRelicSellValue(item);
      return `#${idx + 1} — *${item}* — worth **${value}** embercoin`;
    }).join("\n");

    await interaction.reply(
      `🜂 **Phoenix Relic Bag — ${p.name}**\n` +
      `${lines}\n\n` +
      `Use **/phoenix use** or **/phoenix sell** to consume or sell relics.`
    );
    return;
  }

  // /phoenix use
  if (sub === "use") {
    if (!(await requirePhoenix())) return;
    ensurePhoenixStats(p);

    const itemName = interaction.options.getString("item");
    const inv = Array.isArray(p.inventory) ? p.inventory : [];

    if (!itemName) {
      await interaction.reply({ content: "⛓ Name the relic you wish to use.", ephemeral: true });
      return;
    }

    const index = inv.findIndex(i => i.toLowerCase() === itemName.toLowerCase());
    if (index === -1) {
      await interaction.reply({
        content: `⛓ ${p.name} does not carry a relic called **${itemName}**.`,
        ephemeral: true
      });
      return;
    }

    const relic = inv[index];
    inv.splice(index, 1);
    p.inventory = inv;

    const baseValue = getRelicSellValue(relic);
    const mult = maybeBlessingBonus(p);
    const xpGain = Math.ceil((baseValue / 2) * mult);

    const leveled = gainXP(p, xpGain);
    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);

    await interaction.reply(
      `🜂 **Relic Consumed**\n` +
      `${p.name} shatters *${relic}* into pure ember.\n\n` +
      `**+${xpGain} Ember XP**`
    );

    if (leveled) {
      await announce(
        `🜂 **Evolution** — <@${userId}>'s phoenix **${p.name}** rose to **Lv ${p.level}** by consuming a relic.`
      );
    }
    return;
  }

  // /phoenix sell
  if (sub === "sell") {
    if (!(await requirePhoenix())) return;
    const itemName = interaction.options.getString("item");
    const inv = Array.isArray(p.inventory) ? p.inventory : [];

    if (!itemName) {
      await interaction.reply({ content: "⛓ Name the relic you wish to sell.", ephemeral: true });
      return;
    }

    const index = inv.findIndex(i => i.toLowerCase() === itemName.toLowerCase());
    if (index === -1) {
      await interaction.reply({
        content: `⛓ ${p.name} does not carry a relic called **${itemName}**.`,
        ephemeral: true
      });
      return;
    }

    const relic = inv[index];
    const value = getRelicSellValue(relic);

    inv.splice(index, 1);
    p.inventory = inv;
    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);

    const newGoldTotal = grantGold(userId, value);

    await interaction.reply(
      `🜂 **Relic Sold**\n` +
      `You trade *${relic}* to the Sanctum merchants.\n` +
      `**+${value} embercoin** — you now carry **${newGoldTotal}**.`
    );
    return;
  }

  // /phoenix sellall
  if (sub === "sellall") {
    if (!(await requirePhoenix())) return;
    const inv = Array.isArray(p.inventory) ? p.inventory : [];

    if (!inv.length) {
      await interaction.reply({
        content: "⛓ Your phoenix carries no relics to sell.",
        ephemeral: true
      });
      return;
    }

    let totalValue = 0;
    for (const relic of inv) {
      totalValue += getRelicSellValue(relic);
    }

    p.inventory = [];
    phoenixDB[userId] = p;
    savePhoenixDB(phoenixDB);

    const newGoldTotal = grantGold(userId, totalValue);

    await interaction.reply(
      `🜂 **Relics Liquidated**\n` +
      `${p.name} releases its hoard to the Sanctum.\n` +
      `All relics sold for **${totalValue} embercoin**.\n` +
      `You now carry **${newGoldTotal}** embercoin.`
    );
    return;
  }

  // /phoenix release
  if (sub === "release") {
    if (!(await requirePhoenix())) return;

    phoenixDB[`release_${userId}`] = { lastReleaseAt: now };
    const oldName = p.name;

    delete phoenixDB[userId];
    savePhoenixDB(phoenixDB);

    await interaction.reply(
      `🜂 **Severing Rite**\n` +
      `You open your hands, and **${oldName}** dissolves into ash-light.\n\n` +
      `You may bind a new companion after **2 days**.`
    );
    return;
  }

  await interaction.reply({ content: "Ashura does not recognize that rite.", ephemeral: true });
  return;
} // end phoenix


    // ====================================================
//                    /ember COMMAND
// ====================================================
if (interaction.commandName === "ember") {
  const sub = interaction.options.getSubcommand();
  let ch = getCharacter(userId);
  ch = normalizeCharacter(ch);

  // /ember sheet
  if (sub === "sheet") {
    if (ch.stats) {
      const s = ch.stats;
      await interaction.reply(
        `🜂 **Character Sheet — <@${userId}>**\n` +
        `**Stats**\n` +
        `STR: ${s.str}  DEX: ${s.dex}  CON: ${s.con}\n` +
        `INT: ${s.int}  WIS: ${s.wis}  CHA: ${s.cha}\n\n` +
        `**HP:** ${ch.hpCur}/${ch.hpMax}\n` +
        `**Mana:** ${ch.manaCur}/${ch.manaMax}\n` +
        `**Gold:** ${ch.gold} embercoin\n\n` +
        `**Inventory:** ${
          ch.items.length
            ? ch.items.map(id => {
                const it = getShopItem(id);
                return it ? it.name : id;
              }).join(", ")
            : "empty"
        }`
      );
    } else {
      await interaction.reply(
        `🜂 **Character Sheet — <@${userId}>**\n` +
        `You have not rolled your stats yet.\n` +
        `Use **/ember rollstats** to forge your D&D-style attributes.\n\n` +
        `**HP:** ${ch.hpCur}/${ch.hpMax}\n` +
        `**Mana:** ${ch.manaCur}/${ch.manaMax}\n` +
        `**Gold:** ${ch.gold} embercoin\n` +
        `**Inventory:** ${
          ch.items.length
            ? ch.items.map(id => {
                const it = getShopItem(id);
                return it ? it.name : id;
              }).join(", ")
            : "empty"
        }`
      );
    }
    return;
  }

  // 🔥🔥 NEW BLOCK: /ember check 🔥🔥
  if (sub === "check") {
    if (!ch.stats) {
      await interaction.reply({
        content: "⛓ Your stats are not forged yet. Use **/ember rollstats** first.",
        ephemeral: true
      });
      return;
    }

    const statKey = interaction.options.getString("stat"); // "str", "dex", etc.
    const valid = ["str", "dex", "con", "int", "wis", "cha"];

    if (!valid.includes(statKey)) {
      await interaction.reply({
        content: "⛓ That stat does not exist. Choose STR, DEX, CON, INT, WIS, or CHA.",
        ephemeral: true
      });
      return;
    }

    const statValue = ch.stats[statKey];
    const mod = abilityMod(statValue);

    // If you already have rollD20(), use it.
    // If not, replace with a simple 1–20 roll.
    const roll = rollD20 ? rollD20() : { value: 1 + Math.floor(Math.random() * 20), label: "" };

    const total = roll.value + mod;
    const names = {
      str: "Strength",
      dex: "Dexterity",
      con: "Constitution",
      int: "Intelligence",
      wis: "Wisdom",
      cha: "Charisma"
    };

    await interaction.reply(
      `🜂 **${names[statKey]} Check** — <@${userId}>\n` +
      `Base stat: **${statValue}** (mod ${mod >= 0 ? "+" + mod : mod})\n` +
      `d20 roll: **${roll.value}**${roll.label ? ` (${roll.label})` : ""}\n\n` +
      `**Total:** ${total}`
    );
    return;
  }
  // 🔥🔥 END NEW BLOCK 🔥🔥

  // /ember rollstats
  if (sub === "rollstats") {
    if (ch.stats) {
      await interaction.reply({
        content: "⛓ Your stats are already forged in ash. They cannot be rerolled.",
        ephemeral: true
      });
      return;
    }

    ch = finalizeStatsForCharacter(ch);
    dndDB[userId] = ch;
    saveDndDB(dndDB);

    const s = ch.stats;

    await interaction.reply(
      `🜂 **Stats Forged**\n` +
      `Your attributes are seared into the void:\n\n` +
      `STR: ${s.str}\n` +
      `DEX: ${s.dex}\n` +
      `CON: ${s.con}\n` +
      `INT: ${s.int}\n` +
      `WIS: ${s.wis}\n` +
      `CHA: ${s.cha}\n\n` +
      `**HP:** ${ch.hpCur}/${ch.hpMax}\n` +
      `**Mana:** ${ch.manaCur}/${ch.manaMax}`
    );
    return;
  }


      // /ember shop
      if (sub === "shop") {
        const lines = SHOP_ITEMS.map(i =>
          `• **${i.name}** — ${i.cost} embercoin — *${i.description}* (ID: \`${i.id}\`)`
        ).join("\n");

        await interaction.reply(
          `🜂 **Sanctum Shop**\n` +
          `Currency: **embercoin**\n\n` +
          `${lines}`
        );
        return;
      }

      // /ember buy
      if (sub === "buy") {
        const itemId = interaction.options.getString("item");
        const item = getShopItem(itemId);

        if (!item) {
          await interaction.reply({ content: "⛓ That item does not exist in the Sanctum shop.", ephemeral: true });
          return;
        }

        if (ch.gold < item.cost) {
          await interaction.reply({
            content: `⛓ You only carry **${ch.gold}** embercoin. **${item.name}** costs **${item.cost}**.`,
            ephemeral: true
          });
          return;
        }

        ch.gold -= item.cost;
        ch.items.push(item.id);
        dndDB[userId] = ch;
        saveDndDB(dndDB);

        await interaction.reply(
          `🜂 **Purchase Complete**\n` +
          `You acquire **${item.name}** for **${item.cost}** embercoin.\n` +
          `Remaining gold: **${ch.gold}**.`
        );
        return;
      }

      // /ember use
      if (sub === "use") {
        const itemId = interaction.options.getString("item");
        const idx = ch.items.indexOf(itemId);

        if (idx === -1) {
          await interaction.reply({
            content: "⛓ That item does not rest in your inventory.",
            ephemeral: true
          });
          return;
        }

        const item = getShopItem(itemId);
        if (!item) {
          await interaction.reply({
            content: "⛓ That relic has no known effect. The shopkeeper shrugs.",
            ephemeral: true
          });
          return;
        }

        ch.items.splice(idx, 1);
        characterUseItem(ch, item);
        dndDB[userId] = ch;
        saveDndDB(dndDB);

        await interaction.reply(
          `🜂 **Item Used: ${item.name}**\n` +
          `HP: ${ch.hpCur}/${ch.hpMax}\n` +
          `Mana: ${ch.manaCur}/${ch.manaMax}`
        );
        return;
      }

      // /ember grant (owner-only)
      if (sub === "grant") {
        if (userId !== OWNER_ID) {
          await interaction.reply({ content: "⛓ Only the Fallen Phoenix may grant embercoin.", ephemeral: true });
          return;
        }

        const target = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");

        if (!target || !amount || amount === 0) {
          await interaction.reply({ content: "⛓ Invalid target or amount.", ephemeral: true });
          return;
        }

        const tChar = getCharacter(target.id);
        tChar.gold += amount;
        dndDB[target.id] = normalizeCharacter(tChar);
        saveDndDB(dndDB);

        await interaction.reply(
          `🜂 **Ember Granted**\n` +
          `<@${target.id}> receives **${amount}** embercoin.\n` +
          `Their new total: **${tChar.gold}**.`
        );
        return;
      }

      await interaction.reply({ content: "⛓ Unknown ember rite.", ephemeral: true });
      return;
    }

    // ====================================================
    //                 CLASS COMMANDS
    // ====================================================
    const CLASS_TRAIN_FLAVOR = [
      "You carve your stance into ash until your legs shake.",
      "You clash against phantom chains, learning where they bite.",
      "You practice until sweat feels like molten ember on your skin.",
      "You repeat the same motion a hundred times, then a hundred more."
    ];

    const CLASS_QUEST_FLAVOR = [
      "You follow a half-buried sigil trail through forgotten halls.",
      "You guide a lost ember-soul back toward the Sanctum’s light.",
      "You confront a whisper that sounds too much like your own doubt.",
      "You barter with the void and walk away with more than scars."
    ];

    const CLASS_SPAR_FLAVOR = [
      "Ash kicks up around you as two paths collide.",
      "The clang of chains and flame rings through the training hall.",
      "Your heartbeat and your weapon strikes fall into the same rhythm.",
      "For a moment, the world is just you, your opponent, and the ember between you."
    ];

    if (interaction.commandName === "class") {
      const sub = interaction.options.getSubcommand();
      const u = getUserClass(userId);

      if (sub === "list") {
        const lines = Object.keys(CLASSES)
          .filter(c => !CLASSES[c].ownerOnly)
          .map(c => `• **${c}** — ${CLASSES[c].lore}`)
          .join("\n");
        await interaction.reply(`🜂 **Paths of the Sanctum**\n${lines}`);
        return;
      }

      if (sub === "choose") {
        if (u.class) {
          await interaction.reply({ content: `⛓ You already walk **${u.class}**.`, ephemeral: true });
          return;
        }
        const path = interaction.options.getString("path");
        const data = CLASSES[path];
        if (!data) {
          await interaction.reply({ content: "⛓ Unknown class.", ephemeral: true });
          return;
        }
        if (data.ownerOnly && userId !== OWNER_ID) {
          await interaction.reply({ content: "⛓ That path is sealed to the sovereign.", ephemeral: true });
          return;
        }

        u.class = path;
        classDB[userId] = u;
        saveClassDB(classDB);

        await interaction.reply(
          `🜂 **Path Chosen: ${path}**\n${data.lore}\nYour ember will grow through training and quests.`
        );
        return;
      }

      if (sub === "status") {
        await interaction.reply(
          `🜂 **Class Status**\n` +
          `**Path:** ${u.class || "None"}\n` +
          `**Level:** ${u.level}\n` +
          `**XP:** ${u.xp}/${classXpToNextLevel(u.level)}`
        );
        return;
      }

      if (sub === "whois") {
        const target = interaction.options.getUser("user");
        const tu = getUserClass(target.id);

        const path = tu.class || "None";
        const data = tu.class ? CLASSES[tu.class] : null;

        await interaction.reply(
          `🜂 **Class Record** — <@${target.id}>\n` +
          `**Path:** ${path}\n` +
          `**Level:** ${tu.level}\n` +
          (data ? `**Creed:** ${data.lore}\n**Duel Power:** x${data.duelPower}` : "")
        );
        return;
      }

      if (sub === "xp") {
        await interaction.reply(
          `🜂 **Class XP** — ${u.xp}/${classXpToNextLevel(u.level)} (Lv ${u.level})`
        );
        return;
      }

      if (sub === "train") {
        if (!u.class) {
          await interaction.reply({
            content: "⛓ Choose a class first with /class choose.",
            ephemeral: true
          });
          return;
        }

        if (!canUse(now, u.lastTrainAt, CLASS_TRAIN_COOLDOWN_MS)) {
          const msLeft = CLASS_TRAIN_COOLDOWN_MS - (now - u.lastTrainAt);
          await interaction.reply(`⛓ Train again in **${formatCooldown(msLeft)}**.`);
          return;
        }

        u.lastTrainAt = now;

        const roll = rollD20();
        let xpGain;

        if (roll.value === 20) {
          xpGain = 30 + Math.floor(Math.random() * 8);
        } else if (roll.value >= 15) {
          xpGain = 20 + Math.floor(Math.random() * 7);
        } else if (roll.value >= 8) {
          xpGain = 12 + Math.floor(Math.random() * 5);
        } else {
          xpGain = 6 + Math.floor(Math.random() * 5);
        }

        const leveled = gainClassXP(u, xpGain);
        classDB[userId] = u;
        saveClassDB(classDB);

        const flavor = pickRandom(CLASS_TRAIN_FLAVOR);

        await interaction.reply(
          `🜂 **Training Roll:** d20 → **${roll.value}** (${roll.label})\n` +
          `${flavor}\n\n` +
          `**+${xpGain} Class XP**` +
          (leveled ? `\n**Your path rises to Lv ${u.level}.**` : "")
        );
        return;
      }

      if (sub === "quest") {
        if (!u.class) {
          await interaction.reply({
            content: "⛓ Choose a class first.",
            ephemeral: true
          });
          return;
        }

        if (!canUse(now, u.lastQuestAt, CLASS_QUEST_COOLDOWN_MS)) {
          const msLeft = CLASS_QUEST_COOLDOWN_MS - (now - u.lastQuestAt);
          await interaction.reply(`⛓ Quest again in **${formatCooldown(msLeft)}**.`);
          return;
        }

        u.lastQuestAt = now;

        const roll = rollD20();
        let xpGain;
        let foundRelic = null;

        if (roll.value === 20) {
          xpGain = 28 + Math.floor(Math.random() * 10);
          if (Math.random() < 0.9) foundRelic = rollLoot();
        } else if (roll.value >= 16) {
          xpGain = 20 + Math.floor(Math.random() * 8);
          if (Math.random() < 0.5) foundRelic = rollLoot();
        } else if (roll.value >= 8) {
          xpGain = 12 + Math.floor(Math.random() * 6);
          if (Math.random() < 0.2) foundRelic = rollLoot();
        } else {
          xpGain = 7 + Math.floor(Math.random() * 5);
          if (Math.random() < 0.1) {
            if (Math.random() < 0.5) foundRelic = rollLoot();
          }
        }

        const leveled = gainClassXP(u, xpGain);
        classDB[userId] = u;
        saveClassDB(classDB);

        const flavor = pickRandom(CLASS_QUEST_FLAVOR);

        let lootLine = "";
        if (foundRelic) {
          lootLine = `\n**Relic Discovered:** *${foundRelic}* (claimed by your path)`;
        }

        await interaction.reply(
          `🜂 **Lore Quest Roll:** d20 → **${roll.value}** (${roll.label})\n` +
          `${flavor}\n\n` +
          `**+${xpGain} Class XP**` +
          lootLine +
          (leveled ? `\n**Your path rises to Lv ${u.level}.**` : "")
        );
        return;
      }

      if (sub === "spar") {
        if (!u.class) {
          await interaction.reply({
            content: "⛓ Choose a class first with /class choose.",
            ephemeral: true
          });
          return;
        }

        if (!canUse(now, u.lastSparAt, CLASS_SPAR_COOLDOWN_MS)) {
          const msLeft = CLASS_SPAR_COOLDOWN_MS - (now - u.lastSparAt);
          await interaction.reply(`⛓ You may spar again in **${formatCooldown(msLeft)}**.`);
          return;
        }

        const opponentUser = interaction.options.getUser("opponent");
        const oppId = opponentUser.id;
        const ou = getUserClass(oppId);

        if (!ou.class) {
          await interaction.reply(`⛓ <@${oppId}> carries no class to challenge.`);
          return;
        }

        u.lastSparAt = now;

        if (oppId === OWNER_ID) {
          classDB[userId] = u;
          saveClassDB(classDB);

          await interaction.reply(
            `🜂 **You challenge the sovereign path.**\n` +
            `The air freezes.\n` +
            `**Verdict:** <@${userId}> is **defeated instantly**.\n` +
            `Some oaths are not meant to be tested.`
          );
          return;
        }

        const yourMult = CLASSES[u.class]?.duelPower || 1;
        const oppMult = CLASSES[ou.class]?.duelPower || 1;

        const yourPower = (u.level * 10) * yourMult;
        const oppPower = (ou.level * 10) * oppMult;

        const yourRoll = rollD20();
        const oppRoll = rollD20();

        const yourScore = yourRoll.value * yourPower;
        const oppScore = oppRoll.value * oppPower;

        const youWin = yourScore >= oppScore;

        const winXP = 18 + Math.floor(Math.random() * 10);
        const loseXP = 7;

        let leveled = false;
        let oppLeveled = false;

        const flavor = pickRandom(CLASS_SPAR_FLAVOR);

        if (youWin) {
          leveled = gainClassXP(u, winXP);
          gainClassXP(ou, loseXP);

          classDB[userId] = u;
          classDB[oppId] = ou;
          saveClassDB(classDB);

          await interaction.reply(
            `⚔️ **Class Spar**\n` +
            `${flavor}\n\n` +
            `**Your Roll:** d20 → **${yourRoll.value}** (${yourRoll.label})\n` +
            `**Opponent Roll:** d20 → **${oppRoll.value}** (${oppRoll.label})\n\n` +
            `<@${userId}> (${u.class} Lv ${u.level}) vs <@${oppId}> (${ou.class} Lv ${ou.level})\n\n` +
            `**Victor:** <@${userId}>\n` +
            `+${winXP} Class XP to the victor, +${loseXP} to the fallen.` +
            (leveled ? `\n**You reached Lv ${u.level}.**` : "")
          );
        } else {
          oppLeveled = gainClassXP(ou, winXP);
          gainClassXP(u, loseXP);

          classDB[userId] = u;
          classDB[oppId] = ou;
          saveClassDB(classDB);

          await interaction.reply(
            `⚔️ **Class Spar**\n` +
            `${flavor}\n\n` +
            `**Your Roll:** d20 → **${yourRoll.value}** (${yourRoll.label})\n` +
            `**Opponent Roll:** d20 → **${oppRoll.value}** (${oppRoll.label})\n\n` +
            `<@${userId}> (${u.class} Lv ${u.level}) vs <@${oppId}> (${ou.class} Lv ${ou.level})\n\n` +
            `**Victor:** <@${oppId}>\n` +
            `+${winXP} Class XP to the victor, +${loseXP} to the fallen.` +
            (oppLeveled ? `\n<@${oppId}> reached Lv ${ou.level}.` : "")
          );
        }

        await arenaEcho(
          `⚔️ **Class Spar Echo:** <@${userId}> challenged <@${oppId}> in a class spar.`
        );
        return;
      }

      if (sub === "info") {
        const path = interaction.options.getString("path");
        const data = CLASSES[path];
        await interaction.reply(
          `🜂 **${path}**\n${data.lore}\n**Duel Power:** x${data.duelPower}`
        );
        return;
      }

      if (sub === "reset") {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.reply({ content: "⛓ Not permitted.", ephemeral: true });
          return;
        }
        const target = interaction.options.getUser("user");
        const tu = getUserClass(target.id);
        tu.class = null;
        tu.level = 1;
        tu.xp = 0;
        tu.lastTrainAt = 0;
        tu.lastQuestAt = 0;
        tu.lastSparAt = 0;
        tu.locked = false;

        classDB[target.id] = tu;
        saveClassDB(classDB);

        await interaction.reply(`🜂 <@${target.id}> has been reset to no class.`);
        return;
      }

      await interaction.reply({ content: "⛓ Unknown class rite.", ephemeral: true });
      return;
    }

    // ====================================================
    //                 CAMPAIGN COMMANDS
    // ====================================================
    if (interaction.commandName === "campaign") {
      const sub = interaction.options.getSubcommand();
      const status = ensureCampaign();

      if (sub === "status") {
        const contrib = (campaignDB.contributors && campaignDB.contributors[userId]) || null;
        const yourEmber = contrib ? contrib.ember : 0;
        const goal = status.goal || 0;
        const total = status.totalEmber || 0;
        const pct = goal > 0 ? Math.min(100, ((total / goal) * 100).toFixed(1)) : 0;

        await interaction.reply(
          `🜂 **Order Campaign: ${status.name}**\n` +
          `**Status:** ${status.isActive ? "Active" : "Closed"}\n` +
          `**Goal:** ${goal} ember\n` +
          `**Total Ember:** ${total} (${pct}% of goal)\n\n` +
          `**Your Contribution:** ${yourEmber} ember`
        );
        return;
      }

      if (sub === "enlist") {
        const c = getContributor(userId);
        if (c.enlistedAt && c.enlistedAt > 0) {
          await interaction.reply(`🜂 You are already enlisted in **${status.name}**.`);
          saveCampaignDB(campaignDB);
          return;
        }
        c.enlistedAt = now;
        campaignDB.contributors[userId] = c;
        saveCampaignDB(campaignDB);

        await interaction.reply(
          `🜂 **You step into the Campaign.**\n` +
          `Your ember is now counted toward **${status.name}**.`
        );
        return;
      }

      if (sub === "contribute") {
        if (!status.isActive) {
          await interaction.reply(`⛓ No active campaign. The Order is between wars.`);
          return;
        }

        const c = getContributor(userId);
        if (!canUse(now, c.lastContributeAt, CAMPAIGN_CONTRIBUTE_COOLDOWN_MS)) {
          const msLeft = CAMPAIGN_CONTRIBUTE_COOLDOWN_MS - (now - c.lastContributeAt);
          await interaction.reply(
            `⛓ The embers you offered are still burning.\n` +
            `You may contribute again in **${formatCooldown(msLeft)}**.`
          );
          saveCampaignDB(campaignDB);
          return;
        }

        if (!c.enlistedAt) c.enlistedAt = now;

        c.lastContributeAt = now;
        const emberGain = 20 + Math.floor(Math.random() * 11); // 20–30
        c.ember += emberGain;
        status.totalEmber = (status.totalEmber || 0) + emberGain;
        campaignDB.status = status;
        campaignDB.contributors[userId] = c;

        const p0 = normalizePhoenix(phoenixDB[userId]);
        if (p0) {
          phoenixDB[userId] = p0;
          const mult = maybeBlessingBonus(p0);
          const xpGain = Math.ceil((emberGain / 2) * mult);
          const leveled = gainXP(p0, xpGain);
          phoenixDB[userId] = p0;
          savePhoenixDB(phoenixDB);
          if (leveled) {
            await announce(
              `🜂 **Campaign Evolution** — <@${userId}>'s phoenix **${p0.name}** rose to **Lv ${p0.level}** through the campaign.`
            );
          }
        }

        saveCampaignDB(campaignDB);

        await interaction.reply(
          `🜂 **Ember Committed**\n` +
          `You hurl **${emberGain} ember** into the Order’s campaign.\n\n` +
          `**Total Order Ember:** ${status.totalEmber}/${status.goal}\n` +
          `**Your Ember:** ${c.ember}`
        );
        return;
      }

      if (sub === "leaderboard") {
        const top = getCampaignLeaderboard(10);
        if (!top.length) {
          await interaction.reply(`🜂 No embers have been committed yet. The campaign waits.`);
          return;
        }

        const lines = top.map(([id, data], idx) => {
          return `#${idx + 1} — <@${id}>: **${data.ember}** ember`;
        }).join("\n");

        await interaction.reply(
          `🜂 **Campaign Leaderboard — ${status.name}**\n` +
          `${lines}`
        );
        return;
      }

      if (sub === "close") {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.reply({ content: "⛓ Only the Phoenix or Fallen Guards may close a campaign.", ephemeral: true });
          return;
        }
        if (!status.isActive) {
          await interaction.reply(`🜂 **${status.name}** is already closed.`);
          return;
        }

        status.isActive = false;
        status.endedAt = now;
        campaignDB.status = status;
        saveCampaignDB(campaignDB);

        await ledgerLog(
          `🜂 **Campaign Closed:** ${status.name}\n` +
          `Total Ember: ${status.totalEmber}/${status.goal}`
        );

        await interaction.reply(
          `🜂 **Campaign Closed**\n` +
          `The Order’s campaign **${status.name}** is now sealed in ash.\n` +
          `Total Ember: **${status.totalEmber}/${status.goal}**`
        );
        return;
      }

      if (sub === "reset") {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.reply({ content: "⛓ Only the Phoenix or Fallen Guards may reset a campaign.", ephemeral: true });
          return;
        }

        const prevName = status.name || "Chains in the Sky";
        const prevGoal = status.goal || 10000;

        campaignDB = {
          status: {
            name: prevName,
            goal: prevGoal,
            totalEmber: 0,
            startedAt: now,
            endedAt: 0,
            isActive: true
          },
          contributors: {}
        };
        saveCampaignDB(campaignDB);

        await ledgerLog(
          `🜂 **Campaign Reset:** ${prevName} has been reset.\n` +
          `All contributions cleared.`
        );

        await interaction.reply(
          `🜂 **Campaign Reset**\n` +
          `The campaign **${prevName}** has been reset.\n` +
          `All contributions cleared; the ember count begins anew.`
        );
        return;
      }

      await interaction.reply({ content: "⛓ Unknown campaign rite.", ephemeral: true });
      return;
    }

  } catch (err) {
    console.error("interaction error:", err);
    if (interaction.isRepliable && interaction.isRepliable() && !interaction.replied) {
      interaction.reply({ content: "❗ Ashura stumbled in the ash. Try again.", ephemeral: true }).catch(() => {});
    }
  }
});

   
// ====================================================
//          TEMPORARY VOICE CHANNEL SYSTEM
// ====================================================
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (newState.member?.user?.bot) return;

  const joinedHub =
    newState.channelId === VOICE_HUBS.warriorsCircle &&
    oldState.channelId !== VOICE_HUBS.warriorsCircle;

  if (joinedHub) {
    try {
      const guild = newState.guild;
      const member = newState.member;
      const hubChannel = newState.channel;
      if (!guild || !member || !hubChannel) return;

      const tempChannel = await guild.channels.create({
        name: `${TEMP_VC_PREFIX} ${member.user.username}`,
        type: ChannelType.GuildVoice,
        parent: hubChannel.parentId ?? undefined,
        userLimit: TEMP_VC_USER_LIMIT,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: ["ViewChannel", "Connect", "Speak"]
          },
          {
            id: member.id,
            allow: [
              "ViewChannel",
              "Connect",
              "Speak",
              "Stream",
              "UseVAD",
              "ManageChannels"
            ]
          }
        ]
      });

      await member.voice.setChannel(tempChannel);
    } catch (err) {
      console.error("Temp VC create/move error:", err);
    }
    return;
  }

  try {
    const oldChannel = oldState.channel;
    if (!oldChannel) return;
    if (oldChannel.type !== ChannelType.GuildVoice) return;
    if (!oldChannel.name.startsWith(TEMP_VC_PREFIX)) return;

    setTimeout(async () => {
      try {
        const refreshed = await client.channels.fetch(oldChannel.id).catch(() => null);
        if (!refreshed) return;
        if (refreshed.members.size === 0) {
          await refreshed.delete("Temp VC empty — dissolving back into ash.").catch(() => {});
        }
      } catch (e) {
        console.error("Temp VC delayed cleanup error:", e);
      }
    }, 5000);
  } catch (err) {
    console.error("Temp VC cleanup error:", err);
  }
});

// ====================================================
if (!BOT_TOKEN) {
  console.error("❗ Missing BOT_TOKEN in .env");
  process.exit(1);
}
client.login(BOT_TOKEN);
