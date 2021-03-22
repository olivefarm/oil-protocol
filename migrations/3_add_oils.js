// ============ Contracts ============
const BrewMaster = artifacts.require("BrewMaster");
const OLIVOil = artifacts.require("OLIVOil");



// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  await Promise.all([
    addOils(deployer, network),
  ]);
};

module.exports = migration;

// ============ Deploy Functions ============
// This is split across multiple files so that
// if the web3 provider craps out, all progress isn't lost.
//
// This is at the expense of having to do 6 extra txs to sync the migrations
// contract

async function addOils(deployer, network) {
    if(network != 'test'){
        let olivOil = await OLIVOil.deployed();
        let brewMaster = await BrewMaster.deployed();

        let oilAmount = [
            12, // 1
            32, 32, 32, 32, 32, // 5
            128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, // 17
            256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, // 14
            500, // 1
            256, 256, 256, 256, 256, 256, 256, 256, 256, 256, // 10
            500, // 1
            508 // 1
        ]
        console.log(oilAmount.reduce((a,b)=>a+b));
        let oilID = 1;
        for await (let num of oilAmount) {
            await olivOil.create(num, 0, "", "0x0");
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
            await brewMaster.addOil(oilID, num, price);
            console.log("add oil ", oilID , " amount ", num);
            oilID++;
        }
    }
}
