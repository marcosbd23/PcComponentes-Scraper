const { Webhook, MessageBuilder } = require('discord-webhook-node');
const config = require("../config")
const producthook = new Webhook(config.product_webhook_url);
const changehook = new Webhook(config.change_webhook_url);

const Discord = {

    sendPriceLog({url, name, oldPrice, newPrice}) {
        if (oldPrice == newPrice) return;
        const formattedOldPrice = oldPrice.toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
        });

        const formattedNewPrice = newPrice.toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
        });

        const embed = new MessageBuilder()
        .setTitle(name)
        .setDescription("Lowest Price Updated")
        .setURL(url)
        .addField('Old', formattedOldPrice, true)
        .addField('New', formattedNewPrice, true)
        .setColor('#FF6000')
        .setTimestamp();

        producthook.send(embed);
    },

    sendChangeLog({type, url, name, oldInfo, newInfo}) {
        if (oldInfo == newInfo) return;

        oldInfo = oldInfo.toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
        });

        newInfo = newInfo.toLocaleString('es-ES', {
            style: 'currency',
            currency: 'EUR',
        });

        const embed = new MessageBuilder()
        .setTitle(name)
        .setDescription(type)
        .setURL(url)
        .addField('Old', oldInfo, true)
        .addField('New', newInfo, true)
        .setColor('#FF6000')
        .setTimestamp();

        changehook.send(embed);
    }
}

module.exports = Discord