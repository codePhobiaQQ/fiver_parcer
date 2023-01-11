import excel from "excel4node"
import Downloader from 'nodejs-file-downloader';

import {dirname} from "path";
import puppeteer from 'puppeteer';

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
const worksheet = workbook.addWorksheet("Products");

const style = workbook.createStyle({
	font: {
		size: 14,
		fontWeight: "bold"
	},
});

const style1 = workbook.createStyle({
	font: {
		size: 16,
		fontWeight: "bold"
	},
});

worksheet.column(2).setWidth(50);
worksheet.column(3).setWidth(115);
worksheet.column(4).setWidth(115);
worksheet.column(5).setWidth(90);
worksheet.column(6).setWidth(30);
worksheet.column(7).setWidth(50);
worksheet.column(8).setWidth(50);
worksheet.column(9).setWidth(50);
worksheet.column(10).setWidth(50);
worksheet.column(11).setWidth(50);

worksheet.cell(1, 1).string("ID").style(style1)
worksheet.cell(1, 2).string("Product Title")
worksheet.cell(1, 3).string("Product Link").style(style1)
worksheet.cell(1, 4).string("Images").style(style1)
worksheet.cell(1, 5).string("Features").style(style1)
worksheet.cell(1, 6).string("Option Label").style(style1)
worksheet.cell(1, 7).string("Option names").style(style1)
worksheet.cell(1, 8).string("Product Offer Price").style(style1)
worksheet.cell(1, 9).string("Product Prev Price").style(style1)
worksheet.cell(1, 10).string("Product Offer Status").style(style1)
worksheet.cell(1, 11).string("Description").style(style1)

workbook.write('Excel.xlsx');

const main = async () => {
	const browser = await puppeteer.launch({headless: true, ignoreHTTPSErrors: true, LAUNCH_PUPPETEER_CONF});
	try {
		const collectionPage = await getPageContent(browser, PAGE_URL + "/collections")
		
		//ListOfCategory
		let resultData = await collectionPage.evaluate(async () => {
				try {
					return (
						[...document.querySelectorAll(".page-list-collections .collection__item")].map((el, index) => ({
								title: el.querySelector(".collection__title a").innerText,
								href: el.querySelector(".collection__title a").href,
								id: index,
								products: []
							}
						)))
				} catch (e) {
					console.log(e)
				}
			}
		)
		
		console.log("Added all categories")
		
		//ListOfProductsInCategory
		for (let category of resultData) {
			// if (category.id == 0 || category.id == 1) {
			console.log("category", category.id)
			if (category.id < 2) {
				const categoryPage = await getPageContent(browser, category.href);
				
				resultData[category.id].products = await categoryPage.evaluate(async () => {
					try {
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
							}, 50);
						});
						
						return [...document.querySelectorAll("#site-primary .products .product")].map((el, index) => ({
							title: el.querySelector("form > div > div.mf-product-details > div.mf-product-content > h2 > a").innerText,
							href: el.querySelector("form > div > div.mf-product-details > div.mf-product-content > h2 > a").href,
							id: index
						}))
					} catch (e) {
						console.log(e)
					}
				})
			}
		}
		
		//ProductInformation
		let _i = 3;
		for (let category of resultData) {
			worksheet.cell(_i, 1).string(`Category: "${category.title}"`).style(style)
			_i++;
			workbook.write('Excel.xlsx');
			
			for (let product of category.products) {
				console.log(`category: ${category.id}`, `product: ${product.id}`)
				
				const productPage = await getPageContent(browser, product.href);
				
				const optionsSelects = await productPage.evaluate(async () => {
					try {
						return [...document.querySelectorAll(".product-single__content .product-form__variants select option")].map(el => ({
							value: el.value,
							name: el.innerText
						}))
					} catch (e) {
						console.log(e)
					}
				})
				const optionData = {};
				
				for (let option of optionsSelects) {
					await productPage.select(".product-form__variants select", option.value);
					const data = await productPage.evaluate(async () => {
						try {
							return {
								offerPrice: document.querySelector("#ProductPrice-product-template > span").innerText,
								prevPrice: document.querySelector("#ComparePrice-product-template > span").innerText,
								status: document.querySelector("div.mf-product-detail div.summary.entry-summary .mf-summary-header").innerText.split('Status:')[1],
							}
						} catch (e) {
							console.log(e)
						}
					})
					optionData[option.name] = data
				}
				const productData = await productPage.evaluate(async () => {
					try {
						return {
							features: [...document.querySelectorAll("#primary > div > div.mf-product-detail > div.summary.entry-summary > table > tbody > tr > td")].filter(el => el.innerText).map(el => el.innerText),
							optionLabel: document.querySelector(".product-form__variants label").innerText,
							images: [...document.querySelectorAll("#primary div.mf-product-detail .slick-slide img")].filter(el => el.src).map(el => el.src),
							description: document.querySelector(".product-single__tabs  #tab-description").innerText,
						}
					} catch (e) {
						console.log(e)
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
				
				// console.log(resultData[category.id].products[product.id])
				
				//------- Write to XML ------
				
				try {
					//FirstRow
					worksheet.cell(_i, 1).number(allProductData.id)
					worksheet.cell(_i, 2).string(allProductData.title.toString())
					worksheet.cell(_i, 3).string(allProductData.href.toString())
					worksheet.cell(_i, 4).string(allProductData.images.join(", \n"))
					worksheet.cell(_i, 5).string(allProductData.features.join(", \n"))
					worksheet.cell(_i, 6).string(allProductData.optionLabel)
					worksheet.cell(_i, 7).string(Object.keys(allProductData.optionData).join(", \n"))
					worksheet.cell(_i, 8).string(Object.values(allProductData.optionData).map(el => el.offerPrice).join("\n"))
					worksheet.cell(_i, 9).string(Object.values(allProductData.optionData).map(el => el.prevPrice).join("\n"))
					worksheet.cell(_i, 10).string(Object.values(allProductData.optionData).map(el => el.status).join("|||").split("\n").join("").split("|||").join("\n"))
					worksheet.cell(_i, 11).string(allProductData.description.split("\n").join(" "))
					_i++;
					workbook.write('Excel.xlsx');
					
					// worksheet.cell(_i, 8).string(Object.keys(allProductData.optionData).join(", \n"))
					
					//Images
					//Features
					// worksheets[`Category${category.id}`].cell(_i, 2).string("Features:")
					// _i++;
					
					// for (let j = 2; j < allProductData.features.length + 2; j++) {
					// 	worksheets[`Category${category.id}`].cell(_i, j).string(allProductData.features[j - 2])
					// }
					// _i += 2;
					
					//OptionLabel
					// worksheets[`Category${category.id}`].cell(_i, 2).string("Options:")
					// for (let optionName of Object.keys(allProductData.optionData)) {
					// 	_i += 1;
					// 	worksheets[`Category${category.id}`].cell(_i, 2).string(optionName)
					// 	worksheets[`Category${category.id}`].cell(_i, 3).string(allProductData.optionData[optionName].offerPrice)
					// 	worksheets[`Category${category.id}`].cell(_i, 4).string(allProductData.optionData[optionName].prevPrice)
					// 	worksheets[`Category${category.id}`].cell(_i, 5).string(allProductData.optionData[optionName].status)
					// }
					// _i += 2;
					// worksheets[`Category${category.id}`].cell(_i, 2).string("Description:")
					// _i++;
					// worksheets[`Category${category.id}`].cell(_i, 2).string(allProductData.description)
					//
					// _i += 5;
					// workbook.write('Excel.xlsx');
				} catch (e) {
					console.log(e)
				}
				
				
				// let k = 0;
				//Download Images
				// for (let image of allProductData.images) {
				// 	await downloadImage(image, `./images/category${category.id}`, `product${product.id}_${k}.jpg`)
				// 	k++;
				// }
			}
			_i += 3;
		}
		
		await browser.close();
	} catch
		(e) {
		console.log(e)
		await browser.close();
	}
}
main()