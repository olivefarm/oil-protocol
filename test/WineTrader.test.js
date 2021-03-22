const { expectRevert, time } = require('@openzeppelin/test-helpers');
const OLIVOil = artifacts.require('OLIVOil');
const BrewMaster = artifacts.require('BrewMaster');
const OilTrader = artifacts.require('OilTrader');
const MockERC20 = artifacts.require('MockERC20');
const MockProxy = artifacts.require('MockProxy');

contract('OilTrader', ([alice, bob, carol, minter]) => {
    context('With OilTrader', () => {
        beforeEach(async () => {
            this.mockProxy = await MockProxy.new();
            this.olivOil = await OLIVOil.new(this.mockProxy.address, { from: alice });
            this.brewMaster = await BrewMaster.new(this.olivOil.address, '100000000000000000000', '0', { from: alice });
            this.oilTrader = await OilTrader.new(this.olivOil.address, { from: alice });

            await this.olivOil.addMinter(this.brewMaster.address, { from: alice });
            
            this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
            await this.lp.transfer(alice, '1000', { from: minter });
            await this.lp.transfer(bob, '1000', { from: minter });
            await this.lp.transfer(carol, '1000', { from: minter });

            await this.brewMaster.add('100', this.lp.address, true);

            const maxAmount = 1000;
            // 1 ETH
            const fixedPrice = String(10e18);
            const wid = 1;
            await this.olivOil.create(maxAmount, 0, "", "0x0");
            await this.brewMaster.addOil(wid, maxAmount, fixedPrice);
        });

        it('open order', async () => {
            await this.lp.approve(this.brewMaster.address, '1000', { from: bob });
            await this.brewMaster.deposit(0, '100', { from: bob });

            await this.brewMaster.airDrop({ from: alice });
            assert.equal((await this.brewMaster.userOilBalanceOf(bob, 1)).valueOf(), '1');
            assert.equal((await this.brewMaster.oilBalanceOf(1)).valueOf(), '999');

            const claimFee = (await this.brewMaster.claimFee(1, 1)).valueOf();

            await this.brewMaster.claim(1, 1, { from: bob, value: claimFee });
            assert.equal((await this.olivOil.balanceOf(bob, 1)).valueOf(), '1');

            await this.olivOil.setApprovalForAll(this.oilTrader.address, true, { from: bob });

            assert.equal((await this.olivOil.isApprovedForAll(bob, this.oilTrader.address)).valueOf(), true);

            // 1 ETH
            const price = String(10e18);
            await this.oilTrader.orderOil(1, price, { from: bob });
            assert.equal((await this.olivOil.balanceOf(bob, 1)).valueOf(), '0');
            assert.equal((await this.olivOil.balanceOf(this.oilTrader.address, 1)).valueOf(), '1');
        });

        it('cancel order', async () => {
            await this.lp.approve(this.brewMaster.address, '1000', { from: bob });
            await this.brewMaster.deposit(0, '100', { from: bob });

            await this.brewMaster.airDrop({ from: alice });
            assert.equal((await this.brewMaster.userOilBalanceOf(bob, 1)).valueOf(), '1');
            assert.equal((await this.brewMaster.oilBalanceOf(1)).valueOf(), '999');

            const claimFee = (await this.brewMaster.claimFee(1, 1)).valueOf();

            await this.brewMaster.claim(1, 1, { from: bob, value: claimFee });
            assert.equal((await this.olivOil.balanceOf(bob, 1)).valueOf(), '1');

            await this.olivOil.setApprovalForAll(this.oilTrader.address, true, { from: bob });

            assert.equal((await this.olivOil.isApprovedForAll(bob, this.oilTrader.address)).valueOf(), true);

            // 1 ETH
            const price = String(10e18);
            await this.oilTrader.orderOil(1, price, { from: bob });
            assert.equal((await this.olivOil.balanceOf(bob, 1)).valueOf(), '0');
            assert.equal((await this.olivOil.balanceOf(this.oilTrader.address, 1)).valueOf(), '1');

            await expectRevert(
                this.oilTrader.cancel(1, { from: alice }),
                'not your order',
            );

            await this.oilTrader.cancel(1, { from: bob });
            assert.equal((await this.olivOil.balanceOf(bob, 1)).valueOf(), '1');
            assert.equal((await this.olivOil.balanceOf(this.oilTrader.address, 1)).valueOf(), '0');

            await expectRevert(
                this.oilTrader.cancel(1, { from: bob }),
                'only open order can be cancel',
            );
        });

        it('buy oil', async () => {
            await this.lp.approve(this.brewMaster.address, '1000', { from: bob });
            await this.brewMaster.deposit(0, '100', { from: bob });

            await this.brewMaster.airDrop({ from: alice });
            assert.equal((await this.brewMaster.userOilBalanceOf(bob, 1)).valueOf(), '1');
            assert.equal((await this.brewMaster.oilBalanceOf(1)).valueOf(), '999');

            const claimFee = (await this.brewMaster.claimFee(1, 1)).valueOf();

            await this.brewMaster.claim(1, 1, { from: bob, value: claimFee });
            assert.equal((await this.olivOil.balanceOf(bob, 1)).valueOf(), '1');

            await this.olivOil.setApprovalForAll(this.oilTrader.address, true, { from: bob });

            assert.equal((await this.olivOil.isApprovedForAll(bob, this.oilTrader.address)).valueOf(), true);

            // 1 ETH
            const price = String(10e18);
            await this.oilTrader.orderOil(1, price, { from: bob });
            assert.equal((await this.olivOil.balanceOf(bob, 1)).valueOf(), '0');
            assert.equal((await this.olivOil.balanceOf(this.oilTrader.address, 1)).valueOf(), '1');

            await expectRevert(
                this.oilTrader.buyOil(1, { from: bob }),
                'it is your order',
            );

            await expectRevert(
                this.oilTrader.buyOil(1, { from: alice, value: "1234" }),
                'error price',
            );
            let perBalance = await web3.eth.getBalance(bob);
            let buyFee = (Number(price) * 3 / 100);
            let afterBalance = Number(perBalance) + (Number(price) * 97 / 100);
            await this.oilTrader.buyOil(1, { from: alice, value: price });
            assert.equal(await web3.eth.getBalance(bob), afterBalance);
            assert.equal(await web3.eth.getBalance(this.oilTrader.address), buyFee);

            assert.equal((await this.olivOil.balanceOf(bob, 1)).valueOf(), '0');
            assert.equal((await this.olivOil.balanceOf(this.oilTrader.address, 1)).valueOf(), '0');
            assert.equal((await this.olivOil.balanceOf(alice, 1)).valueOf(), '1');

            await expectRevert(
                this.oilTrader.buyOil(1, { from: alice, value: price }),
                'only open order can buy',
            );
        });
    });
});