#!/usr/bin/env node

import fs from 'fs';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { Rcon } from "rcon-client"
import { Tail } from 'tail'
import { loadPlugins } from './Plugin.js'
import Replacers from './Replacers.js'

const replacers = (new Replacers)
    .add(/^<(.*?)>\s(.*)$/, (message, player, text) => `**${player}**: ${text}`)
    .add(/^\[(.*?)]\s(.*)$/, (message, player, text) => `**${player}**: ${text}`)
const jo = JSON.parse(fs.readFileSync('/opt/config.json', 'utf8'));
const plugins = loadPlugins(jo.enable.filter(pluginName => !jo.disable.includes(pluginName)))

process.stdout.write('Starting Minecord ... ');

// MCS
const rcon = new Rcon({
    host: jo.minecraftRconHost, port: jo.minecraftRconPort, password: jo.minecraftRconPassword
});

// discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.User,
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
        Partials.Reaction,
        Partials.GuildScheduledEvent,
        Partials.ThreadMember,
    ],
});

const tail = new Tail(jo.minecraftLog)


let channel
const sendToDiscord = (...args) => channel.send(...args)
const sendToMinecraft = (...args) => rcon.send(...args)

//起動確認
client.on('ready', () => {
    channel = client.channels.cache.get(jo.discordChannel);
    console.log(`${client.user.tag} Ready`);
});

client.on('messageCreate', async message => {
    if (message.channel.id !== channel.id) return
    if (message.author.bot) return

    await rcon.connect()
    await sendToMinecraft(`tellraw @a ${JSON.stringify({
        text: `<${message.member && message.member.nickname || message.author.username}> ${message.cleanContent}`
    })}`)
    rcon.end()
})

const regexpLog = /^\[(.*)]\s\[([^/]*)\/(.*)][^:]*:\s(.*)$/

tail.on('line', async line => {
    if (!regexpLog.test(line)) return

    const [log, time, causedAt, level, message] = regexpLog.exec(line)
    console.log(log)

    const newMessage = replacers.replace(message)
    if (newMessage !== false) await sendToDiscord(newMessage)

})



client.login(jo.discordBotToken);


