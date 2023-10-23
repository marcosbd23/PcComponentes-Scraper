const { Cluster } = require('puppeteer-cluster');
const puppeteer = require('puppeteer-extra');
const pluginStealth = require('puppeteer-extra-plugin-stealth');
const fs = require("fs");

puppeteer.use(pluginStealth());


(async () => {
    // Create a cluster with 2 workers
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 2,

        puppeteer,
        puppeteerOptions: {
            headless: "new"
        }
    });

    let productsData = [];
    const LINKS = fs.readFileSync('links.txt').toString().split("\n")

    // Scrape Task
    await cluster.task(async ({ page, data: url }) => {
        await page.goto(url);

        await page.waitForSelector('#pdp-title');
        let data = await page.evaluate(() => {
            const id = document.querySelector("#pdp-id").textContent;
            const title = document.querySelector("#pdp-title").textContent;
            const price = document.querySelector("#pdp-price-current-integer").textContent;
            const seller = document.querySelector(".sc-feUZmu.fzZuQg.sc-dLmyTH.bpKjPK").textContent;
            const sellerLink = document.querySelector(".sc-feUZmu.fzZuQg.sc-dLmyTH.bpKjPK").href;
            const reviews = document.querySelector(".sc-gmPhUn.hTKdHy.sc-fYKINB.espnua").textContent.replace(/[(opiniones) ]/g, "");

            return { id, title, seller, sellerLink, reviews, price }
        });

        productsData.push(data)
    });

    cluster.on('taskerror', (err, data, willRetry) => {
        if (willRetry) {
          console.warn(`Encountered an error while scraping ${data}. ${err.message}\nThis job will be retried`);
        } else {
          console.error(`Failed to scrape ${data}: ${err.message}`);
        }
    });

    // Add pages to queue
    for (link of LINKS) {
        cluster.queue(link);
    }

    // Shutdown after everything is done
    await cluster.idle();
    await cluster.close();

    console.log(productsData)
})();
