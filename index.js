const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// allow more event listeners to avoid MaxListeners warnings when reloading
require('events').defaultMaxListeners = Math.max(require('events').defaultMaxListeners, 20);
client.setMaxListeners(20);

// Global error handlers to log uncaught errors and promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
client.on('error', (err) => console.error('Discord client error:', err));

// ----------------- FIGHTERS -----------------
const fighters = require("./fighters");


// ----------------- USER DATA -----------------
const users = {}; // Stores all user data: fighter, coins, wins, losses, level, xp
const inFight = {};      // tracks ongoing fights
const fights = {};       // tracks ongoing fight details per channel
// structure:
// fights[channelId] = {
//   p1, p2,
//   turn: userId
// }

// ----------------- READY -----------------
client.once("ready", () => {
  console.log("✅ Bot is ONLINE");
  client.user.setPresence({
    status: "online",
    activities: [{ name: "UFC fights 🥊" }]
  });
});

// ----------------- MESSAGE HANDLER -----------------
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const args = message.content.split(" ");
  const command = args[0].toLowerCase();
  // interaction handling is moved to top-level (outside messageCreate)

  // ----------------- START -----------------
  if (command === "ufstart") {
    return message.reply(
      "🥊 Welcome to UFC Game Bot!\n" +
      "Commands:\n" +
      "ufchoose <fighter> - choose your fighter \n" +
      "ufprofile - show your fighter stats\n" +
      "ufrecord - show your wins/losses\n" +
      "uffight @user - start a fight\n" +
      "ufattack - attack your opponent"
    );
  }

  // ----------------- USERS -----------------
 if (command === "ufchoose") {
  const fighterKey = args[1]?.toLowerCase();

  if (!fighterKey) return message.reply("Usage: ufchoose <fighter>");
  if (!fighters[fighterKey]) return message.reply("❌ Fighter not found. Try another name.");

  // Ensure user account exists
  if (!users[message.author.id]) {
    users[message.author.id] = {
      fighter: null,
      coins: 0,
      wins: 0,
      losses: 0,
      level: 1,
      xp: 0
    };
  }

  // Set chosen fighter
  users[message.author.id].fighter = JSON.parse(JSON.stringify(fighters[fighterKey]));

  const fighter = users[message.author.id].fighter;

  const embed = {
    title: `${fighter.name} 🥊`,
    description:
      `**Division:** ${fighter.division}\n\n` +
      `❤️ Health: ${fighter.health}\n` +
      `💥 Power: ${fighter.stats.power}\n` +
      `🔋 Stamina: ${fighter.stats.stamina}\n` +
      `🤼 Grappling: ${fighter.stats.grappling}`,
    image: { url: fighter.image },
    color: 0xff0000
  };
  
  message.channel.send({ embeds: [embed] });
}


  // ----------------- PROFILE -----------------
  if (command === "ufprofile") {
  const user = users[message.author.id];
  if (!user || !user.fighter) return message.reply("You have not chosen a fighter yet. Use ufchoose");

  const fighter = user.fighter;
  const embed = {
    title: `${fighter.name} 🥊`,
    description: 
      `❤️ Health: ${fighter.health}\n` +
      `💰 Coins: ${user.coins}\n` +
      `🏆 Wins: ${user.wins} | ❌ Losses: ${user.losses}\n` +
      `⭐ Level: ${user.level} | XP: ${user.xp}/${user.level * 50}`,
    image: { url: fighter.image },
    color: 0x00ff00
  };

  message.channel.send({ embeds: [embed] });
}

  // ----------------- RECORD -----------------
  if (command === "ufrecord") {
  const user = users[message.author.id];
  if (!user || !user.fighter) return message.reply("You have not chosen a fighter yet. Use ufchoose");

  message.channel.send(
    `📊 ${user.fighter.name} — Wins: ${user.wins} | Losses: ${user.losses} | Coins: ${user.coins} | Level: ${user.level}`
  );
}


  // ----------------- FIGHT -----------------
  if (command === "uffight") {
  const opponent = message.mentions.users.first();
  if (!opponent) return message.reply("Mention someone to fight!");

  if (!users[message.author.id]?.fighter || !users[opponent.id]?.fighter) {
    return message.reply("Both players must choose a fighter first!");
  }

  fights[message.channel.id] = {
    p1: message.author.id,
    p2: opponent.id,
    turn: message.author.id
  };

  // mark users as in a fight with each other
  inFight[message.author.id] = opponent.id;
  inFight[opponent.id] = message.author.id;

  // reset both fighters' health for the new fight
  users[message.author.id].fighter.health = 100;
  users[opponent.id].fighter.health = 100;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("attack").setLabel("🥊 Attack").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("punch").setLabel("👊 Punch").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("hook").setLabel("🪝 Hook").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("submit").setLabel("🧷 Submit").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("block").setLabel("🛡 Block").setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("dodge").setLabel("💨 Dodge").setStyle(ButtonStyle.Primary)
  );

  message.channel.send({
    content: `🔥 Fight started!\n\n**${message.author.username}**, it's YOUR turn`,
    components: [row, row2]
  });
}

  

  // ----------------- ATTACK -----------------
  if (command === "ufattack") {
    const opponentId = inFight[message.author.id];
    if (!opponentId) return message.reply("You are not in a fight!");

    const attackerF = users[message.author.id].fighter;
    const opponentF = users[opponentId].fighter;

    // Random damage between 5 and 25
    let damage = Math.floor(Math.random() * 20) + 5;

    // Award XP to attacker on the user record
    users[message.author.id].xp = (users[message.author.id].xp || 0) + 10;

    // Check for level-up on the user record
    if (!users[message.author.id].level) users[message.author.id].level = 1;
    if (users[message.author.id].xp >= users[message.author.id].level * 50) {
      users[message.author.id].level += 1;
      attackerF.stats.power += 2;
      attackerF.stats.stamina += 2;
      attackerF.stats.grappling += 1;
      users[message.author.id].xp = 0;

      message.channel.send(`🔥 ${attackerF.name} leveled up to level ${users[message.author.id].level}!`);
    }

    // miss / crit mechanics
    const critChance = 0.1; // 10%
    const missChance = 0.05; // 5%

    if (Math.random() < missChance) {
      damage = 0; // Miss
    } else if (Math.random() < critChance) {
      damage *= 2; // Critical hit
    }

    // defense checks (block/dodge)
    if (opponentF.isBlocking) {
      damage = Math.floor(damage / 2);
      opponentF.isBlocking = false;
    }
    if (opponentF.isDodging && Math.random() < 0.5) {
      damage = 0; // dodged successfully
      opponentF.isDodging = false;
    }

    opponentF.health -= damage;

    const actions = ["throws a jab", "lands a spinning kick", "goes for a takedown", "unleashes an uppercut", "fires a leg kick"];
    const action = actions[Math.floor(Math.random() * actions.length)];

    message.channel.send(
      `💥 ${attackerF.name} ${action} on ${opponentF.name} for ${damage} damage! (${opponentF.health} HP left)`
    );

    // Check KO
    if (opponentF.health <= 0) {
      message.channel.send(`🥇 ${attackerF.name} wins the fight!`);

      // Update coins/wins/losses on user records
      users[message.author.id].coins = (users[message.author.id].coins || 0) + 10;
      users[message.author.id].wins = (users[message.author.id].wins || 0) + 1;
      users[opponentId].losses = (users[opponentId].losses || 0) + 1;

      // Reset fight
      inFight[message.author.id] = null;
      inFight[opponentId] = null;

      // Reset opponent health
      opponentF.health = 100;
    }
  }
});

// ----------------- LOGIN -----------------
// ----------------- INTERACTION HANDLER -----------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const fight = fights[interaction.channel.id];
  if (!fight) return;

  const attackerId = interaction.user.id;
  const defenderId = attackerId === fight.p1 ? fight.p2 : fight.p1;

  // Ensure both users exist
  if (!users[attackerId] || !users[attackerId].fighter || !users[defenderId] || !users[defenderId].fighter) {
    try {
      if (!interaction.replied && !interaction.deferred)
        await interaction.reply({ content: "Internal error: fighter data missing.", ephemeral: true });
    } catch {}
    return;
  }

  if (interaction.user.id !== fight.turn) {
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: "⛔ Not your turn!", ephemeral: true });
      } else {
        await interaction.reply({ content: "⛔ Not your turn!", ephemeral: true });
      }
    } catch (err) { console.warn("Not your turn reply failed:", err?.message || err); }
    return;
  }

  const atkUser = users[attackerId];
  const defUser = users[defenderId];

  const atkFighter = atkUser.fighter;
  const defFighter = defUser.fighter;

  let damage = 0;
  let text = "";

  const id = interaction.customId;

  // ---------------- Defense ----------------
  if (id === "block") {
    atkFighter.isBlocking = true;
    text = `${atkFighter.name} is blocking!`;
    fight.turn = defenderId;
  } else if (id === "dodge") {
    atkFighter.isDodging = true;
    text = `${atkFighter.name} attempts to dodge!`;
    fight.turn = defenderId;
  } else {
    // ---------------- Attack Types ----------------
    switch (id) {
      case "attack":
        damage = Math.max(1, Math.floor((Math.random() * 0.4 + 0.2) * atkFighter.stats.power));
        text = `🥊 **${atkFighter.name}** attacks **${defFighter.name}** for **${damage} damage**!`;
        break;
      case "punch":
        const stamFactor = (atkFighter.stats.stamina || 50) / 100;
        damage = Math.max(1, Math.floor((Math.random() * 0.25 + 0.1) * atkFighter.stats.power * stamFactor));
        text = `👊 **${atkFighter.name}** punches **${defFighter.name}** for **${damage} damage**!`;
        break;
      case "hook":
        damage = Math.max(1, Math.floor((Math.random() * 0.5 + 0.3) * atkFighter.stats.power));
        if (Math.random() < 0.15) {
          damage *= 2;
          text = `🪝 **${atkFighter.name}** lands a **CRITICAL HOOK** on **${defFighter.name}** for **${damage} damage**!`;
        } else {
          text = `🪝 **${atkFighter.name}** hits **${defFighter.name}** with a hook for **${damage} damage**!`;
        }
        break;
      case "submit":
        const roll = Math.random() * 100;
        if ((atkFighter.stats.grappling || 0) >= roll) {
          damage = defFighter.health; // instant KO
          text = `🧷 **${atkFighter.name}** locks in a **submission**! **${defFighter.name}** taps out!`;
        } else {
          damage = Math.max(1, Math.floor((atkFighter.stats.grappling / 100) * 8));
          text = `🧷 **${atkFighter.name}** attempts a submission but fails, dealing **${damage} damage**.`;
        }
        break;
      default:
        try { if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: "Unknown action.", ephemeral: true }); } catch {}
        return;
    }

    // ---------------- Apply Damage ----------------
    // Defense checks
    if (defFighter.isBlocking) {
      damage = Math.floor(damage / 2);
      defFighter.isBlocking = false;
    }
    if (defFighter.isDodging && Math.random() < 0.5) {
      damage = 0;
      defFighter.isDodging = false;
    }

    defFighter.health -= damage;

    // ---------------- XP & Level Up ----------------
    atkUser.xp += 10;
    if (atkUser.xp >= atkUser.level * 50) {
      atkUser.level += 1;
      atkFighter.stats.power += 2;
      atkFighter.stats.stamina += 2;
      atkFighter.stats.grappling += 1;
      atkUser.xp = 0;
      try { interaction.channel.send(`🔥 ${atkFighter.name} leveled up to level ${atkUser.level}!`); } catch {}
    }
  }

  // ---------------- Check KO ----------------
  if (defFighter.health <= 0) {
    text += `\n\n🏆 <@${attackerId}> WINS!`;

    // Coins, wins/losses
    atkUser.coins += 10;
    atkUser.wins += 1;
    defUser.losses += 1;

    // Reset fight state
    delete fights[interaction.channel.id];
    inFight[attackerId] = null;
    inFight[defenderId] = null;

    // Reset health
    atkFighter.health = 100;
    defFighter.health = 100;

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: text, components: [] });
      } else {
        await interaction.update({ content: text, components: [] });
      }
    } catch (err) { console.warn("KO update failed:", err?.message || err); }
    return;
  }

  // ---------------- Pass Turn ----------------
  fight.turn = defenderId;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("attack").setLabel("🥊 Attack").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("punch").setLabel("👊 Punch").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("hook").setLabel("🪝 Hook").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("submit").setLabel("🧷 Submit").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("block").setLabel("🛡 Block").setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("dodge").setLabel("💨 Dodge").setStyle(ButtonStyle.Primary)
  );

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: text + `\n\n➡️ <@${defenderId}> your turn`, components: [row, row2] });
    } else {
      await interaction.update({ content: text + `\n\n➡️ <@${defenderId}> your turn`, components: [row, row2] });
    }
  } catch (err) { console.warn("Attack update failed:", err?.message || err); }
});

// ----------------- LOGIN -----------------
client.login(process.env.BOT_TOKEN);

