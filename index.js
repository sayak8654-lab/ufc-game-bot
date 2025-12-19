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
const userFighters = {}; // stores which fighter each user picked
const inFight = {};      // tracks ongoing fights
const fights = {}; 
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

  // ----------------- CHOOSE -----------------
  if (command === "ufchoose") {
  const fighterKey = args[1]?.toLowerCase();

  if (!fighterKey) {
    return message.reply("Usage: ufchoose <fighter>");
  }

  if (!fighters[fighterKey]) {
    return message.reply("❌ Fighter not found. Try another name.");
  }

  // Clone fighter data so stats don't affect original
  userFighters[message.author.id] = JSON.parse(
    JSON.stringify(fighters[fighterKey])
  );

  const fighter = userFighters[message.author.id];

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

  console.log(`ufchoose triggered for ${message.author.tag}, fighterKey=${fighterKey}`);
  message.channel.send({ embeds: [embed] });
}


  // ----------------- PROFILE -----------------
  if (command === "ufprofile") {
    const fighter = userFighters[message.author.id];
    if (!fighter) return message.reply("You have not chosen a fighter yet. Use ufchoose");

    const embed = {
      title: `${fighter.name} 🥊`,
      description: `Health: ${fighter.health} | Coins: ${fighter.coins}`,
      image: { url: fighter.image },
      color: 0x00ff00
    };

    return message.channel.send({ embeds: [embed] });
  }

  // ----------------- RECORD -----------------
  if (command === "ufrecord") {
    const fighter = userFighters[message.author.id];
    if (!fighter) return message.reply("You have not chosen a fighter yet. Use ufchoose");

    return message.channel.send(`${fighter.name} — Wins: ${fighter.wins || 0} | Losses: ${fighter.losses || 0}`);
  }

  // ----------------- FIGHT -----------------
  if (command === "uffight") {
  const opponent = message.mentions.users.first();
  if (!opponent) return message.reply("Mention someone to fight!");

  if (!userFighters[message.author.id] || !userFighters[opponent.id]) {
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
  if (userFighters[message.author.id]) userFighters[message.author.id].health = 100;
  if (userFighters[opponent.id]) userFighters[opponent.id].health = 100;

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

    const opponent = userFighters[opponentId];
    const attacker = userFighters[message.author.id];

    // Random damage between 5 and 25
    let damage = Math.floor(Math.random() * 20) + 5;
    // Award XP to attacker
    attacker.xp = (attacker.xp || 0) + 10;

    // Check for level-up
    if (!attacker.level) attacker.level = 1;
    if (attacker.xp >= attacker.level * 50) {
      attacker.level += 1;
      attacker.stats.power += 2;
      attacker.stats.stamina += 2;
      attacker.stats.grappling += 1;
      attacker.xp = 0;

      message.channel.send(`🔥 ${attacker.name} leveled up to level ${attacker.level}!`);
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
    if (opponent.isBlocking) {
      damage = Math.floor(damage / 2);
      opponent.isBlocking = false;
    }
    if (opponent.isDodging && Math.random() < 0.5) {
      damage = 0; // dodged successfully
      opponent.isDodging = false;
    }

    opponent.health -= damage;

    const actions = ["throws a jab", "lands a spinning kick", "goes for a takedown", "unleashes an uppercut", "fires a leg kick"];
    const action = actions[Math.floor(Math.random() * actions.length)];

    message.channel.send(
      `💥 ${attacker.name} ${action} on ${opponent.name} for ${damage} damage! (${opponent.health} HP left)`
    );

    // Check KO
    if (opponent.health <= 0) {
      message.channel.send(`🥇 ${attacker.name} wins the fight!`);
      attacker.coins = (attacker.coins || 0) + 10;

      // Update fight history
      attacker.wins = (attacker.wins || 0) + 1;
      opponent.losses = (opponent.losses || 0) + 1;

      // Reset fight
      inFight[message.author.id] = null;
      inFight[opponentId] = null;

      // Reset opponent health
      opponent.health = 100;
    }
  }
});

// ----------------- LOGIN -----------------
// ----------------- INTERACTION HANDLER -----------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const fight = fights[interaction.channel.id];
  if (!fight) return;

  if (interaction.user.id !== fight.turn) {
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: "⛔ Not your turn!", ephemeral: true });
      } else {
        await interaction.reply({ content: "⛔ Not your turn!", ephemeral: true });
      }
    } catch (err) {
      console.warn("Could not reply to interaction (not your turn):", err?.message || err);
    }
    return;
  }

  const attacker = interaction.user.id;
  const defender = attacker === fight.p1 ? fight.p2 : fight.p1;

  const atkFighter = userFighters[attacker];
  const defFighter = userFighters[defender];

  if (!atkFighter || !defFighter) {
    try { if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: "Internal error: fighter data missing.", ephemeral: true }); } catch {};
    return;
  }

  const id = interaction.customId;
  let damage = 0;
  let text = "";

  // Defense actions: block / dodge
  if (id === "block") {
    atkFighter.isBlocking = true;
    text = `${atkFighter.name} is blocking!`;

    // pass turn to defender
    fight.turn = defender;

    const rowBlock = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("attack").setLabel("🥊 Attack").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("punch").setLabel("👊 Punch").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("hook").setLabel("🪝 Hook").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("submit").setLabel("🧷 Submit").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("block").setLabel("🛡 Block").setStyle(ButtonStyle.Secondary)
    );

    const rowBlock2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("dodge").setLabel("💨 Dodge").setStyle(ButtonStyle.Primary)
    );

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: text + `\n\n➡️ <@${defender}> your turn`, components: [rowBlock, rowBlock2] });
      } else {
        await interaction.update({ content: text + `\n\n➡️ <@${defender}> your turn`, components: [rowBlock, rowBlock2] });
      }
    } catch (err) {
      console.warn("Could not update interaction on block:", err?.message || err);
    }

    return;
  } else if (id === "dodge") {
    atkFighter.isDodging = true;
    text = `${atkFighter.name} attempts to dodge!`;

    // pass turn to defender
    fight.turn = defender;

    const rowDodge = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("attack").setLabel("🥊 Attack").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("punch").setLabel("👊 Punch").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("hook").setLabel("🪝 Hook").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("submit").setLabel("🧷 Submit").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("block").setLabel("🛡 Block").setStyle(ButtonStyle.Secondary)
    );

    const rowDodge2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("dodge").setLabel("💨 Dodge").setStyle(ButtonStyle.Primary)
    );

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: text + `\n\n➡️ <@${defender}> your turn`, components: [rowDodge, rowDodge2] });
      } else {
        await interaction.update({ content: text + `\n\n➡️ <@${defender}> your turn`, components: [rowDodge, rowDodge2] });
      }
    } catch (err) {
      console.warn("Could not update interaction on dodge:", err?.message || err);
    }

    return;
  }

  if (id === "attack") {
    // standard attack: scales with power (20% - 60% of power)
    const base = atkFighter.stats.power || 10;
    damage = Math.max(1, Math.floor((Math.random() * 0.4 + 0.2) * base));
    // Award XP to attacker
    atkFighter.xp = (atkFighter.xp || 0) + 10;

    // Check for level-up
    if (!atkFighter.level) atkFighter.level = 1;
    if (atkFighter.xp >= atkFighter.level * 50) {
      atkFighter.level += 1;
      atkFighter.stats.power += 2;
      atkFighter.stats.stamina += 2;
      atkFighter.stats.grappling += 1;
      atkFighter.xp = 0;

      try { interaction.channel.send(`🔥 ${atkFighter.name} leveled up to level ${atkFighter.level}!`); } catch {};
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
    if (defFighter.isBlocking) {
      damage = Math.floor(damage / 2);
      defFighter.isBlocking = false;
    }
    if (defFighter.isDodging && Math.random() < 0.5) {
      damage = 0; // dodged successfully
      defFighter.isDodging = false;
    }

    defFighter.health -= damage;
    const actions = ["throws a jab", "lands a spinning kick", "goes for a takedown", "unleashes an uppercut", "fires a leg kick"];
    const action = actions[Math.floor(Math.random() * actions.length)];
    text = `🥊 **${atkFighter.name}** ${action} on **${defFighter.name}** for **${damage} damage**!`;
  } else if (id === "punch") {
    // quick punch: smaller damage but scaled by stamina (10% - 35% of power * stamina)
    const baseP = atkFighter.stats.power || 10;
    const stamFactor = (atkFighter.stats.stamina || 50) / 100;
    damage = Math.max(1, Math.floor((Math.random() * 0.25 + 0.1) * baseP * stamFactor));
    // Award XP to attacker
    atkFighter.xp = (atkFighter.xp || 0) + 10;
    if (!atkFighter.level) atkFighter.level = 1;
    if (atkFighter.xp >= atkFighter.level * 50) {
      atkFighter.level += 1;
      atkFighter.stats.power += 2;
      atkFighter.stats.stamina += 2;
      atkFighter.stats.grappling += 1;
      atkFighter.xp = 0;
      try { interaction.channel.send(`🔥 ${atkFighter.name} leveled up to level ${atkFighter.level}!`); } catch {};
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
    if (defFighter.isBlocking) {
      damage = Math.floor(damage / 2);
      defFighter.isBlocking = false;
    }
    if (defFighter.isDodging && Math.random() < 0.5) {
      damage = 0; // dodged successfully
      defFighter.isDodging = false;
    }

    defFighter.health -= damage;
    const actions = ["throws a jab", "lands a spinning kick", "goes for a takedown", "unleashes an uppercut", "fires a leg kick"];
    const action = actions[Math.floor(Math.random() * actions.length)];
    text = `👊 **${atkFighter.name}** ${action} on **${defFighter.name}** for **${damage} damage**!`;
  } else if (id === "hook") {
    // heavy hook: higher damage, small chance to crit (30% - 80% of power)
    const baseH = atkFighter.stats.power || 10;
    damage = Math.max(1, Math.floor((Math.random() * 0.5 + 0.3) * baseH));
    // crit
    if (Math.random() < 0.15) {
      damage = damage * 2;
      text = `🪝 **${atkFighter.name}** lands a **CRITICAL HOOK** on **${defFighter.name}** for **${damage} damage**!`;
    } else {
      text = `🪝 **${atkFighter.name}** connects with a **hook** on **${defFighter.name}** for **${damage} damage**!`;
    }
    // Award XP to attacker
    atkFighter.xp = (atkFighter.xp || 0) + 10;
    if (!atkFighter.level) atkFighter.level = 1;
    if (atkFighter.xp >= atkFighter.level * 50) {
      atkFighter.level += 1;
      atkFighter.stats.power += 2;
      atkFighter.stats.stamina += 2;
      atkFighter.stats.grappling += 1;
      atkFighter.xp = 0;
      try { interaction.channel.send(`🔥 ${atkFighter.name} leveled up to level ${atkFighter.level}!`); } catch {};
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
    if (defFighter.isBlocking) {
      damage = Math.floor(damage / 2);
      defFighter.isBlocking = false;
    }
    if (defFighter.isDodging && Math.random() < 0.5) {
      damage = 0; // dodged successfully
      defFighter.isDodging = false;
    }

    defFighter.health -= damage;
    // If non-critical hook, use narrated action instead of plain hook message
    if (!text.includes('CRITICAL')) {
      const actions = ["throws a jab", "lands a spinning kick", "goes for a takedown", "unleashes an uppercut", "fires a leg kick"];
      const action = actions[Math.floor(Math.random() * actions.length)];
      text = `🪝 **${atkFighter.name}** ${action} on **${defFighter.name}** for **${damage} damage**!`;
    }
  } else if (id === "submit") {
    // submission: high chance based on grappling; if fail, small grappling damage
    const grap = atkFighter.stats.grappling || 0;
    const roll = Math.random() * 100;
    if (grap >= roll) {
      // Award XP to attacker for successful submission
      atkFighter.xp = (atkFighter.xp || 0) + 10;
      if (!atkFighter.level) atkFighter.level = 1;
      if (atkFighter.xp >= atkFighter.level * 50) {
        atkFighter.level += 1;
        atkFighter.stats.power += 2;
        atkFighter.stats.stamina += 2;
        atkFighter.stats.grappling += 1;
        atkFighter.xp = 0;
        try { interaction.channel.send(`🔥 ${atkFighter.name} leveled up to level ${atkFighter.level}!`); } catch {};
      }
      defFighter.health = 0;
      text = `🧷 **${atkFighter.name}** locks in a **submission**! **${defFighter.name}** taps out!`;
    } else {
      damage = Math.max(1, Math.floor((grap / 100) * 8));
      // Award XP to attacker for the attempt
      atkFighter.xp = (atkFighter.xp || 0) + 10;
      if (!atkFighter.level) atkFighter.level = 1;
      if (atkFighter.xp >= atkFighter.level * 50) {
        atkFighter.level += 1;
        atkFighter.stats.power += 2;
        atkFighter.stats.stamina += 2;
        atkFighter.stats.grappling += 1;
        atkFighter.xp = 0;
        try { interaction.channel.send(`🔥 ${atkFighter.name} leveled up to level ${atkFighter.level}!`); } catch {};
      }

      // miss / crit mechanics
      const critChance = 0.1; // 10%
      const missChance = 0.05; // 5%

      if (Math.random() < missChance) {
        damage = 0; // Miss
      } else if (Math.random() < critChance) {
        damage *= 2; // Critical hit
      }

      defFighter.health -= damage;
      text = `🧷 **${atkFighter.name}** attempts a **submission** but fails, dealing **${damage} damage**.`;
    }
  } else {
    // unknown button - ignore
    try { if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: "Unknown action.", ephemeral: true }); } catch {};
    return;
  }

  if (defFighter.health <= 0) {
    text += `\n\n🏆 <@${attacker}> WINS!`;

    // Give coins to attacker for winning
    try { atkFighter.coins = (atkFighter.coins || 0) + 10; } catch {};

    // Update fight history
    try { atkFighter.wins = (atkFighter.wins || 0) + 1; defFighter.losses = (defFighter.losses || 0) + 1; } catch {};

    // cleanup fight state
    delete fights[interaction.channel.id];
    inFight[attacker] = null;
    inFight[defender] = null;

    // reset health for both fighters
    if (atkFighter) atkFighter.health = 100;
    if (defFighter) defFighter.health = 100;

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: text, components: [] });
      } else {
        await interaction.update({ content: text, components: [] });
      }
    } catch (err) {
      console.warn("Could not update interaction on KO:", err?.message || err);
    }

    return;
  }

  // pass turn to defender
  fight.turn = defender;

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
      await interaction.followUp({ content: text + `\n\n➡️ <@${defender}> your turn`, components: [row, row2] });
    } else {
      await interaction.update({ content: text + `\n\n➡️ <@${defender}> your turn`, components: [row, row2] });
    }
  } catch (err) {
    console.warn("Could not update interaction after attack:", err?.message || err);
  }

  return;
});

// ----------------- LOGIN -----------------
client.login(process.env.BOT_TOKEN);

