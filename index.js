const { Cluster } = require('puppeteer-cluster');
const puppeteer = require('puppeteer-extra');
const pluginStealth = require('puppeteer-extra-plugin-stealth');
const fs = require("fs");

puppeteer.use(pluginStealth());

(async () => {
    let productsData = [];
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
            const id = document.querySelector("#pdp-id").textContent;
            const title = document.querySelector("#pdp-title").textContent;
            const stock = document.querySelector("#pdp-add-to-cart") !== null;
            let priceWithIVA = document.querySelector("#pdp-price-current-integer").textContent;

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

        productsData.push(data)
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
    console.log(productsData)
})();
