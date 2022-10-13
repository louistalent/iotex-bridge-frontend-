require('dotenv').config();
require('colors');
const fs = require('fs');
const testnet = process.env.TESTNET==="1"
const symbol = process.env.SYMBOL

const configFile = __dirname + '/../src/config/networks' + (testnet ? '.testnet' : '') + '.json'

const networks = require(configFile);

/* const abiIrc20 = require("../artifacts/contracts/ERC20.sol/ERC20.json");
const abiBridge = require("../artifacts/contracts/Bridge.sol/Bridge.json");
 */
const hre = require("hardhat");

async function main() {
	const netid = 'ETH'
	const peggingTokens = [symbol]
	const unPeggingTokens = ['BNB']

	const admin = process.env.ADMIN_PUBKEY;
	const signer = await hre.ethers.getSigner();
	console.log('Starting ' + netid + ' deploy by ', signer.address.yellow);
	const Bridge = await hre.ethers.getContractFactory("Bridge");
	const bridge = await Bridge.deploy(admin);
	await bridge.deployed();
	console.log('Bridge ' + bridge.address);

	const tokens = {}
	//  as {
	// 	[token: string]: {
	// 		decimals: number
	// 		contract?: string
	// 	}
	// }
	for (let symbol of peggingTokens) {
		const Token = await hre.ethers.getContractFactory('Token');
		const decimals = 18;
		const token = await Token.deploy("Pegged " + symbol, symbol, 18);
		await token.deployed();
		console.log("Pegged " + symbol + ' ' + token.address);
	
		const tx1 = await token.transferOwnership(bridge.address)
		await tx1.wait()
	
		const tx2 = await bridge.addToken(token.address)
		await tx2.wait()
		tokens[symbol] = {
			contract: token.address,
			decimals,
			pegging: true
		}
	}
	if (testnet && unPeggingTokens.length>0) {
		for (let symbol of unPeggingTokens) {
			const Token = await hre.ethers.getContractFactory('Token');
			const decimals = 18;
			const token = await Token.deploy(symbol, symbol, 18);
			await token.deployed();
			console.log(symbol + ' ' + token.address);
			tokens[symbol] = {
				contract: token.address,
				decimals
			}
		}
	}

	fs.writeFileSync(configFile, JSON.stringify({
		...networks, 
		[netid]: {
			...networks[netid],
			bridge: bridge.address,
			tokens: {
				...networks[netid].tokens,
				...tokens
			}
		}
	}, null, 4));
}

main().then(() => {
}).catch((error) => {
	console.error(error);
	process.exit(1);
});
