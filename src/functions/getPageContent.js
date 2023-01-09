const PAGE_PUPPETEER_CONF = {
	networkIdle2Timeout: 5000,
	waitUntil: "networkidle2",
	timeout: 30000
}

const getPageContent = async (browser, url) => {
	try {
		const page = await browser.newPage();
		
		// page.on('console', async (msg) => {
		// 	const msgArgs = msg.args();
		// 	for (let i = 0; i < msgArgs.length; ++i) {
		// 		console.log(await msgArgs[i].jsonValue());
		// 	}
		// });

		await page.setViewport({
			width: 1920,
			height: 1080,
		})
		
		await page.goto(url, PAGE_PUPPETEER_CONF);
		
		return page
	} catch (e) {
		console.log(e)
		throw e
	}
};

export default getPageContent