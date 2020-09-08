// ============ Contracts ============
const BrewMaster = artifacts.require("BrewMaster");
const GRAPWine = artifacts.require("GRAPWine");



// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  await Promise.all([
    deployMainContracts(deployer, network),
  ]);
};

module.exports = migration;

// ============ Deploy Functions ============
// This is split across multiple files so that
// if the web3 provider craps out, all progress isn't lost.
//
// This is at the expense of having to do 6 extra txs to sync the migrations
// contract

async function deployMainContracts(deployer, network) {
    // OpenSea proxy registry addresses for rinkeby and mainnet.
    let proxyRegistryAddress = "";
    if (network === 'rinkeby') {
        proxyRegistryAddress = "0xf57b2c51ded3a29e6891aba85459d600256cf317";
    } else {
        proxyRegistryAddress = "0xa5409ec958c83c3f309868babaca7c86dcb077c1";
    }
    await deployer.deploy(GRAPWine,
        proxyRegistryAddress
    );
    // 100 tickets per block
    let ticketPerBlock = "100000000000000000000";
    let startBlock = 0;
    await deployer.deploy(BrewMaster,
        GRAPWine.address,
        ticketPerBlock,
        startBlock
    );
    let grapWine = await GRAPWine.deployed();
    let brewMaster = await BrewMaster.deployed();

    let wineAmount = [
        12, // 1
        32, 32, 32, 32, 32, // 5
        128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, // 17
        256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, // 14
        500, // 1
        256, 256, 256, 256, 256, 256, 256, 256, 256, 256, // 10
        500, // 1
        508 // 1
    ]
    console.log(wineAmount.reduce((a,b)=>a+b));
    let wineID = 1;
    for await (let num of wineAmount) {
        await grapWine.create(num, 0, "", "0x0");
        let price = "0";
        if(num <= 32) {
            // 1 ETH, fee is 0.03
            price = "1000000000000000000";
        } else if (num <= 256){
            // 0.5 ETH, fee is 0.015
            price = "500000000000000000";
        } else {
            // 0.3333333 ETH, fee is 0.01
            price = "333333333333333333";
        }
        await brewMaster.addWine(wineID, num, price);
        console.log("add wine ", wineID , " amount ", num);
        wineID++;
    }
}
