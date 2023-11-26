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
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        const product = await page.evaluate(() => {
            const schema = document.getElementById("microdata-product-script")

            if (schema) {
                const schemaJSON = JSON.parse(schema.textContent)
                let offers = schemaJSON.offers

                // if have nested offers key get that
                if (offers.hasOwnProperty("offers")) offers = offers.offers

                const convertIVAToIGIC = (price_iva) => {
                    const priceWithoutIVA = price_iva / (1 + 21 / 100);
                    return Number((priceWithoutIVA * (1 + 7 / 100)).toFixed(2));
                }

                return {
                    id: schemaJSON.sku,
                    url: schemaJSON.url,
                    name: schemaJSON.name,
                    vendor: offers.offeredBy,
                    brand: schemaJSON.brand.name,
                    stock: (offers.availability.replace("https://schema.org/", "")) == "InStock",
                    rating: schemaJSON.aggregateRating.ratingValue,
                    category: schemaJSON.category,
                    price: convertIVAToIGIC(offers.price),
                }
            } else {
                return null
            }
        });

        if (product) {
            productsInfo.push(product)
            console.log(`Scraped ${url}`)
        }else{
            console.log(`Error scraping ${url} dont have schema`)
        }
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
            const storedProduct = await Database.getProductInfo(product.id);

            if (storedProduct) {

                storedProduct.price = parseFloat(storedProduct.price)
                storedProduct.lowest_price = parseFloat(storedProduct.lowest_price)
                storedProduct.stock = Boolean((Buffer.from(storedProduct.stock)).readInt8()) //read boolean from buffer

                // check changes
                if (storedProduct.price != product.price) {
                    Discord.sendChangeLog({
                        type: "Changed Price",
                        url: product.url,
                        name: product.name,
                        oldInfo: storedProduct.price,
                        newInfo: product.price
                    })

                    Database.insertChange({
                        type: "price",
                        product_id: product.id,
                        oldInfo: storedProduct.price,
                        newInfo: product.price
                    })
                }

                if (storedProduct.stock != product.stock) {
                    Discord.sendChangeLog({
                        type: "Changed Stock",
                        url: product.url,
                        name: product.name,
                        oldInfo: storedProduct.price,
                        newInfo: product.price
                    })

                    Database.insertChange({
                        type: "stock",
                        product_id: product.id,
                        oldInfo: storedProduct.stock,
                        newInfo: product.stock
                    })
                }

                if (storedProduct.vendor != product.vendor) {
                    Discord.sendChangeLog({
                        type: "Changed Vendor",
                        url: product.url,
                        name: product.name,
                        oldInfo: storedProduct.vendor,
                        newInfo: product.vendor
                    })

                    Database.insertChange({
                        type: "vendor",
                        product_id: product.id,
                        oldInfo: storedProduct.vendor,
                        newInfo: product.vendor
                    })
                }


                // if there its a new lowest price send a webhook
                if (product.price < storedProduct.lowest_price) {
                    Discord.sendPriceLog({
                        url: product.url,
                        name: product.name,
                        oldPrice: storedProduct.lowest_price,
                        newPrice: product.price
                    });

                    storedProduct.lowest_price = product.price
                }

                storedProduct.stock = product.stock
                storedProduct.price = product.price
                storedProduct.vendor = product.vendor
                storedProduct.brand = product.brand

                await Database.updateProduct({
                    id: storedProduct.id,
                    name: storedProduct.name,
                    url: storedProduct.url,
                    vendor: storedProduct.vendor,
                    brand: storedProduct.brand,
                    stock: storedProduct.stock,
                    price: storedProduct.price,
                    lowest_price: storedProduct.lowest_price
                });

            } else {

                await Database.insertProduct({
                    id: product.id,
                    name: product.name,
                    url: product.url,
                    vendor: product.vendor,
                    brand: product.brand,
                    stock: product.stock,
                    price: product.price
                });

                console.log(`${product.name} does not exist in the database. New information inserted.`);
            }
        }

    } catch (error) {
        console.error(error);
    } finally {
        Database.close();
    }

})();
