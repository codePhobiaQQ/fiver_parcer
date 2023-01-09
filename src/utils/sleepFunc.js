const sleepFunc = async (ms) => {
	await new Promise((res) => {
		setTimeout(res, ms);
	});
};

export default sleepFunc;
