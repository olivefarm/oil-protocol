// ============ Contracts ============
const GRAPWine = artifacts.require("GRAPWine");
const WineTrader = artifacts.require("WineTrader");



// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  await Promise.all([
    deployContracts(deployer, network),
  ]);
};

module.exports = migration;

// ============ Deploy Functions ============
// This is split across multiple files so that
// if the web3 provider craps out, all progress isn't lost.
//
// This is at the expense of having to do 6 extra txs to sync the migrations
// contract

async function deployContracts(deployer, network) {
    if(network != 'test'){
        let grapWine = await GRAPWine.deployed();
        await deployer.deploy(WineTrader,
            grapWine.address,
        );
    }
}
