import excel from "excel4node"

import path, {dirname} from "path";
import puppeteer from 'puppeteer';
import Downloader from 'nodejs-file-downloader';

import {fileURLToPath} from 'url';
import getPageContent from './functions/getPageContent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PAGE_URL = "https://smartmedicalbuyer.com";

export const LAUNCH_PUPPETEER_CONF = {
	arsg: [
		'--no-sandbox',
		'--disable-setuid-sandbox',
		'--disable-dev-shm-usage',
		'--disable-gpu',
		'--window-size=1920,1080',
	]
}

async function downloadImage(url, path, fileName) {
	const downloader = new Downloader({
		url,
		directory: path,
		fileName,
	});
	try {
		await downloader.download();
	} catch (error) {
		console.log("Download failed", error);
	}
}

const workbook = new excel.Workbook();
const worksheets = {}

const main = async () => {
	const browser = await puppeteer.launch({headless: true, ignoreHTTPSErrors: true, LAUNCH_PUPPETEER_CONF});
	try {
		const collectionPage = await getPageContent(browser, PAGE_URL + "/collections")
		
		//ListOfCategory
		let resultData = await collectionPage.evaluate(() => (
			[...document.querySelectorAll(".page-list-collections .collection__item")].map((el, index) => ({
					title: el.querySelector(".collection__title a").innerText,
					href: el.querySelector(".collection__title a").href,
					id: index,
					products: []
				}
			)))
		)
		
		//ListOfProductsInCategory
		for (let category of resultData) {
			// if (category.id == 0 || category.id == 1) {
			if (category.id < 2) {
				const categoryPage = await getPageContent(browser, category.href);
				
				worksheets[`Category${category.id}`] = workbook.addWorksheet(`Category${category.id}`);
				worksheets[`Category${category.id}`].column(2).setWidth(50);
				worksheets[`Category${category.id}`].column(3).setWidth(50);
				worksheets[`Category${category.id}`].column(4).setWidth(50);
				worksheets[`Category${category.id}`].column(5).setWidth(50);
				worksheets[`Category${category.id}`].column(6).setWidth(50);
				worksheets[`Category${category.id}`].column(7).setWidth(50);
				worksheets[`Category${category.id}`].column(8).setWidth(50);
				
				workbook.write('Excel.xlsx');
				
				resultData[category.id].products = await categoryPage.evaluate(async () => {
					await new Promise((resolve, reject) => {
						const interval = setInterval(() => {
							const button = document.querySelector('#site-pagination > div > button');
							const finishButton = document.querySelector('#site-pagination > div > button.disabled');
							if (!finishButton) {
								button.click();
							} else {
								clearInterval(interval);
								resolve();
							}
						}, 100);
					});
					
					return [...document.querySelectorAll("#site-primary .products .product")].map((el, index) => ({
						title: el.querySelector("form > div > div.mf-product-details > div.mf-product-content > h2 > a").innerText,
						href: el.querySelector("form > div > div.mf-product-details > div.mf-product-content > h2 > a").href,
						id: index
					}))
				})
			}
		}
		
		//ProductInformation
		for (let category of resultData) {
			
			let _i = 2;
			for (let product of category.products) {
				const productPage = await getPageContent(browser, product.href);
				
				const optionsSelects = await productPage.evaluate(async () => {
					return [...document.querySelectorAll(".product-single__content .product-form__variants select option")].map(el => ({
						value: el.value,
						name: el.innerText
					}))
				})
				const optionData = {};
				
				for (let option of optionsSelects) {
					await productPage.select(".product-form__variants select", option.value);
					const data = await productPage.evaluate(async () => {
						return {
							offerPrice: document.querySelector("#ProductPrice-product-template > span").innerText,
							prevPrice: document.querySelector("#ComparePrice-product-template > span").innerText,
							status: document.querySelector("div.mf-product-detail div.summary.entry-summary .mf-summary-header").innerText.split('Status:')[1],
						}
					})
					optionData[option.name] = data
				}
				const productData = await productPage.evaluate(async () => {
					return {
						features: [...document.querySelectorAll("#primary > div > div.mf-product-detail > div.summary.entry-summary > table > tbody > tr > td")].filter(el => el.innerText).map(el => el.innerText),
						optionLabel: document.querySelector(".product-form__variants label").innerText,
						images: [...document.querySelectorAll("#primary div.mf-product-detail .slick-slide img")].filter(el => el.src).map(el => el.src),
						description: document.querySelector(".product-single__tabs  #tab-description").innerText,
					}
				});
				
				const allProductData = {
					...resultData[category.id].products[product.id],
					...productData,
					optionData: {
						...optionData
					}
				}
				resultData[category.id].products[product.id] = allProductData
				
				console.log(resultData[category.id].products[product.id])
				
				//------- Write to XML ------
				//FirstRow
				worksheets[`Category${category.id}`].cell(_i, 1).number(allProductData.id)
				worksheets[`Category${category.id}`].cell(_i, 2).string(allProductData.href.toString())
				worksheets[`Category${category.id}`].cell(_i, 3).string(allProductData.title.toString())
				_i += 2;
				
				//Images
				worksheets[`Category${category.id}`].cell(_i, 2).string("Images:")
				for (let image of allProductData.images) {
					_i++;
					worksheets[`Category${category.id}`].cell(_i, 2).string(image)
				}
				_i += 2;
				
				//Features
				worksheets[`Category${category.id}`].cell(_i, 2).string("Features:")
				_i++;
				
				for (let j = 2; j < allProductData.features.length + 2; j++) {
					worksheets[`Category${category.id}`].cell(_i, j).string(allProductData.features[j - 2])
				}
				_i += 2;
				
				//OptionLabel
				worksheets[`Category${category.id}`].cell(_i, 2).string("Options:")
				for (let optionName of Object.keys(allProductData.optionData)) {
					_i += 1;
					worksheets[`Category${category.id}`].cell(_i, 2).string(optionName)
					worksheets[`Category${category.id}`].cell(_i, 3).string(allProductData.optionData[optionName].offerPrice)
					worksheets[`Category${category.id}`].cell(_i, 4).string(allProductData.optionData[optionName].prevPrice)
					worksheets[`Category${category.id}`].cell(_i, 5).string(allProductData.optionData[optionName].status)
				}
				_i += 2;
				worksheets[`Category${category.id}`].cell(_i, 2).string("Description:")
				_i++;
				worksheets[`Category${category.id}`].cell(_i, 2).string(allProductData.description)
				
				_i += 5;
				workbook.write('Excel.xlsx');
				
				let k = 0;
				//Download Images
				for (let image of allProductData.images) {
					await downloadImage(image, `./images/category${category.id}`, `product${product.id}_${k}.jpg`)
					k++;
				}
			}
		}
		
		// fs.writeFileSync(path.resolve(__dirname, "result", "result.txt"), JSON.stringify(resultData))
		// console.log(resultData[0].products[0])
		
		await browser.close();
	} catch
		(e) {
		console.log(e)
		await browser.close();
	}
}
main()