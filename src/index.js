const { Cluster } = require('puppeteer-cluster');
const puppeteer = require('puppeteer-extra');
const pluginStealth = require('puppeteer-extra-plugin-stealth');
const fs = require("fs");

const Database = require('./database');
const Discord = require('./discord');

puppeteer.use(pluginStealth());

(async () => {
    let productsInfo = [];
    const LINKS = fs.readFileSync('links.txt').toString().replace(/\r/g, "").split("\n")

    // Create a cluster with 2 workers
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 5,

        puppeteer,
        puppeteerOptions: {
            headless: "new"
        }
    });

    // Scrape Task
    await cluster.task(async ({ page, data: url }) => {
        await page.goto(url);

        await page.waitForSelector('#pdp-title');
        let data = await page.evaluate((url) => {
            const id = document.getElementById("pdp-id").textContent;
            const title = document.getElementById("pdp-title").textContent;
            const stock = document.getElementById("pdp-add-to-cart") !== null;
            let priceWithIVA = document.getElementById("pdp-price-current-integer").textContent;

            const convertPriceToNumber = (priceString) => {
                return parseFloat(priceString.replace("€", "").replace(",", "."))
            }

            const convertIVAToIGIC = (price_iva) => {
                const priceWithoutIVA = price_iva / (1 + 21 / 100);
                return Number((priceWithoutIVA * (1 + 7 / 100)).toFixed(2));
            }

            priceWithIVA = convertPriceToNumber(priceWithIVA);
            const priceWithIGIC = convertIVAToIGIC(priceWithIVA)

            return { id, title, url, stock, priceWithIGIC, priceWithIVA }
        }, url);

        productsInfo.push(data)
        console.log(`Scraped ${url}`)
    });

    cluster.on('taskerror', (err, data) => {
        console.error(`Failed to scrape ${data}: ${err.message}`);
    });

    // Add pages to queue
    for (link of LINKS) {
        cluster.queue(link);
    }

    // Shutdown after everything is done
    await cluster.idle();
    await cluster.close();

    // print scraped data
    console.log(productsInfo)

    // Update products info in database
    try {
        await Database.connect();

        for (const product of productsInfo) {
            const existingProduct = await Database.getProductInfo(product.id);

            if (existingProduct) {

                existingProduct.precio = parseFloat(existingProduct.precio)
                existingProduct.lowest_price = parseFloat(existingProduct.lowest_price)
                existingProduct.stock = Boolean((Buffer.from(existingProduct.stock)).readInt8()) //read boolean from buffer

                // if there its a new lowest price send a webhook
                if (product.priceWithIGIC < existingProduct.lowest_price) {
                    Discord.sendWebhook({
                        url: product.url,
                        name: product.title,
                        oldPrice: existingProduct.lowest_price,
                        newPrice: product.priceWithIGIC
                    });

                    existingProduct.lowest_price = product.priceWithIGIC
                }

                existingProduct.stock = product.stock
                existingProduct.precio = product.priceWithIGIC

                await Database.updateProduct({
                    id: existingProduct.id,
                    name: existingProduct.nombre,
                    link: existingProduct.enlace,
                    stock: existingProduct.stock,
                    price: existingProduct.precio,
                    lowest_price: existingProduct.lowest_price
                });

            } else {

                await Database.insertProduct({
                    id: product.id,
                    name: product.title,
                    link: product.url,
                    stock: product.stock,
                    price: product.priceWithIGIC
                });

                console.log(`${product.title} does not exist in the database. New information inserted.`);
            }
        }

    } catch (error) {
        console.error(error);
    } finally {
        Database.close();
    }

})();
