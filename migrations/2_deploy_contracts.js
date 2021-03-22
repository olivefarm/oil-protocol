// ============ Contracts ============
const BrewMaster = artifacts.require("BrewMaster");
const OLIVOil = artifacts.require("OLIVOil");



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
    if(network != 'test'){
        // OpenSea proxy registry addresses for rinkeby and mainnet.
        let proxyRegistryAddress = "";
        if (network === 'ropsten') {
            proxyRegistryAddress = "0xf57b2c51ded3a29e6891aba85459d600256cf317";
        } else {
            proxyRegistryAddress = "0xa5409ec958c83c3f309868babaca7c86dcb077c1";
        }
        await deployer.deploy(OLIVOil,
            proxyRegistryAddress
        );
        // 100 tickets per block
        let ticketPerBlock = "100000000000000000000";
        let startBlock = 0;
        if(network == 'ropsten'){
            // ~Thu Sep 10 2020 00:00:00 GMT+0000
            startBlock = 10830680;
        }
        await deployer.deploy(BrewMaster,
            OLIVOil.address,
            ticketPerBlock,
            startBlock
        );
        let olivOil = await OLIVOil.deployed();
        let brewMaster = await BrewMaster.deployed();
        await olivOil.addMinter(brewMaster.address);
    }
}
