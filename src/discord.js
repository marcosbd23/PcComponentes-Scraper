const { Webhook, MessageBuilder } = require('discord-webhook-node');
const config = require("../config")
const hook = new Webhook(config.webhook_url);

const Discord = {

    sendWebhook({url, name, oldPrice, newPrice}) {
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
        .setDescription("Nuevo precio mas bajo")
        .setURL(url)
        .addField('Antiguo', formattedOldPrice, true)
        .addField('Nuevo', formattedNewPrice, true)
        .setColor('#FF6000')
        .setTimestamp();

        hook.send(embed);
    }
}

module.exports = Discord